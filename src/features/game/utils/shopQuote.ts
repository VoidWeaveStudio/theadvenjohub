// src/features/game/utils/shopQuote.ts
export interface ShopQuote {
    itemId: string;
    currency: "ash" | "tnj" | "usd";
    priceAsh: number;
    priceTnj: number;
    priceUsdCents: number;
    payableTnj: number | null;
    enabled: boolean;
}

export async function fetchShopQuote(itemId: string, gameSlug?: string | null): Promise<ShopQuote | null> {
    const url = gameSlug
        ? `/api/game/shop-prices?gameSlug=${encodeURIComponent(gameSlug)}`
        : "/api/game/shop-prices";

    try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        const item = (data.items || []).find((entry: ShopQuote) => entry.itemId === itemId);
        return item ?? null;
    } catch {
        return null;
    }
}

export async function fetchPayableTnj(itemId: string, gameSlug?: string | null): Promise<number> {
    const quote = await fetchShopQuote(itemId, gameSlug);
    if (!quote) throw new Error("price_unavailable");
    if (quote.enabled === false) throw new Error("not_for_sale");
    if (quote.currency === "ash") throw new Error("not_for_sale");
    if (!quote.payableTnj || quote.payableTnj <= 0) throw new Error("price_unavailable");
    return quote.payableTnj;
}
