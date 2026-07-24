// src/core/auth/lib/csrf.ts
import { randomBytes, timingSafeEqual } from "crypto";

const CSRF_SECRET = process.env.CSRF_SECRET!;

if (process.env.NODE_ENV === "production" && !CSRF_SECRET) {
  throw new Error("CSRF_SECRET is required in production");
}

export function generateCSRFToken(): string {
  return randomBytes(32).toString("hex");
}

export function verifyCSRFToken(headerToken: string, cookieToken: string): boolean {
  if (!headerToken || !cookieToken || typeof headerToken !== "string" || typeof cookieToken !== "string") {
    return false;
  }
  
  if (headerToken.length !== 64 || cookieToken.length !== 64) return false;
  if (!/^[0-9a-f]+$/.test(headerToken) || !/^[0-9a-f]+$/.test(cookieToken)) return false;
  
  return timingSafeEqual(
    Buffer.from(headerToken, 'hex'), 
    Buffer.from(cookieToken, 'hex')
  );
}

export function verifyCSRF(req: Request): boolean {
  const headerToken = req.headers.get("x-csrf-token");
  const cookieToken = req.headers.get("cookie")
    ?.split(";")
    .find((c) => c.trim().startsWith("csrf_token="))
    ?.split("=")[1];
  
  return !!(headerToken && cookieToken && verifyCSRFToken(headerToken, cookieToken));
}

export function getCSRFSecret(): string {
  return CSRF_SECRET;
}