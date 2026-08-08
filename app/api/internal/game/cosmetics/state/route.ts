// app/api/internal/game/cosmetics/state/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { gameCosmetics, gameCosmeticLoadouts } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";
import { normalizeLoadout } from "@/features/game/data/cosmetics";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId } = body;

        if (!userId || !gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const owned = await db
            .select({ itemId: gameCosmetics.itemId })
            .from(gameCosmetics)
            .where(and(eq(gameCosmetics.userId, userId), eq(gameCosmetics.gameId, gameId)));

        const loadout = await db.query.gameCosmeticLoadouts.findFirst({
            where: and(eq(gameCosmeticLoadouts.userId, userId), eq(gameCosmeticLoadouts.gameId, gameId)),
        });

        const normalized = normalizeLoadout(loadout?.skinId, loadout?.accessoryId);
        const ownedIds = owned.map((o) => o.itemId);

        return NextResponse.json({
            owned: ownedIds,
            skinId: normalized.skinId && ownedIds.includes(normalized.skinId) ? normalized.skinId : null,
            accessoryId: normalized.accessoryId && ownedIds.includes(normalized.accessoryId) ? normalized.accessoryId : null,
        });
    } catch (error) {
        console.error("[internal/cosmetics/state] Error:", error);
        return NextResponse.json({ error: "state_failed" }, { status: 500 });
    }
}
