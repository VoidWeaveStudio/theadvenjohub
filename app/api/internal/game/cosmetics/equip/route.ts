// app/api/internal/game/cosmetics/equip/route.ts
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

        const requested = normalizeLoadout(body.skinId, body.accessoryId);

        const owned = await db
            .select({ itemId: gameCosmetics.itemId })
            .from(gameCosmetics)
            .where(and(eq(gameCosmetics.userId, userId), eq(gameCosmetics.gameId, gameId)));
        const ownedIds = new Set(owned.map((o) => o.itemId));

        if (requested.skinId && !ownedIds.has(requested.skinId)) {
            return NextResponse.json({ error: "not_owned" }, { status: 403 });
        }
        if (requested.accessoryId && !ownedIds.has(requested.accessoryId)) {
            return NextResponse.json({ error: "not_owned" }, { status: 403 });
        }

        const existing = await db.query.gameCosmeticLoadouts.findFirst({
            where: and(eq(gameCosmeticLoadouts.userId, userId), eq(gameCosmeticLoadouts.gameId, gameId)),
        });

        if (existing) {
            await db
                .update(gameCosmeticLoadouts)
                .set({ skinId: requested.skinId, accessoryId: requested.accessoryId, updatedAt: new Date() })
                .where(eq(gameCosmeticLoadouts.id, existing.id));
        } else {
            await db.insert(gameCosmeticLoadouts).values({
                userId,
                gameId,
                skinId: requested.skinId,
                accessoryId: requested.accessoryId,
            });
        }

        return NextResponse.json({ success: true, skinId: requested.skinId, accessoryId: requested.accessoryId });
    } catch (error) {
        console.error("[internal/cosmetics/equip] Error:", error);
        return NextResponse.json({ error: "equip_failed" }, { status: 500 });
    }
}
