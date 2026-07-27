// app/api/internal/game/faction/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { getFactionsRankedByGame } from "@/core/lib/factionRank";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { gameId, page, limit } = body;

        if (!gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const safePage = Number.isInteger(page) && page > 0 ? page : 1;
        const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT;
        const offset = (safePage - 1) * safeLimit;

        const ranked = await getFactionsRankedByGame(gameId);
        const results = ranked.slice(offset, offset + safeLimit);

        return NextResponse.json({ results, page: safePage, limit: safeLimit });
    } catch (error) {
        console.error("[internal/faction/list] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
