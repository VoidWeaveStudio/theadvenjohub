// app/api/internal/game/faction/quest/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionQuests, factionQuestCompletions } from "@/core/database/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { gameId, viewerUserId, limit } = body;

        if (!gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const cappedLimit = Number.isInteger(limit) && limit > 0 && limit <= 100 ? limit : 50;

        const rows = await db
            .select({
                id: factionQuests.id,
                factionId: factionQuests.factionId,
                factionName: factions.name,
                factionSymbol: factions.symbol,
                factionImage: factions.image,
                factionTokenCa: factions.tokenCa,
                createdByUserId: factionQuests.createdByUserId,
                questType: factionQuests.questType,
                targetUrl: factionQuests.targetUrl,
                rewardAsh: factionQuests.rewardAsh,
                slotsTotal: factionQuests.slotsTotal,
                slotsClaimed: factionQuests.slotsClaimed,
                createdAt: factionQuests.createdAt,
                completedByViewerAt: factionQuestCompletions.completedAt,
            })
            .from(factionQuests)
            .innerJoin(factions, eq(factions.id, factionQuests.factionId))
            .leftJoin(
                factionQuestCompletions,
                viewerUserId
                    ? and(
                        eq(factionQuestCompletions.questId, factionQuests.id),
                        eq(factionQuestCompletions.userId, viewerUserId)
                    )
                    : sql`false`
            )
            .where(and(eq(factionQuests.gameId, gameId), eq(factionQuests.status, "active")))
            .orderBy(desc(factionQuests.createdAt))
            .limit(cappedLimit);

        return NextResponse.json({
            quests: rows.map((r) => ({
                id: r.id,
                factionId: r.factionId,
                factionName: r.factionName,
                factionSymbol: r.factionSymbol,
                factionImage: r.factionImage,
                factionTokenCa: r.factionTokenCa,
                questType: r.questType,
                targetUrl: r.targetUrl,
                rewardAsh: r.rewardAsh,
                slotsTotal: r.slotsTotal,
                slotsClaimed: r.slotsClaimed,
                slotsRemaining: Math.max(0, r.slotsTotal - r.slotsClaimed),
                isOwnQuest: !!viewerUserId && r.createdByUserId === viewerUserId,
                completedByMe: !!r.completedByViewerAt,
                createdAt: r.createdAt,
            })),
        });
    } catch (error) {
        console.error("[internal/faction/quest/list] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
