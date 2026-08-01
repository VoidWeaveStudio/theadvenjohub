// app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { Redis } from "@upstash/redis";
import { generateCSRFToken, verifyCSRF } from "@/core/auth/lib/csrf";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";
import { db } from "@/core/database";
import { users } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { buildExpectedSignInMessages, verifySolanaSignature } from "@/core/auth/lib/signMessage";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    const rl = await checkRateLimit(`auth:verify:${ip}`, {
      maxAttempts: 10,
      windowMs: 60_000,
      prefix: "api:auth:verify",
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

    const body = await req.json();
    const { signature, wallet, message, nonce, platform } = body;

    if (process.env.NODE_ENV === "development") {
      console.log("[verify] Request received:", {
        hasSignature: !!signature,
        hasWallet: !!wallet,
        hasMessage: !!message,
        hasNonce: !!nonce,
        wallet,
        nonce,
      });
    }

    if (
      !signature ||
      !wallet ||
      !message ||
      !nonce ||
      typeof signature !== "string" ||
      typeof wallet !== "string" ||
      typeof message !== "string" ||
      typeof nonce !== "string"
    ) {
      console.error("[verify] Missing fields");
      return NextResponse.json(
        { error: "missing_required_fields" },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }

    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
      console.error("[verify] Invalid wallet format");
      return NextResponse.json(
        { error: "invalid_wallet_format" },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }

    if (signature.length < 88) {
      console.error("[verify] Invalid signature format");
      return NextResponse.json(
        { error: "invalid_signature_format" },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }

    // @upstash/redis auto-deserializes JSON values, so this is already an
    // object (or null) — not a string requiring a manual JSON.parse.
    const storedChallenge = await redis.get<{ nonce: string; domain: string }>(
      `auth:nonce:${wallet}`
    );
    const storedNonce = storedChallenge?.nonce;
    const storedDomain = storedChallenge?.domain;

    if (process.env.NODE_ENV === "development") {
      console.log("[verify] Nonce check:", {
        received: nonce,
        stored: storedNonce,
        match: storedNonce === nonce,
      });
    }

    if (!storedNonce || !storedDomain || storedNonce !== nonce) {
      console.error("[verify] Invalid or expired nonce");
      return NextResponse.json(
        { error: "invalid_or_expired_nonce" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
    }

    const expectedMessages = buildExpectedSignInMessages(wallet, nonce, storedDomain);
    if (!expectedMessages.includes(message)) {
      console.error("[verify] Message does not match expected template for wallet+nonce");
      return NextResponse.json(
        { error: "invalid_message" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
    }

    if (!verifySolanaSignature(signature, message, wallet)) {
      console.error("[verify] Invalid signature");
      return NextResponse.json(
        { error: "invalid_signature" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
    }

    console.log("[verify] All checks passed, creating user...");

    await redis.del(`auth:nonce:${wallet}`);

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      console.error("[verify] JWT secret not configured");
      return NextResponse.json(
        { error: "server_config_error" },
        { status: 500, headers: formatRateLimitHeaders(rl) }
      );
    }

    const [user] = await db
      .insert(users)
      .values({
        wallet,
        createdAt: new Date(),
      })
      .onConflictDoNothing({ target: users.wallet })
      .returning();

    const finalUser = user || await db.query.users.findFirst({
      where: eq(users.wallet, wallet),
    });

    if (!finalUser) {
      console.error("[verify] Failed to create/retrieve user");
      throw new Error("Failed to create or retrieve user");
    }

    if (finalUser.isBanned) {
      return NextResponse.json(
        { error: "banned", reason: finalUser.banReason || undefined },
        { status: 403, headers: formatRateLimitHeaders(rl) }
      );
    }

    console.log("[verify] User found:", finalUser.id);

    const accessToken = jwt.sign(
      {
        userId: finalUser.id,
        wallet: finalUser.wallet,
        type: "access",
        iat: Math.floor(Date.now() / 1000),
      },
      jwtSecret,
      {
        expiresIn: "15m",
        issuer: "tanjo-store",
        audience: "tanjo-users",
        jwtid: `${finalUser.id}-${Date.now()}`,
      }
    );

    const refreshToken = jwt.sign(
      {
        userId: finalUser.id,
        wallet: finalUser.wallet,
        type: "refresh",
        iat: Math.floor(Date.now() / 1000),
      },
      jwtSecret,
      {
        expiresIn: "7d",
        issuer: "tanjo-store",
        audience: "tanjo-users",
        jwtid: `${finalUser.id}-refresh-${Date.now()}`,
      }
    );

    const newCsrfToken = generateCSRFToken();
    const isProd = process.env.NODE_ENV === "production";

    const response = NextResponse.json(
      {
        success: true,
        user: { wallet: finalUser.wallet },
        csrfToken: newCsrfToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        ...(platform === "desktop" ? { accessToken } : {}),
      },
      { headers: formatRateLimitHeaders(rl) }
    );

    const baseCookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax" as const,
      path: "/",
      domain: isProd ? ".theadvenjo.online" : undefined,
    };

    response.cookies.set("token", accessToken, {
      ...baseCookieOptions,
      maxAge: 15 * 60,
    });

    response.cookies.set("refresh_token", refreshToken, {
      ...baseCookieOptions,
      maxAge: 7 * 24 * 60 * 60,
    });

    response.cookies.set("csrf_token", newCsrfToken, {
      ...baseCookieOptions,
      httpOnly: false,
      maxAge: 60 * 60 * 24,
    });

    console.log("[verify] Success! User authenticated:", finalUser.wallet);

    return response;

  } catch (error) {
    console.error("[verify] Error:", error);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "verification_failed" : "internal_error" },
      { status: 500 }
    );
  }
}