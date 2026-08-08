// app/api/internal/game/faction/quest/faction-list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionQuests, factionMembers } from "@/core/database/schema";
import { eq, and, desc } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { gameId, factionId, userId } = body;

        if (!gameId || !factionId || !userId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const faction = await db.query.factions.findFirst({
            where: and(eq(factions.id, factionId), eq(factions.gameId, gameId)),
        });
        if (!faction) {
            return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        }

        const membership = await db.query.factionMembers.findFirst({
            where: and(eq(factionMembers.userId, userId), eq(factionMembers.factionId, factionId)),
        });
        if (!membership) {
            return NextResponse.json({ error: "not_a_member" }, { status: 403 });
        }

        const rows = await db
            .select()
            .from(factionQuests)
            .where(eq(factionQuests.factionId, factionId))
            .orderBy(desc(factionQuests.createdAt))
            .limit(50);

        return NextResponse.json({
            factionId,
            canManage: !!faction.verifiedCreatorUserId && faction.verifiedCreatorUserId === userId,
            quests: rows.map((q) => ({
                id: q.id,
                questType: q.questType,
                targetUrl: q.targetUrl,
                rewardAsh: q.rewardAsh,
                slotsTotal: q.slotsTotal,
                slotsClaimed: q.slotsClaimed,
                slotsRemaining: Math.max(0, q.slotsTotal - q.slotsClaimed),
                bankAsh: q.bankAsh,
                paidOutAsh: q.paidOutAsh,
                bankRemainingAsh: Math.max(0, q.bankAsh - q.paidOutAsh),
                listingFeeAsh: q.listingFeeAsh,
                status: q.status,
                createdAt: q.createdAt,
                completedAt: q.completedAt,
            })),
        });
    } catch (error) {
        console.error("[internal/faction/quest/faction-list] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
