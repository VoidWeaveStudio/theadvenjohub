// app/api/internal/game/shop-prices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { SHOP_CATALOG } from "@/core/lib/shopCatalog";
import { loadPrices } from "@/core/lib/shopPricing";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const { gameId } = await req.json();
        if (!gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const prices = await loadPrices(gameId);

        return NextResponse.json({
            items: SHOP_CATALOG.map((entry) => {
                const price = prices.get(entry.itemId)!;
                return {
                    itemId: entry.itemId,
                    kind: entry.kind,
                    maxOwned: entry.maxOwned,
                    currency: price.currency,
                    priceAsh: price.priceAsh,
                    enabled: price.enabled,
                };
            }),
        });
    } catch (error) {
        console.error("[internal/shop-prices] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
