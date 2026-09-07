// src/core/lib/factionPromo.ts
import { db } from "@/core/database";
import { factions } from "@/core/database/schema";
import { and, eq, lt, sql } from "drizzle-orm";
import { getTokenByCa } from "@/core/lib/dexscreener";
import { getTokenBalance } from "@/core/blockchain";

export const DEFAULT_PROMO_SEATS = 100;
export const PROMO_SEAT_PACK_SIZE = 50;
export const MIN_PROMO_HOLD_USD_CENTS = 100;

export type HoldingCheck =
  | { ok: true; balance: number; priceUsd: number; valueUsdCents: number; minTokens: number }
  | { ok: false; error: "price_unavailable" | "balance_check_failed" };

export function seatsRemaining(faction: { promoSeats: number; promoSeatsUsed: number }): number {
  return Math.max(faction.promoSeats - faction.promoSeatsUsed, 0);
}

export function minHoldUsdCents(faction: { promoMinUsdCents: number }): number {
  return Math.max(faction.promoMinUsdCents, MIN_PROMO_HOLD_USD_CENTS);
}

export async function getTokenPriceUsd(tokenCa: string): Promise<number | null> {
  const token = await getTokenByCa(tokenCa);
  const price = Number(token?.price);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export async function evaluateHolding(params: {
  wallet: string;
  tokenCa: string;
  minUsdCents: number;
}): Promise<HoldingCheck> {
  const priceUsd = await getTokenPriceUsd(params.tokenCa);
  if (priceUsd === null) {
    return { ok: false, error: "price_unavailable" };
  }

  let balance: number;
  try {
    balance = await getTokenBalance(params.wallet, params.tokenCa);
  } catch (err) {
    console.error("[factionPromo] balance check failed:", err);
    return { ok: false, error: "balance_check_failed" };
  }

  return {
    ok: true,
    balance,
    priceUsd,
    valueUsdCents: Math.floor(balance * priceUsd * 100),
    minTokens: params.minUsdCents / 100 / priceUsd,
  };
}

export async function claimPromoSeat(factionId: string): Promise<boolean> {
  const claimed = await db
    .update(factions)
    .set({ promoSeatsUsed: sql`${factions.promoSeatsUsed} + 1` })
    .where(and(eq(factions.id, factionId), lt(factions.promoSeatsUsed, factions.promoSeats)))
    .returning({ used: factions.promoSeatsUsed });

  return claimed.length > 0;
}

export async function releasePromoSeat(factionId: string): Promise<void> {
  await db
    .update(factions)
    .set({ promoSeatsUsed: sql`GREATEST(${factions.promoSeatsUsed} - 1, 0)` })
    .where(eq(factions.id, factionId));
}
