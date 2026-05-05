//app\api\auth\verify\route.ts
import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "@/core/database";
import { users } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { generateCSRFToken } from "@/core/auth/lib/csrf";
import { checkRateLimit, formatRateLimitHeaders } from "@/core/lib/rateLimit";

const authSchema = z.object({
  wallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "invalid_wallet"),
  message: z.string().min(10).max(1000),
  signature: z.string().min(80).max(100),
  nonce: z.union([
    z.string().regex(/^\d+$/, "invalid_nonce_format"),
    z.string().regex(/^[0-9a-f]{32}$/, "invalid_nonce_format"),
  ]),
  timestamp: z.number().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = authSchema.safeParse(body);

    if (!validation.success) {
      if (process.env.NODE_ENV === "development") {
        console.error("[auth] Validation failed:", validation.error.flatten());
      }
      return NextResponse.json(
        { error: "validation_failed" },
        { status: 400 }
      );
    }

    const { wallet, message, signature, nonce, timestamp } = validation.data;

    const rl = await checkRateLimit(`auth:verify:${wallet}`, {
      maxAttempts: 5,
      windowMs: 60_000,
      prefix: "api:auth:verify",
    });

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "too_many_attempts" },
        { status: 429, headers: formatRateLimitHeaders(rl) }
      );
    }

    if (timestamp && Math.abs(Date.now() - timestamp) > 300000) {
      console.warn(`[auth] Timestamp mismatch for ${wallet}: ${Math.abs(Date.now() - timestamp)}ms`);
    }

    try {
      const pubKey = new PublicKey(wallet);
      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = Uint8Array.from(Buffer.from(signature, "base64"));
      const isValid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKey.toBytes());

      if (!isValid) {
        console.error(`[auth] Invalid signature for wallet ${wallet}`);
        return NextResponse.json(
          { error: "invalid_signature" },
          { status: 401, headers: formatRateLimitHeaders(rl) }
        );
      }
    } catch (err) {
      console.error(`[auth] Signature verification error:`, err);
      return NextResponse.json(
        { error: "signature_verification_failed" },
        { status: 401, headers: formatRateLimitHeaders(rl) }
      );
    }

    const existingUsers = await db.select().from(users).where(eq(users.wallet, wallet));
    let user = existingUsers[0];

    if (!user) {
      const [newUser] = await db.insert(users).values({ wallet }).returning();
      user = newUser;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json(
        { error: "server_error" },
        { status: 500, headers: formatRateLimitHeaders(rl) }
      );
    }

    const accessToken = jwt.sign(
      { userId: user.id, wallet: user.wallet },
      jwtSecret,
      { expiresIn: "15m", issuer: "tanjo-store", audience: "tanjo-users" }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, wallet: user.wallet },
      jwtSecret,
      { expiresIn: "7d", issuer: "tanjo-store", audience: "tanjo-users" }
    );

    const csrfToken = generateCSRFToken();

    const response = NextResponse.json(
      {
        success: true,
        user: { id: user.id, wallet: user.wallet },
        csrfToken,
      },
      { headers: formatRateLimitHeaders(rl) }
    );

    const isProd = process.env.NODE_ENV === "production";
    const cookieDomain = isProd ? process.env.COOKIE_DOMAIN : undefined;

    response.cookies.set("token", accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
      domain: cookieDomain,
    });

    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
      domain: cookieDomain,
    });

    response.cookies.set("csrf_token", csrfToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: "strict",
      maxAge: 60 * 60 * 24,
      path: "/",
      domain: cookieDomain,
    });

    return response;

  } catch (error) {
    console.error("Auth verify error:", error);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}