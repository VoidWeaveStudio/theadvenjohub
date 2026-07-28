// app/api/internal/game/faction/complete-task/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionTaskLog, gameNicknames } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";
import { grantAsh } from "@/core/lib/economy";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { factionId, taskKey } = body;

        if (!factionId || typeof taskKey !== "string" || taskKey.trim().length === 0) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }


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
