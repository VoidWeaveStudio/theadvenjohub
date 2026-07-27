// app/api/internal/game/faction/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { getFactionsRankedByGame } from "@/core/lib/factionRank";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

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
        const ranked = await getFactionsRankedByGame(gameId, safeLimit);

        return NextResponse.json({ leaderboard: ranked });
    } catch (error) {
        console.error("[internal/faction/leaderboard] Error:", error);
        return NextResponse.json({ error: "leaderboard_failed" }, { status: 500 });
    }
}
