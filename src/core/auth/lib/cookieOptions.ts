// src/core/auth/lib/cookieOptions.ts
import type { NextRequest } from "next/server";

const LEGACY_COOKIE_DOMAIN = ".theadvenjo.online";

export const SESSION_COOKIE_NAMES = ["token", "refresh_token", "csrf_token"] as const;

export type SessionCookieName = (typeof SESSION_COOKIE_NAMES)[number];

interface CookieWritable {
  headers: { append: (name: string, value: string) => void };
}

export function isProdRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function sessionCookieDomain(): string | undefined {
  const configured = process.env.SESSION_COOKIE_DOMAIN?.trim();
  return configured ? configured : undefined;
}

export function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isProdRuntime(),
    sameSite: "lax" as const,
    path: "/",
    domain: sessionCookieDomain(),
  };
}

function expiredCookie(name: string, domain?: string): string {
  const parts = [`${name}=`, "Path=/", "Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT", "SameSite=Lax"];
  if (domain) parts.push(`Domain=${domain}`);
  if (isProdRuntime()) parts.push("Secure");
  return parts.join("; ");
}

export function clearLegacyDomainCookies(
  response: CookieWritable,
  names: readonly SessionCookieName[] = SESSION_COOKIE_NAMES
): void {
  if (!isProdRuntime()) return;
  if (sessionCookieDomain() === LEGACY_COOKIE_DOMAIN) return;

  for (const name of names) {
    response.headers.append("set-cookie", expiredCookie(name, LEGACY_COOKIE_DOMAIN));
  }
}

export function clearSessionCookies(response: CookieWritable): void {
  const domain = sessionCookieDomain();

  for (const name of SESSION_COOKIE_NAMES) {
    response.headers.append("set-cookie", expiredCookie(name));
    if (domain) response.headers.append("set-cookie", expiredCookie(name, domain));
  }

  clearLegacyDomainCookies(response);
}

export function isDesktopClientRequest(req: NextRequest | Request): boolean {
  const origin = req.headers.get("origin") || "";

  if (origin.startsWith("tauri://")) return true;
  if (origin === "https://tauri.localhost" || origin === "http://tauri.localhost") return true;
  return origin.endsWith(".tauri.localhost");
}
