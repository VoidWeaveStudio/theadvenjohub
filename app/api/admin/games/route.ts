// app/api/admin/games/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { db } from "@/core/database";
import { games } from "@/core/database/schema";
import { asc, eq } from "drizzle-orm";
import { getTnjUsdPrice } from "@/core/lib/tnjPricing";
import { GAME_PRICE_USD_CENTS_CAP, isGamePriceCurrency } from "@/core/lib/gamePricing";

const MAX_PRICE_TNJ = 1_000_000_000;

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const rows = await db
            .select({
                id: games.id,
                slug: games.slug,
                title: games.title,
                price: games.price,
                priceCurrency: games.priceCurrency,
                priceUsdCents: games.priceUsdCents,
                isActive: games.isActive,
                status: games.status,
            })
            .from(games)
            .orderBy(asc(games.title));

        const tnjUsd = await getTnjUsdPrice();

        return NextResponse.json({
            tnjUsdPrice: tnjUsd,
            games: rows.map((row) => ({
                ...row,
                // What a buyer would send right now, so the admin can sanity-check
                // a USDT price against the TNJ it actually costs.
                tnjEstimate: row.priceCurrency === "usdt" && tnjUsd
                    ? Math.ceil(row.priceUsdCents / 100 / tnjUsd)
                    : null,
            })),
        });
    } catch (error) {
        console.error("[admin/games] GET Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const body = await req.json();
        const slug = typeof body.slug === "string" ? body.slug : "";
        if (slug.length === 0) return NextResponse.json({ error: "invalid_slug" }, { status: 400 });

        const sigError = await verifyAdminAction(req, body, "game_price_set", `game:${slug}`);
        if (sigError) return sigError;

        if (!isGamePriceCurrency(body.priceCurrency)) {
            return NextResponse.json({ error: "invalid_currency" }, { status: 400 });
        }

        const price = Math.floor(Number(body.price));
        if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE_TNJ) {
            return NextResponse.json({ error: "invalid_price" }, { status: 400 });
        }

        const priceUsdCents = Math.round(Number(body.priceUsdCents));
        if (!Number.isFinite(priceUsdCents) || priceUsdCents < 0 || priceUsdCents > GAME_PRICE_USD_CENTS_CAP) {
            return NextResponse.json({ error: "invalid_usd_price" }, { status: 400 });
        }

        const game = await db.query.games.findFirst({ where: eq(games.slug, slug) });
        if (!game) return NextResponse.json({ error: "game_not_found" }, { status: 404 });

        await db
            .update(games)
            .set({
                price,
                priceCurrency: body.priceCurrency,
                priceUsdCents,
                updatedAt: new Date(),
            })
            .where(eq(games.id, game.id));

        return NextResponse.json({ success: true, slug });
    } catch (error) {
        console.error("[admin/games] PATCH Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
