//src\core\auth\lib\csrf.ts
import { randomBytes } from "crypto";

const CSRF_SECRET = process.env.CSRF_SECRET || randomBytes(32).toString("hex");

export function generateCSRFToken(): string {
  return randomBytes(32).toString("hex");
}

export function verifyCSRFToken(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  return token.length === 64 && /^[0-9a-f]+$/.test(token);
}

export function getCSRFSecret(): string {
  return CSRF_SECRET;
}