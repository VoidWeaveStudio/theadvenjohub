// app/api/auth/challenge/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { Redis } from "@upstash/redis";
import { generateCSRFToken } from "@/core/auth/lib/csrf";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";
import { getExpectedDomain } from "@/core/auth/lib/signMessage";
import { baseCookieOptions, clearLegacyDomainCookies } from "@/core/auth/lib/cookieOptions";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const NONCE_TTL_SECONDS = 300;

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    
    const rl = await checkRateLimit(`auth:challenge:${ip}`, {
      maxAttempts: 20,
      windowMs: 60_000,
      prefix: "api:auth:challenge",
    });

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "too_many_attempts" },
        { status: 429, headers: formatRateLimitHeaders(rl) }
      );
    }

    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    
    if (!wallet || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
      return NextResponse.json(
        { error: "invalid_wallet" },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }

    const nonce = randomBytes(16).toString("hex");
    const domain = getExpectedDomain();

    await redis.set(
      `auth:nonce:${wallet}`,
      { nonce, domain },
      { ex: NONCE_TTL_SECONDS }
    );

    const csrfToken = generateCSRFToken();

    const response = NextResponse.json(
      { nonce, domain, csrfToken },
      { headers: formatRateLimitHeaders(rl) }
    );

    response.cookies.set("csrf_token", csrfToken, {
      ...baseCookieOptions(),
      httpOnly: false,
      maxAge: 60 * 60 * 24,
    });

    clearLegacyDomainCookies(response, ["csrf_token"]);

    return response;

  } catch (error) {
    console.error("Challenge error:", error);
    return NextResponse.json(
      { error: "challenge_failed" },
      { status: 500 }
    );
  }
}