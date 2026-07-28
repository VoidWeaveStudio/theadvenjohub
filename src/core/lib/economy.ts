// src/core/lib/economy.ts
import { db } from "@/core/database";
import { gameProgress } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";

export async function grantAsh(userId: string, gameId: string, amount: number): Promise<number> {
    const existing = await db.query.gameProgress.findFirst({
        where: and(eq(gameProgress.userId, userId), eq(gameProgress.gameId, gameId)),
    });

    let data: Record<string, any> = {};
    if (existing?.data) {
        try {
            data = JSON.parse(existing.data);
        } catch {
            data = {};
        }
    }

    const currentAsh = Number(data.ash) || 0;
    const newAsh = Math.max(0, currentAsh + amount);
    data.ash = newAsh;

    const serialized = JSON.stringify(data);

    if (existing) {
        await db
            .update(gameProgress)
            .set({ data: serialized, updatedAt: new Date() })
            .where(and(eq(gameProgress.userId, userId), eq(gameProgress.gameId, gameId)));
    } else {
        await db.insert(gameProgress).values({
            userId,
            gameId,
            data: serialized,
        });
    }

    return newAsh;
}
