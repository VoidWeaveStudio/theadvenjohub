// app/api/internal/game/cosmetics/buy/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { gameCosmetics } from "@/core/database/schema";
import { COSMETICS_BY_ID, isCosmeticId } from "@/features/game/data/cosmetics";

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

        const definition = COSMETICS_BY_ID.get(itemId)!;

        try {
            await db.insert(gameCosmetics).values({
                userId,
                gameId,
                itemId,
                pricePaidAsh: definition.priceAsh,
            });
        } catch (insertError: any) {
            if (insertError?.code === "23505") {
                return NextResponse.json({ error: "already_owned" }, { status: 409 });
            }
            throw insertError;
        }

        return NextResponse.json({ success: true, itemId, priceAsh: definition.priceAsh });
    } catch (error) {
        console.error("[internal/cosmetics/buy] Error:", error);
        return NextResponse.json({ error: "buy_failed" }, { status: 500 });
    }
}
