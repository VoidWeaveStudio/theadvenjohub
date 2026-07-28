// src/core/lib/factionDetail.ts
import { db } from "@/core/database";
import { gameNicknames, factionTaskLog, factions } from "@/core/database/schema";
import { eq, and, desc } from "drizzle-orm";

type FactionRow = typeof factions.$inferSelect;

export async function buildFactionTaskExtras(faction: FactionRow, gameId: string) {
    let acceptedByNickname: string | null = null;
    if (faction.activeTaskAcceptedByUserId) {
        const nick = await db.query.gameNicknames.findFirst({
            where: and(
                eq(gameNicknames.userId, faction.activeTaskAcceptedByUserId),
                eq(gameNicknames.gameId, gameId)
            ),
        });
        acceptedByNickname = nick?.nickname || null;
    }

    const historyRows = await db
        .select({
            id: factionTaskLog.id,
            taskKey: factionTaskLog.taskKey,
            rewardAsh: factionTaskLog.rewardAsh,
            rewardWallet: factionTaskLog.rewardWallet,
            completedAt: factionTaskLog.completedAt,
            rewardNickname: gameNicknames.nickname,
        })
        .from(factionTaskLog)
        .leftJoin(
            gameNicknames,
            and(eq(gameNicknames.userId, factionTaskLog.rewardUserId), eq(gameNicknames.gameId, gameId))
        )
        .where(eq(factionTaskLog.factionId, faction.id))
        .orderBy(desc(factionTaskLog.completedAt))
        .limit(5);

    return {
        activeTask: faction.activeTaskKey
            ? {
                key: faction.activeTaskKey,
                target: faction.activeTaskTarget ?? 0,
                progress: faction.activeTaskProgress,
                rewardAsh: faction.activeTaskRewardAsh ?? 0,
                acceptedAt: faction.activeTaskAcceptedAt,
                acceptedByNickname,
            }
            : null,
        taskHistory: historyRows.map((r) => ({
            id: r.id,
            taskKey: r.taskKey,
            rewardAsh: r.rewardAsh,
            rewardWallet: r.rewardWallet,
            rewardNickname: r.rewardNickname || null,
            completedAt: r.completedAt,
        })),
        tokenCreatorWallet: faction.tokenCreatorWallet,
        verifiedCreatorWallet: faction.verifiedCreatorWallet,
        verifiedCreatorUserId: faction.verifiedCreatorUserId,
    };
}
