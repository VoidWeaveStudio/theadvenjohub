// src/core/auth/lib/csrf.ts
import { randomBytes, timingSafeEqual } from "crypto";

export function generateCSRFToken(): string {
  return randomBytes(32).toString("hex");
}

export function verifyCSRFToken(headerToken: string, cookieToken: string): boolean {
  if (!headerToken || !cookieToken || typeof headerToken !== "string" || typeof cookieToken !== "string") {
    return false;
  }

  if (headerToken.length !== 64 || cookieToken.length !== 64) return false;
  if (!/^[0-9a-f]+$/.test(headerToken) || !/^[0-9a-f]+$/.test(cookieToken)) return false;

  try {
    return timingSafeEqual(
      Buffer.from(headerToken, "hex"),
      Buffer.from(cookieToken, "hex")
    );
  } catch {
    return false;
  }
}

export function verifyCSRF(req: Request): boolean {
  const headerToken = req.headers.get("x-csrf-token");
  const cookieHeader = req.headers.get("cookie");
  if (!headerToken || !cookieHeader) return false;

  for (const match of cookieHeader.matchAll(/(?:^|;\s*)csrf_token=([^;]*)/g)) {
    if (verifyCSRFToken(headerToken, decodeURIComponent(match[1]))) return true;
  }

  return false;
}
