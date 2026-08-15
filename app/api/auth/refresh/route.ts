// app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { generateCSRFToken } from "@/core/auth/lib/csrf";
import { isSessionRevoked } from "@/core/auth/lib/revocation";
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
    }) as { userId: string; wallet: string; iat: number; type?: string };

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
      revoked.cookies.delete("token");
      revoked.cookies.delete("refresh_token");
      revoked.cookies.delete("csrf_token");
      return revoked;
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, decoded.userId) });

    if (!user || user.wallet !== decoded.wallet) {
      const gone = NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
      gone.cookies.delete("token");
      gone.cookies.delete("refresh_token");
      gone.cookies.delete("csrf_token");
      return gone;
    }

    if (user.isBanned) {
      const banned = NextResponse.json(
        { error: "banned", reason: user.banReason || undefined },
        { status: 403, headers: formatRateLimitHeaders(rl) }
      );
      banned.cookies.delete("token");
      banned.cookies.delete("refresh_token");
      banned.cookies.delete("csrf_token");
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

    const newRefreshToken = jwt.sign(
      { userId: decoded.userId, wallet: decoded.wallet, type: "refresh" },
      jwtSecret,
      {
        expiresIn: "7d",
        issuer: "tanjo-store",
        audience: "tanjo-users",
      }
    );

    const newCsrfToken = generateCSRFToken();
    const isProd = process.env.NODE_ENV === "production";

    const response = NextResponse.json(
      { success: true, csrfToken: newCsrfToken },
      { headers: formatRateLimitHeaders(rl) }
    );

    const baseCookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax" as const,
      path: "/",
      domain: isProd ? ".theadvenjo.online" : undefined,
    };

    response.cookies.set("token", newAccessToken, {
      ...baseCookieOptions,
      maxAge: 15 * 60,
    });

    response.cookies.set("refresh_token", newRefreshToken, {
      ...baseCookieOptions,
      maxAge: 7 * 24 * 60 * 60,
    });

    response.cookies.set("csrf_token", newCsrfToken, {
      ...baseCookieOptions,
      httpOnly: false,
      maxAge: 60 * 60 * 24,
    });

    return response;

  } catch (error) {
    const response = NextResponse.json(
      { error: "session_expired" },
      { status: 401 }
    );
    response.cookies.delete("token");
    response.cookies.delete("refresh_token");
    response.cookies.delete("csrf_token");
    return response;
  }
}
