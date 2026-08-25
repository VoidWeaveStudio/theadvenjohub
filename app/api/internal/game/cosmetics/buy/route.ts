// app/api/internal/game/cosmetics/buy/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { gameCosmetics } from "@/core/database/schema";
import { isCosmeticId } from "@/features/game/data/cosmetics";
import { loadPrice } from "@/core/lib/shopPricing";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, itemId } = body;

        if (!userId || !gameId || !isCosmeticId(itemId)) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const price = await loadPrice(gameId, itemId);
        if (!price || price.enabled === false) {
            return NextResponse.json({ error: "not_for_sale" }, { status: 403 });
        }
        if (price.currency !== "ash") {
            return NextResponse.json({ error: "tnj_only" }, { status: 403 });
        }

        try {
            await db.insert(gameCosmetics).values({
                userId,
                gameId,
                itemId,
                pricePaidAsh: price.priceAsh,
            });
        } catch (insertError: any) {
            if (insertError?.code === "23505") {
                return NextResponse.json({ error: "already_owned" }, { status: 409 });
            }
            throw insertError;
        }

        return NextResponse.json({ success: true, itemId, priceAsh: price.priceAsh });
    } catch (error) {
        console.error("[internal/cosmetics/buy] Error:", error);
        return NextResponse.json({ error: "buy_failed" }, { status: 500 });
    }
}
