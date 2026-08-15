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
  const cookieMatch = req.headers.get("cookie")?.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  const cookieToken = cookieMatch ? decodeURIComponent(cookieMatch[1]) : undefined;

  return !!(headerToken && cookieToken && verifyCSRFToken(headerToken, cookieToken));
}
