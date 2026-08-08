// app/api/admin/shop-prices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { db } from "@/core/database";
import { shopItemPrices } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";
import { SHOP_CATALOG, SHOP_CATALOG_BY_ID } from "@/core/lib/shopCatalog";
import { loadPrices, resolveGameId } from "@/core/lib/shopPricing";
import { getTnjUsdPrice } from "@/core/lib/tnjPricing";

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

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
            items: SHOP_CATALOG.map((entry) => {
                const price = prices.get(entry.itemId)!;
                return {
                    itemId: entry.itemId,
                    name: entry.name,
                    kind: entry.kind,
                    description: entry.description,
                    maxOwned: entry.maxOwned,
                    currency: price.currency,
                    priceAsh: price.priceAsh,
                    priceTnj: price.priceTnj,
                    priceUsdCents: price.priceUsdCents,
                    enabled: price.enabled,
                    tnjEstimate: price.currency === "usd" && tnjUsd
                        ? Math.ceil(price.priceUsdCents / 100 / tnjUsd)
                        : null,
                };
            }),
        });
    } catch (error) {
        console.error("[admin/shop-prices] GET Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const body = await req.json();
        const { itemId, currency, priceAsh, priceTnj, priceUsdCents, enabled, gameSlug } = body;

        if (!SHOP_CATALOG_BY_ID.has(itemId)) {
            return NextResponse.json({ error: "unknown_item" }, { status: 400 });
        }
        if (!["ash", "tnj", "usd"].includes(currency)) {
            return NextResponse.json({ error: "invalid_currency" }, { status: 400 });
        }
        if (!Number.isInteger(priceAsh) || priceAsh < 0 || priceAsh > 10_000_000) {
            return NextResponse.json({ error: "invalid_price_ash" }, { status: 400 });
        }
        if (!Number.isInteger(priceTnj) || priceTnj < 0 || priceTnj > 1_000_000_000) {
            return NextResponse.json({ error: "invalid_price_tnj" }, { status: 400 });
        }
        if (!Number.isInteger(priceUsdCents) || priceUsdCents < 0 || priceUsdCents > 10_000_000) {
            return NextResponse.json({ error: "invalid_price_usd" }, { status: 400 });
        }

        const sigError = verifyAdminAction(req, body, "shop_price_set", itemId);
        if (sigError) return sigError;

        const gameId = await resolveGameId(typeof gameSlug === "string" ? gameSlug : null);
        if (!gameId) {
            return NextResponse.json({ error: "game_not_found" }, { status: 404 });
        }

        const existing = await db.query.shopItemPrices.findFirst({
            where: and(eq(shopItemPrices.gameId, gameId), eq(shopItemPrices.itemId, itemId)),
        });

        const values = { currency, priceAsh, priceTnj, priceUsdCents, enabled: enabled !== false, updatedAt: new Date() };

        if (existing) {
            await db.update(shopItemPrices).set(values).where(eq(shopItemPrices.id, existing.id));
        } else {
            await db.insert(shopItemPrices).values({ gameId, itemId, ...values });
        }

        return NextResponse.json({ success: true, itemId, ...values });
    } catch (error) {
        console.error("[admin/shop-prices] PATCH Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
