// src/core/lib/eventBoard.ts
import { db } from "@/core/database";
import { eventRuns, gameNicknames, users } from "@/core/database/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { EventBoardEntry } from "@/features/game/data/eventDoors";

export const EVENT_BOARD_LIMIT = 10;

// One row per player: their single best run, ties broken by who got there first.
export async function loadEventBoard(
    gameId: string,
    eventId: string,
    limit: number = EVENT_BOARD_LIMIT
): Promise<EventBoardEntry[]> {
    const ranked = db
        .select({
            userId: eventRuns.userId,
            wallet: eventRuns.wallet,
            wavesCleared: eventRuns.wavesCleared,
            partySize: eventRuns.partySize,
            createdAt: eventRuns.createdAt,
            rank: sql<number>`row_number() over (
                partition by ${eventRuns.userId}
                order by ${eventRuns.wavesCleared} desc, ${eventRuns.createdAt} asc
            )`.as("rank"),
        })
        .from(eventRuns)
        .where(and(eq(eventRuns.gameId, gameId), eq(eventRuns.eventId, eventId)))
        .as("ranked");

    const rows = await db
        .select({
            wallet: ranked.wallet,
            nickname: gameNicknames.nickname,
            wavesCleared: ranked.wavesCleared,
            partySize: ranked.partySize,
            createdAt: ranked.createdAt,
        })
        .from(ranked)
        .leftJoin(
            gameNicknames,
            and(eq(gameNicknames.userId, ranked.userId), eq(gameNicknames.gameId, gameId))
        )
        .where(eq(ranked.rank, 1))
        .orderBy(desc(ranked.wavesCleared), asc(ranked.createdAt))
        .limit(Math.max(1, Math.min(50, limit)));

    return rows.map((row, index) => ({
        rank: index + 1,
        wallet: row.wallet,
        nickname: row.nickname ?? null,
        wavesCleared: row.wavesCleared,
        partySize: row.partySize,
        achievedAt: row.createdAt.toISOString(),
    }));
}

export async function findUserIdByWallet(wallet: string): Promise<string | null> {
    const row = await db.query.users.findFirst({ where: eq(users.wallet, wallet) });
    return row?.id ?? null;
}
