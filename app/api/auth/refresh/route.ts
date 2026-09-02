// app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { generateCSRFToken } from "@/core/auth/lib/csrf";
import { isSessionRevoked } from "@/core/auth/lib/revocation";
import { baseCookieOptions, clearLegacyDomainCookies, clearSessionCookies } from "@/core/auth/lib/cookieOptions";
import {
  acceptsTokenId,
  describeDevice,
  isBeyondAbsoluteLifetime,
  newSessionId,
  newTokenId,
  readSession,
  registerSession,
  rotateSession,
} from "@/core/auth/lib/sessionRegistry";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";
import { db } from "@/core/database";
import { users } from "@/core/database/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    const rl = await checkRateLimit(`auth:refresh:${ip}`, {
      maxAttempts: 10,
      windowMs: 60_000,
      prefix: "api:auth:refresh",
    });

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "too_many_attempts" },
        { status: 429, headers: formatRateLimitHeaders(rl) }
      );
    }

    const refreshToken = req.cookies.get("refresh_token")?.value;
    const jwtSecret = process.env.JWT_SECRET;

    if (!refreshToken || !jwtSecret) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
    }

    const decoded = jwt.verify(refreshToken, jwtSecret, {
      issuer: "tanjo-store",
      audience: "tanjo-users",
    }) as { userId: string; wallet: string; iat: number; type?: string; sid?: string; jti?: string };

    if (decoded.type !== "refresh") {
      return NextResponse.json(
        { error: "invalid_token_type" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
    }

    if (await isSessionRevoked(decoded.userId, decoded.iat)) {
      const revoked = NextResponse.json(
        { error: "session_revoked" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
      clearSessionCookies(revoked);
      return revoked;
    }

    let sessionId = decoded.sid;
    let sessionCreatedAt = Date.now();
    // Set when the caller presented the token a very recent rotation replaced:
    // it is handed the session's current token instead of starting a second
    // rotation chain, so a racing tab converges rather than being logged out.
    let replayJti: string | null = null;

    if (sessionId) {
      const session = await readSession(decoded.userId, sessionId);

      if (session) {
        if (!acceptsTokenId(session, decoded.jti) || isBeyondAbsoluteLifetime(session.createdAt)) {
          const stale = NextResponse.json(
            { error: "session_expired" },
            { status: 401, headers: formatRateLimitHeaders(rl) }
          );
          clearSessionCookies(stale);
          return stale;
        }
        sessionCreatedAt = session.createdAt;
        if (session.jti !== decoded.jti) replayJti = session.jti;
      }
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, decoded.userId) });

    if (!user || user.wallet !== decoded.wallet) {
      const gone = NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
      clearSessionCookies(gone);
      return gone;
    }

    if (user.isBanned) {
      const banned = NextResponse.json(
        { error: "banned", reason: user.banReason || undefined },
        { status: 403, headers: formatRateLimitHeaders(rl) }
      );
      clearSessionCookies(banned);
      return banned;
    }

    const newAccessToken = jwt.sign(
      { userId: decoded.userId, wallet: decoded.wallet, type: "access" },
      jwtSecret,
      {
        expiresIn: "15m",
        issuer: "tanjo-store",
        audience: "tanjo-users",
      }
    );

    const nextTokenId = replayJti ?? newTokenId();
    const isNewSession = !sessionId;
    if (!sessionId) sessionId = newSessionId();

    const newRefreshToken = jwt.sign(
      { userId: decoded.userId, wallet: decoded.wallet, type: "refresh", sid: sessionId },
      jwtSecret,
      {
        expiresIn: "7d",
        issuer: "tanjo-store",
        audience: "tanjo-users",
        jwtid: nextTokenId,
      }
    );

    if (isNewSession) {
      await registerSession(decoded.userId, {
        sid: sessionId,
        jti: nextTokenId,
        createdAt: sessionCreatedAt,
        device: describeDevice(req.headers.get("user-agent")),
      });
    } else if (!replayJti) {
      await rotateSession(decoded.userId, sessionId, nextTokenId);
    }

    const newCsrfToken = generateCSRFToken();
    const cookieOptions = baseCookieOptions();

    const response = NextResponse.json(
      { success: true, csrfToken: newCsrfToken },
      { headers: formatRateLimitHeaders(rl) }
    );

    response.cookies.set("token", newAccessToken, {
      ...cookieOptions,
      maxAge: 15 * 60,
    });

    response.cookies.set("refresh_token", newRefreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60,
    });

    response.cookies.set("csrf_token", newCsrfToken, {
      ...cookieOptions,
      httpOnly: false,
      maxAge: 60 * 60 * 24,
    });

    clearLegacyDomainCookies(response);

    return response;

  } catch (error) {
    const response = NextResponse.json(
      { error: "session_expired" },
      { status: 401 }
    );
    clearSessionCookies(response);
    return response;
  }
}
