// src/core/auth/lib/auth.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export { verifyCSRF } from "./csrf";

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
    }) as { userId: string; wallet: string; type?: string };

    if (decoded.type !== "access") {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    return { user: decoded };
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}