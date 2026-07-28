// app/api/internal/game/faction/claim-creator/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionMembers } from "@/core/database/schema";
import { eq, and, count } from "drizzle-orm";
import { getFactionRank } from "@/core/lib/factionRank";
import { buildFactionTaskExtras } from "@/core/lib/factionDetail";
import { getTokenCreatorWallet } from "@/core/blockchain";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, wallet, factionId } = body;

        if (!userId || !gameId || !wallet || !factionId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const membership = await db.query.factionMembers.findFirst({
            where: and(eq(factionMembers.userId, userId), eq(factionMembers.gameId, gameId)),
        });
        if (!membership || membership.factionId !== factionId) {
            return NextResponse.json({ error: "not_a_member" }, { status: 403 });
        }

        let faction = await db.query.factions.findFirst({
            where: and(eq(factions.id, factionId), eq(factions.gameId, gameId)),
        });
        if (!faction) {
            return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        }
        if (!faction.tokenCa) {
            return NextResponse.json({ error: "no_token" }, { status: 400 });
        }

        let creatorWallet = faction.tokenCreatorWallet;
        if (!creatorWallet) {
            creatorWallet = await getTokenCreatorWallet(faction.tokenCa);
            if (creatorWallet) {
                [faction] = await db
                    .update(factions)
                    .set({ tokenCreatorWallet: creatorWallet })
                    .where(eq(factions.id, factionId))
                    .returning();
            }
        }

        const isCreator = !!creatorWallet && creatorWallet === wallet;

        if (isCreator && faction.verifiedCreatorUserId !== userId) {
            [faction] = await db
                .update(factions)
                .set({ verifiedCreatorUserId: userId, verifiedCreatorWallet: wallet })
                .where(eq(factions.id, factionId))
                .returning();
        }

        const [{ memberCount }] = await db
            .select({ memberCount: count() })
            .from(factionMembers)
            .where(eq(factionMembers.factionId, factionId));
        const rank = await getFactionRank(gameId, factionId);
        const taskExtras = await buildFactionTaskExtras(faction, gameId);

        return NextResponse.json({
            success: true,
            isCreator,
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
                ...taskExtras,
            },
        });
    } catch (error) {
        console.error("[internal/faction/claim-creator] Error:", error);
        return NextResponse.json({ error: "claim_failed" }, { status: 500 });
    }
}
