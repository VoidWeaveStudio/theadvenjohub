// src/core/lib/tnjPricing.ts
import { getTokenByCa } from "@/core/lib/dexscreener";
import { getCache, setCache } from "@/core/lib/cache";

const PRICE_CACHE_KEY = "tnj:usd-price";
const PRICE_CACHE_TTL_SECONDS = 20;

export const TNJ_QUOTE_TOLERANCE = 0.12;

export async function getTnjUsdPrice(): Promise<number | null> {
    const cached = await getCache<number>(PRICE_CACHE_KEY);
    if (cached !== null && cached > 0) return cached;

    const mint = process.env.TNJ_TOKEN_MINT_ADDRESS?.trim() || process.env.NEXT_PUBLIC_TNJ_TOKEN_MINT_ADDRESS?.trim();
    if (!mint) return null;

    const token = await getTokenByCa(mint);
    const price = Number.parseFloat(String(token?.price ?? ""));
    if (!Number.isFinite(price) || price <= 0) return null;

    await setCache(PRICE_CACHE_KEY, price, PRICE_CACHE_TTL_SECONDS);
    return price;
}

export interface TnjQuote {
    priceUsd: number;
    tnjAmount: number;
    usdCents: number;
    quotedAt: number;
}

export async function quoteUsdCentsInTnj(usdCents: number): Promise<TnjQuote | null> {
    if (!Number.isFinite(usdCents) || usdCents <= 0) return null;
    const priceUsd = await getTnjUsdPrice();
    if (!priceUsd) return null;

    return {
        priceUsd,
        usdCents,
        tnjAmount: Math.ceil(usdCents / 100 / priceUsd),
        quotedAt: Date.now(),
    };
}

export function isAcceptableTnjAmount(paidTnj: number, requiredTnj: number): boolean {
    if (!Number.isFinite(paidTnj) || !Number.isFinite(requiredTnj) || requiredTnj <= 0) return false;
    return paidTnj >= Math.floor(requiredTnj * (1 - TNJ_QUOTE_TOLERANCE));
}
