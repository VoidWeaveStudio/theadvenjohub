// src/core/lib/factionSlug.ts
import { db } from "@/core/database";
import { factions } from "@/core/database/schema";
import { and, eq, inArray } from "drizzle-orm";

const MAX_SLUG_LENGTH = 20;
const SUFFIX_ATTEMPTS = 6;

export function normalizeSlug(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, MAX_SLUG_LENGTH);
}

export function normalizeHandle(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/[^A-Za-z0-9-]/g, "").toUpperCase().slice(0, 32);
}

export function slugCandidates(symbol: string | null | undefined, name: string | null | undefined): string[] {
  const base = normalizeSlug(symbol) || normalizeSlug(name);
  if (!base) return [];

  const candidates = [base];
  for (let i = 2; i <= SUFFIX_ATTEMPTS; i++) {
    candidates.push(`${base.slice(0, MAX_SLUG_LENGTH - 2)}-${i}`);
  }
  return candidates;
}

export async function pickAvailableSlug(
  gameId: string,
  symbol: string | null | undefined,
  name: string | null | undefined
): Promise<string[]> {
  const candidates = slugCandidates(symbol, name);
  if (candidates.length === 0) return [];

  const taken = await db
    .select({ slug: factions.slug })
    .from(factions)
    .where(and(eq(factions.gameId, gameId), inArray(factions.slug, candidates)));

  const takenSet = new Set(taken.map((row) => row.slug));
  const free = candidates.filter((candidate) => !takenSet.has(candidate));

  return free.length > 0 ? free : candidates;
}

export function fallbackSlug(factionNumber: number): string {
  return `F${factionNumber}`;
}
