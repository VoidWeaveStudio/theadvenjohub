// app/api/internal/game/faction/accept-task/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionMembers } from "@/core/database/schema";
import { eq, and, count, isNull } from "drizzle-orm";
import { getFactionRank } from "@/core/lib/factionRank";
import { buildFactionTaskExtras } from "@/core/lib/factionDetail";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, factionId, taskKey, target, rewardAsh } = body;

        if (
            !userId || !gameId || !factionId ||
            typeof taskKey !== "string" || taskKey.trim().length === 0 ||
            !Number.isInteger(target) || target <= 0 ||
            !Number.isInteger(rewardAsh) || rewardAsh <= 0
        ) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const faction = await db.query.factions.findFirst({
            where: and(eq(factions.id, factionId), eq(factions.gameId, gameId)),
        });
        if (!faction) {
            return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        }

        const canManage = userId === faction.founderUserId || (!!faction.verifiedCreatorUserId && userId === faction.verifiedCreatorUserId);
        if (!canManage) {
            return NextResponse.json({ error: "not_authorized" }, { status: 403 });
        }

        if (faction.activeTaskKey) {
            return NextResponse.json({ error: "task_already_active" }, { status: 409 });
        }

        const [updated] = await db
            .update(factions)
            .set({
                activeTaskKey: taskKey,
                activeTaskTarget: target,
                activeTaskProgress: 0,
                activeTaskRewardAsh: rewardAsh,
                activeTaskAcceptedAt: new Date(),
                activeTaskAcceptedByUserId: userId,
            })
            .where(and(eq(factions.id, factionId), isNull(factions.activeTaskKey)))
            .returning();

        if (!updated) {
            return NextResponse.json({ error: "task_already_active" }, { status: 409 });
        }

        const [{ memberCount }] = await db
            .select({ memberCount: count() })
            .from(factionMembers)
            .where(eq(factionMembers.factionId, factionId));
        const rank = await getFactionRank(gameId, factionId);
        const taskExtras = await buildFactionTaskExtras(updated, gameId);

        return NextResponse.json({
            success: true,
            faction: {
                id: updated.id,
                number: updated.number,
                name: updated.name,
                symbol: updated.symbol,
                image: updated.image,
                description: updated.description,
                tokenCa: updated.tokenCa,
                founderWallet: updated.founderWallet,
                memberCount,
                rank,
                ...taskExtras,
            },
        });
    } catch (error) {
        console.error("[internal/faction/accept-task] Error:", error);
        return NextResponse.json({ error: "accept_failed" }, { status: 500 });
    }
}
