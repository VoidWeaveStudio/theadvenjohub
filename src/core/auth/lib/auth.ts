// src/core/auth/lib/auth.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { timingSafeEqual } from "crypto";

export interface AuthResult {
  user: { userId: string; wallet: string };
}

export async function requireAuth(
  req: NextRequest
): Promise<AuthResult | NextResponse> {
  const authHeader = req.headers.get("authorization");
  let token: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  if (!token) {
    token = req.cookies.get("token")?.value;
  }

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: "tanjo-store",
      audience: "tanjo-users"
    }) as { userId: string; wallet: string };
    return { user: decoded };
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}

export function verifyCSRF(req: NextRequest): boolean {
  const csrfToken = req.headers.get("x-csrf-token");
  const cookieToken = req.cookies.get("csrf_token")?.value;

  if (!csrfToken || !cookieToken || typeof csrfToken !== "string" || typeof cookieToken !== "string") {
    return false;
  }

  if (csrfToken.length !== 64 || cookieToken.length !== 64) return false;
  if (!/^[0-9a-f]+$/.test(csrfToken) || !/^[0-9a-f]+$/.test(cookieToken)) return false;

  try {
    return timingSafeEqual(
      Buffer.from(csrfToken, 'hex'),
      Buffer.from(cookieToken, 'hex')
    );
  } catch {
    return false;
  }
}