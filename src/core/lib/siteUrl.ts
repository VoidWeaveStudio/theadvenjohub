// src/core/lib/siteUrl.ts
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://theadvenjo.online";

export function absoluteUrl(pathname: string): string {
  return `${SITE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export function factionPageUrl(slug: string): string {
  return absoluteUrl(`/f/${slug}`);
}
