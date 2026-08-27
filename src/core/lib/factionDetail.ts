// src/core/lib/factionDetail.ts
import { db } from "@/core/database";
import { gameNicknames, factionTaskLog, factions, factionMembers } from "@/core/database/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { getFactionRank, getFactionsRankedByGame } from "@/core/lib/factionRank";
import { xpForLevel } from "@/core/lib/factionLeveling";

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
        level: faction.level,
        levelProgressAsh: faction.levelProgressAsh,
        xpForNextLevel: xpForLevel(faction.level),
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
        promoCode: faction.promoCode,
    };
}

/**
 * Promotes the oldest remaining membership to "displayed" (the one badge shown
 * on the world avatar / chat) only if the player currently has none marked —
 * used after a membership is removed (leave, or auto-kick) so the player isn't
 * left with no displayed faction while they still belong to others.
 */
export async function reassignDisplayedIfNeeded(userId: string, gameId: string) {
    await db.execute(sql`
        UPDATE faction_members SET is_displayed = true
        WHERE id = (
            SELECT id FROM faction_members
            WHERE user_id = ${userId} AND game_id = ${gameId}
            ORDER BY joined_at ASC LIMIT 1
        )
        AND NOT EXISTS (
            SELECT 1 FROM faction_members WHERE user_id = ${userId} AND game_id = ${gameId} AND is_displayed = true
        )
    `);
}

/** Full list of every faction a player currently belongs to, for the multi-faction "My Factions" view. */
export async function getMyFactionsList(userId: string, gameId: string) {
    const memberships = await db.query.factionMembers.findMany({
        where: and(eq(factionMembers.userId, userId), eq(factionMembers.gameId, gameId)),
    });

    if (memberships.length === 0) return [];

    // Rank + memberCount for every faction in the game, computed ONCE and reused
    // below — previously each membership re-ran the full game-wide leaderboard
    // aggregate (via getFactionRank) plus its own separate memberCount query,
    // scaling with total factions in the game on every single call.
    const ranked = await getFactionsRankedByGame(gameId);
    const rankedById = new Map(ranked.map((f) => [f.id, f]));

    const results = await Promise.all(memberships.map(async (membership) => {
        const faction = await db.query.factions.findFirst({ where: eq(factions.id, membership.factionId) });
        if (!faction) return null;

        const rankedEntry = rankedById.get(faction.id);
        let memberCount: number;
        let rank: number | null;
        if (rankedEntry) {
            memberCount = rankedEntry.memberCount;
            rank = rankedEntry.rank;
        } else {
            // Fallback for the rare case a faction falls outside getFactionsRankedByGame's limit.
            const [{ memberCount: mc }] = await db
                .select({ memberCount: count() })
                .from(factionMembers)
                .where(eq(factionMembers.factionId, faction.id));
            memberCount = mc;
            rank = await getFactionRank(gameId, faction.id);
        }

        const taskExtras = await buildFactionTaskExtras(faction, gameId);

        return {
            id: faction.id,
            number: faction.number,
            name: faction.name,
            symbol: faction.symbol,
            image: faction.image,
            description: faction.description,
            tokenCa: faction.tokenCa,
            founderWallet: faction.founderWallet,
            founderUserId: faction.founderUserId,
            memberCount,
            rank,
            role: membership.role,
            isDisplayed: membership.isDisplayed,
            ...taskExtras,
        };
    }));

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
}
