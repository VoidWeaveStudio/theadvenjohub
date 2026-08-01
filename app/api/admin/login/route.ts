// app/api/admin/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { verifyCSRF } from "@/core/auth/lib/csrf";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";
import { db } from "@/core/database";
import { users } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { buildExpectedSignInMessages, verifySolanaSignature } from "@/core/auth/lib/signMessage";
import { createAdminToken } from "@/core/admin/auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const rl = await checkRateLimit(`admin:login:${ip}`, {
    maxAttempts: 10,
    windowMs: 60_000,
    prefix: "api:admin:login",
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "too_many_attempts" },
      { status: 429, headers: formatRateLimitHeaders(rl) }
    );
  }

  if (!verifyCSRF(req)) {
    return NextResponse.json(
      { error: "invalid_csrf_token" },
      { status: 403, headers: formatRateLimitHeaders(rl) }
    );
  }

  try {
    const body = await req.json();
    const { signature, wallet, message, nonce } = body;

    if (
      !signature || !wallet || !message || !nonce ||
      typeof signature !== "string" || typeof wallet !== "string" ||
      typeof message !== "string" || typeof nonce !== "string"
    ) {
      return NextResponse.json(
        { error: "missing_required_fields" },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }

    const adminWallet = process.env.ADMIN_WALLET;
    if (!adminWallet || wallet !== adminWallet) {
      return NextResponse.json(
        { error: "not_admin" },
        { status: 403, headers: formatRateLimitHeaders(rl) }
      );
    }

    const storedChallenge = await redis.get<{ nonce: string; domain: string }>(
      `auth:nonce:${wallet}`
    );
    const storedNonce = storedChallenge?.nonce;
    const storedDomain = storedChallenge?.domain;

    if (!storedNonce || !storedDomain || storedNonce !== nonce) {
      return NextResponse.json(
        { error: "invalid_or_expired_nonce" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
    }

    const expectedMessages = buildExpectedSignInMessages(wallet, nonce, storedDomain);
    if (!expectedMessages.includes(message)) {
      return NextResponse.json(
        { error: "invalid_message" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
    }

    if (!verifySolanaSignature(signature, message, wallet)) {
      return NextResponse.json(
        { error: "invalid_signature" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
    }

    await redis.del(`auth:nonce:${wallet}`);

    const [inserted] = await db
      .insert(users)
      .values({ wallet, createdAt: new Date() })
      .onConflictDoNothing({ target: users.wallet })
      .returning();

    const finalUser = inserted || await db.query.users.findFirst({ where: eq(users.wallet, wallet) });
    if (!finalUser) {
      throw new Error("Failed to create or retrieve admin user");
    }

    const adminToken = createAdminToken({ wallet: finalUser.wallet, role: "admin", userId: finalUser.id });
    const isProd = process.env.NODE_ENV === "production";

    const response = NextResponse.json(
      { success: true },
      { headers: formatRateLimitHeaders(rl) }
    );

    response.cookies.set("admin_token", adminToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    console.error("[admin/login] Error:", error);
    return NextResponse.json(
      { error: "login_failed" },
      { status: 500, headers: formatRateLimitHeaders(rl) }
    );
  }
}
