// app/api/internal/game/cosmetics/grant/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { gameCosmetics } from "@/core/database/schema";
import { isCosmeticId } from "@/features/game/data/cosmetics";

// Cosmetics the game server hands out for world content — currently quest
// rewards. Unlike the buy route this charges nothing, so it never consults the
// shop price and an item that is not for sale can still be a reward.
export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const { userId, gameId, itemId } = await req.json();

        if (!userId || !gameId || !isCosmeticId(itemId)) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const inserted = await db
            .insert(gameCosmetics)
            .values({ userId, gameId, itemId, pricePaidAsh: 0 })
            .onConflictDoNothing()
            .returning({ id: gameCosmetics.id });

        return NextResponse.json({ success: true, itemId, alreadyOwned: inserted.length === 0 });
    } catch (error) {
        console.error("[internal/cosmetics/grant] Error:", error);
        return NextResponse.json({ error: "grant_failed" }, { status: 500 });
    }
}
