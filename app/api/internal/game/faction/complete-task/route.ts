// app/api/internal/game/faction/complete-task/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionTaskLog, gameNicknames, factionMembers } from "@/core/database/schema";
import { eq, and, sql } from "drizzle-orm";
import { grantAsh } from "@/core/lib/economy";
import { applyFactionXp } from "@/core/lib/factionLeveling";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { factionId, taskKey, contributions } = body;

        if (!factionId || typeof taskKey !== "string" || taskKey.trim().length === 0) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const contributionsList: { userId: string; amount: number }[] = Array.isArray(contributions) ? contributions : [];


        const [claimed] = await db
            .update(factions)
            .set({
                activeTaskKey: null,
                activeTaskTarget: null,
                activeTaskProgress: 0,
                activeTaskAcceptedAt: null,
                activeTaskAcceptedByUserId: null,
            })
            .where(and(eq(factions.id, factionId), eq(factions.activeTaskKey, taskKey)))
            .returning();

        if (!claimed) {
            return NextResponse.json({ error: "stale" }, { status: 409 });
        }

        const rewardAsh = claimed.activeTaskRewardAsh ?? 0;
        const rewardUserId = claimed.verifiedCreatorUserId ?? claimed.founderUserId;
        const rewardWallet = claimed.verifiedCreatorUserId ? claimed.verifiedCreatorWallet! : claimed.founderWallet;

        await grantAsh(rewardUserId, claimed.gameId, rewardAsh);

        await db.insert(factionTaskLog).values({
            factionId,
            taskKey,
            rewardAsh,
            rewardUserId,
            rewardWallet,
        });

        const totalContributed = contributionsList.reduce((sum, c) => sum + (c.amount || 0), 0);
        if (totalContributed > 0) {
            await Promise.all(contributionsList.map((c) => {
                const points = Math.round((c.amount / totalContributed) * rewardAsh);
                if (points <= 0) return null;
                return db.update(factionMembers)
                    .set({
                        contributionPoints: sql`${factionMembers.contributionPoints} + ${points}`,
                        tasksContributed: sql`${factionMembers.tasksContributed} + 1`,
                    })
                    .where(and(eq(factionMembers.factionId, factionId), eq(factionMembers.userId, c.userId)));
            }));
        }

        const { level, progress } = applyFactionXp(claimed.level, claimed.levelProgressAsh, rewardAsh);
        await db.update(factions).set({ level, levelProgressAsh: progress }).where(eq(factions.id, factionId));

        const rewardNick = await db.query.gameNicknames.findFirst({
            where: and(eq(gameNicknames.userId, rewardUserId), eq(gameNicknames.gameId, claimed.gameId)),
        });

        return NextResponse.json({
            success: true,
            rewardAsh,
            rewardUserId,
            rewardWallet,
            rewardNickname: rewardNick?.nickname || null,
        });
    } catch (error) {
        console.error("[internal/faction/complete-task] Error:", error);
        return NextResponse.json({ error: "complete_failed" }, { status: 500 });
    }
}
