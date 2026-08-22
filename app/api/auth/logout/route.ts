// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { revokeSessions } from "@/core/auth/lib/revocation";
import { clearSessionCookies } from "@/core/auth/lib/cookieOptions";
import { revokeSession } from "@/core/auth/lib/sessionRegistry";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";

function readSessionClaims(
  token: string | undefined,
  jwtSecret: string | undefined
): { userId: string; sid?: string } | null {
  if (!token || !jwtSecret) return null;

  try {
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: "tanjo-store",
      audience: "tanjo-users",
    }) as { userId?: string; sid?: string };

    return decoded.userId ? { userId: decoded.userId, sid: decoded.sid } : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`auth:logout:${ip}`, {
    maxAttempts: 20,
    windowMs: 60_000,
    prefix: "api:auth:logout",
  });

  const jwtSecret = process.env.JWT_SECRET;
  const claims =
    readSessionClaims(req.cookies.get("refresh_token")?.value, jwtSecret) ||
    readSessionClaims(req.cookies.get("token")?.value, jwtSecret);

  if (claims) {
    if (claims.sid) {
      await revokeSession(claims.userId, claims.sid).catch((error) => {
        console.error("[logout] Failed to revoke session record:", error);
      });
    }

    await revokeSessions(claims.userId).catch((error) => {
      console.error("[logout] Failed to revoke sessions:", error);
    });
  }

  const response = NextResponse.json({ success: true }, {
    headers: formatRateLimitHeaders(rl),
  });

  clearSessionCookies(response);

  return response;
}

export { POST as DELETE };
