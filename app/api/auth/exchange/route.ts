// app/api/auth/exchange/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@/core/database";
import { users } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { redeemDesktopCode } from "@/core/auth/lib/desktopCode";
import { isSessionRevoked } from "@/core/auth/lib/revocation";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const rl = await checkRateLimit(`auth:exchange:${ip}`, {
    maxAttempts: 20,
    windowMs: 60_000,
    prefix: "api:auth:exchange",
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "too_many_attempts" },
      { status: 429, headers: formatRateLimitHeaders(rl) }
    );
  }

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : null;
  const codeVerifier = typeof body?.codeVerifier === "string" ? body.codeVerifier : null;

  if (!code || !codeVerifier) {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400, headers: formatRateLimitHeaders(rl) }
    );
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    console.error("[auth/exchange] JWT secret not configured");
    return NextResponse.json({ error: "server_config_error" }, { status: 500 });
  }

  try {
    const redeemed = await redeemDesktopCode(code, codeVerifier);
    if (!redeemed) {
      return NextResponse.json(
        { error: "invalid_or_expired_code" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, redeemed.userId) });

    if (!user || user.wallet !== redeemed.wallet) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
    }

    if (user.isBanned) {
      return NextResponse.json(
        { error: "banned", reason: user.banReason || undefined },
        { status: 403, headers: formatRateLimitHeaders(rl) }
      );
    }

    const issuedAt = Math.floor(Date.now() / 1000);

    if (await isSessionRevoked(user.id, issuedAt)) {
      return NextResponse.json(
        { error: "session_revoked" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
    }

    const accessToken = jwt.sign(
      {
        userId: user.id,
        wallet: user.wallet,
        type: "access",
        iat: issuedAt,
      },
      jwtSecret,
      {
        expiresIn: "15m",
        issuer: "tanjo-store",
        audience: "tanjo-users",
        jwtid: `${user.id}-desktop-${Date.now()}`,
      }
    );

    return NextResponse.json(
      {
        accessToken,
        wallet: user.wallet,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
      { headers: formatRateLimitHeaders(rl) }
    );
  } catch (error) {
    console.error("[auth/exchange] Error:", error);
    return NextResponse.json(
      { error: "exchange_failed" },
      { status: 500, headers: formatRateLimitHeaders(rl) }
    );
  }
}
