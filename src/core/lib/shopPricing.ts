// src/core/lib/shopPricing.ts
import { db } from "@/core/database";
import { shopItemPrices, games } from "@/core/database/schema";
import { asc, eq } from "drizzle-orm";
import { DEFAULT_GAME_SLUG } from "@/core/lib/defaultGame";
import { SHOP_CATALOG, SHOP_CATALOG_BY_ID, ResolvedPrice, ShopCurrency, defaultPrice } from "@/core/lib/shopCatalog";
import { quoteUsdCentsInTnj } from "@/core/lib/tnjPricing";

export async function resolveGameId(slug?: string | null): Promise<string | null> {
    const target = slug && slug.length > 0 ? slug : DEFAULT_GAME_SLUG;
    const game = await db.query.games.findFirst({ where: eq(games.slug, target) });
    if (game) return game.id;

    const fallback = await db.query.games.findFirst({ orderBy: asc(games.createdAt) });
    return fallback?.id ?? null;
}

export async function loadPrices(gameId: string): Promise<Map<string, ResolvedPrice>> {
    const rows = await db
        .select()
        .from(shopItemPrices)
        .where(eq(shopItemPrices.gameId, gameId));

    const overrides = new Map(rows.map((r) => [r.itemId, r]));
    const result = new Map<string, ResolvedPrice>();

    for (const entry of SHOP_CATALOG) {
        const row = overrides.get(entry.itemId);
        if (!row) {
            result.set(entry.itemId, defaultPrice(entry));
            continue;
        }
        result.set(entry.itemId, {
            itemId: entry.itemId,
            currency: (["ash", "tnj", "usd"].includes(row.currency) ? row.currency : "ash") as ShopCurrency,
            priceAsh: row.priceAsh,
            priceTnj: row.priceTnj,
            priceUsdCents: row.priceUsdCents,
            enabled: row.enabled,
        });
    }

    return result;
}

export async function loadPrice(gameId: string, itemId: string): Promise<ResolvedPrice | null> {
    const entry = SHOP_CATALOG_BY_ID.get(itemId);
    if (!entry) return null;
    const prices = await loadPrices(gameId);
    return prices.get(itemId) ?? defaultPrice(entry);
}

export async function payableTnjFor(price: ResolvedPrice): Promise<number | null> {
    if (price.currency === "tnj") return price.priceTnj > 0 ? price.priceTnj : null;
    if (price.currency !== "usd") return null;
    const quote = await quoteUsdCentsInTnj(price.priceUsdCents);
    return quote?.tnjAmount ?? null;
}
