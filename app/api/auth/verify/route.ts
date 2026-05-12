// app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { generateCSRFToken, verifyCSRFToken } from "@/core/auth/lib/csrf";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";
import { db } from "@/core/database";
import { users } from "@/core/database/schema";
import { eq, sql } from "drizzle-orm";

function verifySolanaSignature(
  signatureBase64: string,
  message: string,
  wallet: string
): boolean {
  try {
    const signature = Uint8Array.from(Buffer.from(signatureBase64, "base64"));
    const messageBytes = new TextEncoder().encode(message);
    const publicKey = new PublicKey(wallet);
    
    return nacl.sign.detached.verify(
      messageBytes,
      signature,
      publicKey.toBytes()
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

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

    const body = await req.json();
    const { signature, wallet, message, nonce } = body;

    if (
      !signature || 
      !wallet || 
      !message || 
      typeof signature !== "string" || 
      typeof wallet !== "string" || 
      typeof message !== "string"
    ) {
      return NextResponse.json(
        { error: "missing_required_fields" },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }

    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
      return NextResponse.json(
        { error: "invalid_wallet_format" },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }

    if (signature.length < 88) {
      return NextResponse.json(
        { error: "invalid_signature_format" },
        { status: 400, headers: formatRateLimitHeaders(rl) }
      );
    }

    const headerCsrf = req.headers.get("x-csrf-token");
    const cookieCsrf = req.cookies.get("csrf_token")?.value;
    
    if (!headerCsrf || !cookieCsrf || !verifyCSRFToken(headerCsrf, cookieCsrf)) {
      return NextResponse.json(
        { error: "invalid_csrf_token" },
        { status: 403, headers: formatRateLimitHeaders(rl) }
      );
    }

    if (!verifySolanaSignature(signature, message, wallet)) {
      return NextResponse.json(
        { error: "invalid_signature" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      return NextResponse.json(
        { error: "server_config_error" },
        { status: 500, headers: formatRateLimitHeaders(rl) }
      );
    }

    const [user] = await db
      .insert(users)
      .values({ wallet })
      .onConflictDoUpdate({
        target: users.wallet,
        set: { updatedAt: new Date() },
      })
      .returning();

    const accessToken = jwt.sign(
      { 
        userId: user.id, 
        wallet: user.wallet,
        iat: Math.floor(Date.now() / 1000),
      },
      jwtSecret,
      {
        expiresIn: "15m",
        issuer: "tanjo-store",
        audience: "tanjo-users",
        jwtid: `${user.id}-${Date.now()}`,
      }
    );

    const refreshToken = jwt.sign(
      { 
        userId: user.id, 
        wallet: user.wallet,
        iat: Math.floor(Date.now() / 1000),
      },
      jwtSecret,
      {
        expiresIn: "7d",
        issuer: "tanjo-store",
        audience: "tanjo-users",
        jwtid: `${user.id}-refresh-${Date.now()}`,
      }
    );

    const newCsrfToken = generateCSRFToken();
    const isProd = process.env.NODE_ENV === "production";

    const response = NextResponse.json(
      { 
        success: true, 
        user: { wallet: user.wallet }, 
        csrfToken: newCsrfToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
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

    return response;

  } catch (error) {
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "verification_failed" : "internal_error" },
      { status: 500 }
    );
  }
}