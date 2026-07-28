// app/api/internal/game/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { getCache, setCache } from "@/core/lib/cache";
import { users, gameNicknames, gameStatistics, gameProgress, factionMembers, factions } from "@/core/database/schema";
import { eq, and, gte } from "drizzle-orm";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const ACTIVE_WITHIN_DAYS = 30;
const CACHE_TTL_SECONDS = 45;

const SCORE_WEIGHTS = {
    kills: 10,
    deaths: -2,
    ash: 1,
    playtimeMinutes: 1,
};

function computeScore(kills: number, deaths: number, ash: number, playtimeSeconds: number): number {
    const playtimeMinutes = Math.floor(playtimeSeconds / 60);
    return (
        kills * SCORE_WEIGHTS.kills +
        deaths * SCORE_WEIGHTS.deaths +
        ash * SCORE_WEIGHTS.ash +
        playtimeMinutes * SCORE_WEIGHTS.playtimeMinutes
    );
}

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { gameId, limit } = body;

        if (!gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT;
        const cacheKey = `leaderboard:${gameId}`;

        const cached = await getCache<any[]>(cacheKey);
        if (cached) {
            return NextResponse.json({ leaderboard: cached.slice(0, safeLimit), cached: true });
        }

        const activeSince = new Date(Date.now() - ACTIVE_WITHIN_DAYS * 24 * 60 * 60 * 1000);

        const rows = await db
            .select({
                wallet: users.wallet,
                nickname: gameNicknames.nickname,
                kills: gameStatistics.kills,
                deaths: gameStatistics.deaths,
                playtimeSeconds: gameStatistics.playtimeSeconds,
                progressData: gameProgress.data,
                factionName: factions.name,
                factionSymbol: factions.symbol,
                factionImage: factions.image,
                factionNumber: factions.number,
            })
            .from(gameStatistics)
            .innerJoin(users, eq(users.id, gameStatistics.userId))
            .leftJoin(
                gameNicknames,
                and(eq(gameNicknames.userId, gameStatistics.userId), eq(gameNicknames.gameId, gameStatistics.gameId))
            )
            .leftJoin(
                gameProgress,
                and(eq(gameProgress.userId, gameStatistics.userId), eq(gameProgress.gameId, gameStatistics.gameId))
            )
            .leftJoin(
                factionMembers,
                and(eq(factionMembers.userId, gameStatistics.userId), eq(factionMembers.gameId, gameStatistics.gameId))
            )
            .leftJoin(factions, eq(factions.id, factionMembers.factionId))
            .where(and(eq(gameStatistics.gameId, gameId), gte(gameStatistics.updatedAt, activeSince)));

        const scored = rows.map((row) => {
            let ash = 0;
            if (row.progressData) {
                try {
                    const parsed = JSON.parse(row.progressData);
                    ash = Number(parsed?.ash) || 0;
                } catch {
                    ash = 0;
                }
            }
            return {
                wallet: row.wallet,
                nickname: row.nickname || null,
                kills: row.kills,
                deaths: row.deaths,
                ash,
                playtimeSeconds: row.playtimeSeconds,
                score: computeScore(row.kills, row.deaths, ash, row.playtimeSeconds),
                faction: row.factionName
                    ? { name: row.factionName, symbol: row.factionSymbol, image: row.factionImage, number: row.factionNumber }
                    : null,
            };
        });

        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, MAX_LIMIT);

        await setCache(cacheKey, top, CACHE_TTL_SECONDS);

        return NextResponse.json({ leaderboard: top.slice(0, safeLimit), cached: false });
    } catch (error) {
        console.error("[internal/leaderboard] Error:", error);
        return NextResponse.json({ error: "leaderboard_failed" }, { status: 500 });
    }
}
