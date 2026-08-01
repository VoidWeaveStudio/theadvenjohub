// src/core/lib/achievementEngine.ts
import { db } from "@/core/database";
import { userAchievements } from "@/core/database/schema";
import { ACHIEVEMENTS, AchievementMetric } from "@/core/lib/achievements";

export type AchievementStats = Partial<Record<AchievementMetric, number>>;

export async function evaluateAndUnlockAchievements(
    userId: string,
    gameId: string,
    stats: AchievementStats
): Promise<{ key: string; label: string }[]> {
    const eligible = ACHIEVEMENTS.filter((a) => (stats[a.metric] ?? 0) >= a.target);
    if (eligible.length === 0) return [];

    const existing = await db.query.userAchievements.findMany({
        where: (ua, { eq, and }) => and(eq(ua.userId, userId), eq(ua.gameId, gameId)),
    });
    const existingKeys = new Set(existing.map((e) => e.achievementKey));

    const toUnlock = eligible.filter((a) => !existingKeys.has(a.key));
    if (toUnlock.length === 0) return [];

    const inserted = await db
        .insert(userAchievements)
        .values(toUnlock.map((a) => ({ userId, gameId, achievementKey: a.key })))
        .onConflictDoNothing({ target: [userAchievements.userId, userAchievements.gameId, userAchievements.achievementKey] })
        .returning();

    return inserted.map((row) => {
        const def = ACHIEVEMENTS.find((a) => a.key === row.achievementKey)!;
        return { key: def.key, label: def.label };
    });
}
