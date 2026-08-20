// app/api/game/shop-prices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { SHOP_CATALOG } from "@/core/lib/shopCatalog";
import { loadPrices, payableTnjFor, resolveGameId } from "@/core/lib/shopPricing";
import { getTnjUsdPrice } from "@/core/lib/tnjPricing";

export async function GET(req: NextRequest) {
    try {
        const slug = new URL(req.url).searchParams.get("gameSlug");
        const gameId = await resolveGameId(slug);
        if (!gameId) {
            return NextResponse.json({ error: "game_not_found" }, { status: 404 });
        }

        const prices = await loadPrices(gameId);
        const tnjUsd = await getTnjUsdPrice();

        return NextResponse.json({
            tnjUsdPrice: tnjUsd,
            quotedAt: Date.now(),
            items: await Promise.all(SHOP_CATALOG.map(async (entry) => {
                const price = prices.get(entry.itemId)!;
                return {
                    itemId: entry.itemId,
                    name: entry.name,
                    kind: entry.kind,
                    maxOwned: entry.maxOwned,
                    currency: price.currency,
                    priceAsh: price.priceAsh,
                    priceTnj: price.priceTnj,
                    priceUsdCents: price.priceUsdCents,
                    payableTnj: await payableTnjFor(price),
                    enabled: price.enabled,
                };
            })),
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[game/shop-prices] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
