// app/api/internal/game/faction/my-faction/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionMembers } from "@/core/database/schema";
import { eq, and, count } from "drizzle-orm";
import { getFactionRank } from "@/core/lib/factionRank";
import { buildFactionTaskExtras } from "@/core/lib/factionDetail";

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

        const membership = await db.query.factionMembers.findFirst({
            where: and(eq(factionMembers.userId, userId), eq(factionMembers.gameId, gameId)),
        });

        if (!membership) {
            return NextResponse.json({ faction: null });
        }

        const faction = await db.query.factions.findFirst({
            where: eq(factions.id, membership.factionId),
        });

        if (!faction) {
            return NextResponse.json({ faction: null });
        }

        const [{ memberCount }] = await db
            .select({ memberCount: count() })
            .from(factionMembers)
            .where(eq(factionMembers.factionId, faction.id));

        const rank = await getFactionRank(gameId, faction.id);
        const taskExtras = await buildFactionTaskExtras(faction, gameId);

        return NextResponse.json({
            faction: {
                id: faction.id,
                number: faction.number,
                name: faction.name,
                symbol: faction.symbol,
                image: faction.image,
                description: faction.description,
                tokenCa: faction.tokenCa,
                founderWallet: faction.founderWallet,
                memberCount,
                rank,
                role: membership.role,
                ...taskExtras,
            },
        });
    } catch (error) {
        console.error("[internal/faction/my-faction] Error:", error);
        return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
    }
}
