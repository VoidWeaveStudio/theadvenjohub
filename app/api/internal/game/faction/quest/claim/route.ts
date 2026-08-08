// app/api/internal/game/faction/quest/claim/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factionQuests, factionQuestCompletions } from "@/core/database/schema";
import { eq, and, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { questId, userId, gameId, wallet } = body;

        if (!questId || !userId || !gameId || !wallet) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const quest = await db.query.factionQuests.findFirst({
            where: and(eq(factionQuests.id, questId), eq(factionQuests.gameId, gameId)),
        });
        if (!quest) {
            return NextResponse.json({ error: "quest_not_found" }, { status: 404 });
        }
        if (quest.status !== "active" || quest.slotsClaimed >= quest.slotsTotal) {
            return NextResponse.json({ error: "quest_full" }, { status: 409 });
        }
        if (quest.createdByUserId === userId) {
            return NextResponse.json({ error: "own_quest" }, { status: 403 });
        }

        let completionId: string;
        try {
            const [completion] = await db.insert(factionQuestCompletions).values({
                questId,
                userId,
                gameId,
                wallet,
                rewardAsh: quest.rewardAsh,
            }).returning();
            completionId = completion.id;
        } catch (insertError: any) {
            if (insertError?.code === "23505") {
                return NextResponse.json({ error: "already_completed" }, { status: 409 });
            }
            throw insertError;
        }

        const [reserved] = await db
            .update(factionQuests)
            .set({
                slotsClaimed: sql`${factionQuests.slotsClaimed} + 1`,
                paidOutAsh: sql`${factionQuests.paidOutAsh} + ${factionQuests.rewardAsh}`,
                status: sql`CASE WHEN ${factionQuests.slotsClaimed} + 1 >= ${factionQuests.slotsTotal} THEN 'completed' ELSE ${factionQuests.status} END`,
                completedAt: sql`CASE WHEN ${factionQuests.slotsClaimed} + 1 >= ${factionQuests.slotsTotal} THEN now() ELSE ${factionQuests.completedAt} END`,
            })
            .where(and(
                eq(factionQuests.id, questId),
                eq(factionQuests.status, "active"),
                sql`${factionQuests.slotsClaimed} < ${factionQuests.slotsTotal}`
            ))
            .returning();

        if (!reserved) {
            await db.delete(factionQuestCompletions).where(eq(factionQuestCompletions.id, completionId));
            return NextResponse.json({ error: "quest_full" }, { status: 409 });
        }

        return NextResponse.json({
            success: true,
            questId,
            rewardAsh: reserved.rewardAsh,
            slotsClaimed: reserved.slotsClaimed,
            slotsTotal: reserved.slotsTotal,
            status: reserved.status,
        });
    } catch (error) {
        console.error("[internal/faction/quest/claim] Error:", error);
        return NextResponse.json({ error: "claim_failed" }, { status: 500 });
    }
}
