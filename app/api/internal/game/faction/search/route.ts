// app/api/internal/game/faction/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionMembers } from "@/core/database/schema";
import { eq, and, or, ilike, count } from "drizzle-orm";
import { getFactionsRankedByGame } from "@/core/lib/factionRank";

const MAX_RESULTS = 20;

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { gameId, ca, name } = body;

        if (!gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const trimmedCa = typeof ca === "string" ? ca.trim().slice(0, 64) : "";
        const trimmedName = typeof name === "string" ? name.trim().slice(0, 50) : "";

        if (trimmedCa.length === 0 && trimmedName.length === 0) {
            return NextResponse.json({ results: [] });
        }

        const matchConditions = [];
        if (trimmedCa.length > 0) matchConditions.push(eq(factions.tokenCa, trimmedCa));
        if (trimmedName.length > 0) matchConditions.push(ilike(factions.name, `%${trimmedName}%`));

        const rows = await db
            .select({
                id: factions.id,
                number: factions.number,
                name: factions.name,
                symbol: factions.symbol,
                image: factions.image,
                description: factions.description,
                tokenCa: factions.tokenCa,
                founderWallet: factions.founderWallet,
                memberCount: count(factionMembers.id),
            })
            .from(factions)
            .leftJoin(factionMembers, eq(factionMembers.factionId, factions.id))
            .where(and(eq(factions.gameId, gameId), or(...matchConditions)))
            .groupBy(factions.id)
            .limit(MAX_RESULTS);

        const ranked = await getFactionsRankedByGame(gameId);
        const rankById = new Map(ranked.map((f) => [f.id, f.rank]));
        const results = rows.map((row) => ({ ...row, rank: rankById.get(row.id) ?? null }));

        return NextResponse.json({ results });
    } catch (error) {
        console.error("[internal/faction/search] Error:", error);
        return NextResponse.json({ error: "search_failed" }, { status: 500 });
    }
}
