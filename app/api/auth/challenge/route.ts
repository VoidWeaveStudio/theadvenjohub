//app\api\auth\challenge\route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { Redis } from "@upstash/redis";
import { generateCSRFToken } from "@/core/auth/lib/csrf";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    
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
    
    await redis.set(`auth:nonce:${wallet}`, nonce, { ex: 120 });

    const csrfToken = generateCSRFToken();
    const isProd = process.env.NODE_ENV === "production";

    const response = NextResponse.json(
      { nonce, csrfToken }, 
      { headers: formatRateLimitHeaders(rl) }
    );

    response.cookies.set("csrf_token", csrfToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: "lax" as const,
      path: "/",
      domain: isProd ? ".theadvenjo.online" : undefined,
      maxAge: 60 * 60 * 24,
    });

    return response;

  } catch (error) {
    console.error("Challenge error:", error);
    return NextResponse.json(
      { error: "challenge_failed" },
      { status: 500 }
    );
  }
}