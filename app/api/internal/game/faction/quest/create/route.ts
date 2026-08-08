// app/api/internal/game/faction/quest/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionQuests } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";
import {
    isValidXPostUrl,
    questTotalCostAsh,
    QUEST_LISTING_FEE_ASH,
    QUEST_MIN_SLOTS,
    QUEST_MAX_SLOTS,
    QUEST_MIN_REWARD_ASH,
    QUEST_MAX_REWARD_ASH,
} from "@/core/lib/factionQuests";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, wallet, factionId, targetUrl, slotsTotal, rewardAsh } = body;

        if (!userId || !gameId || !wallet || !factionId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }
        if (!isValidXPostUrl(targetUrl)) {
            return NextResponse.json({ error: "invalid_post_url" }, { status: 400 });
        }
        if (!Number.isInteger(slotsTotal) || slotsTotal < QUEST_MIN_SLOTS || slotsTotal > QUEST_MAX_SLOTS) {
            return NextResponse.json({ error: "invalid_slots" }, { status: 400 });
        }
        if (!Number.isInteger(rewardAsh) || rewardAsh < QUEST_MIN_REWARD_ASH || rewardAsh > QUEST_MAX_REWARD_ASH) {
            return NextResponse.json({ error: "invalid_reward" }, { status: 400 });
        }

        const faction = await db.query.factions.findFirst({
            where: and(eq(factions.id, factionId), eq(factions.gameId, gameId)),
        });
        if (!faction) {
            return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        }

        if (!faction.verifiedCreatorUserId || faction.verifiedCreatorUserId !== userId) {
            return NextResponse.json({ error: "not_verified_creator" }, { status: 403 });
        }

        const bankAsh = slotsTotal * rewardAsh;

        const [created] = await db.insert(factionQuests).values({
            factionId,
            gameId,
            createdByUserId: userId,
            createdByWallet: wallet,
            questType: "x_post_view",
            targetUrl: String(targetUrl).trim().slice(0, 512),
            rewardAsh,
            slotsTotal,
            bankAsh,
            listingFeeAsh: QUEST_LISTING_FEE_ASH,
        }).returning();

        return NextResponse.json({
            success: true,
            chargedAsh: questTotalCostAsh(slotsTotal, rewardAsh),
            quest: {
                id: created.id,
                factionId: created.factionId,
                factionName: faction.name,
                factionSymbol: faction.symbol,
                factionImage: faction.image,
                factionTokenCa: faction.tokenCa,
                questType: created.questType,
                targetUrl: created.targetUrl,
                rewardAsh: created.rewardAsh,
                slotsTotal: created.slotsTotal,
                slotsClaimed: created.slotsClaimed,
                slotsRemaining: created.slotsTotal - created.slotsClaimed,
                bankAsh: created.bankAsh,
                paidOutAsh: created.paidOutAsh,
                bankRemainingAsh: created.bankAsh - created.paidOutAsh,
                listingFeeAsh: created.listingFeeAsh,
                status: created.status,
                createdAt: created.createdAt,
                completedAt: created.completedAt,
            },
        });
    } catch (error) {
        console.error("[internal/faction/quest/create] Error:", error);
        return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }
}
