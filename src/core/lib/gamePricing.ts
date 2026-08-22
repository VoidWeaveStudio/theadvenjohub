// src/core/lib/gamePricing.ts
import { TNJ_QUOTE_TOLERANCE, quoteUsdCentsInTnj } from "@/core/lib/tnjPricing";

export const GAME_PRICE_CURRENCIES = ["tnj", "usdt"] as const;
export type GamePriceCurrency = (typeof GAME_PRICE_CURRENCIES)[number];

export function isGamePriceCurrency(value: unknown): value is GamePriceCurrency {
    return typeof value === "string" && (GAME_PRICE_CURRENCIES as readonly string[]).includes(value);
}

export const GAME_PRICE_USD_CENTS_CAP = 100_000_000;

export interface GamePriceRow {
    price: number;
    priceCurrency: string;
    priceUsdCents: number;
}

export interface ResolvedGamePrice {
    currency: GamePriceCurrency;
    // What the buyer actually sends. Null when the game is priced in USDT and
    // the rate feed is unavailable — callers must refuse the sale rather than
    // guess an amount.
    payableTnj: number | null;
    priceUsdCents: number;
    // True while the TNJ figure is derived from a live rate, so the storefront
    // must not treat a drifted quote as tampering.
    dynamic: boolean;
}

// USDT is treated as 1:1 with the USD price feed that already backs the in-game
// shop (dexscreener's priceUsd for the TNJ mint). There is no separate USDT
// oracle in the project, and the pair TNJ trades against is USDT anyway.
export async function resolveGamePrice(game: GamePriceRow): Promise<ResolvedGamePrice> {
    if (game.priceCurrency !== "usdt") {
        return {
            currency: "tnj",
            payableTnj: game.price,
            priceUsdCents: 0,
            dynamic: false,
        };
    }

    const quote = await quoteUsdCentsInTnj(game.priceUsdCents);

    return {
        currency: "usdt",
        payableTnj: quote?.tnjAmount ?? null,
        priceUsdCents: game.priceUsdCents,
        dynamic: true,
    };
}

// The amount the on-chain payment is checked against. A fixed TNJ price is
// exact, as it has always been; a USDT price gets the same slack the shop uses,
// because the rate can move between the quote and the signed transaction.
export function expectedAmountFor(resolved: ResolvedGamePrice): number | null {
    if (resolved.payableTnj === null || resolved.payableTnj <= 0) return null;
    if (!resolved.dynamic) return resolved.payableTnj;
    return Math.max(1, Math.floor(resolved.payableTnj * (1 - TNJ_QUOTE_TOLERANCE)));
}

export function formatUsdCents(cents: number): string {
    return (cents / 100).toFixed(2);
}
