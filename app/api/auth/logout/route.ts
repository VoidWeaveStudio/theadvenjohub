// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { revokeSessions } from "@/core/auth/lib/revocation";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";

function readUserId(token: string | undefined, jwtSecret: string | undefined): string | null {
  if (!token || !jwtSecret) return null;

  try {
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: "tanjo-store",
      audience: "tanjo-users",
    }) as { userId?: string };
    return decoded.userId || null;
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
  const userId =
    readUserId(req.cookies.get("refresh_token")?.value, jwtSecret) ||
    readUserId(req.cookies.get("token")?.value, jwtSecret);

  if (userId) {
    await revokeSessions(userId).catch((error) => {
      console.error("[logout] Failed to revoke sessions:", error);
    });
  }

  const response = NextResponse.json({ success: true }, {
    headers: formatRateLimitHeaders(rl),
  });

  response.cookies.delete("token");
  response.cookies.delete("refresh_token");
  response.cookies.delete("csrf_token");

  return response;
}

export { POST as DELETE };
