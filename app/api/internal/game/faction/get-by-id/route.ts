// app/api/internal/game/faction/get-by-id/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionMembers, gameNicknames } from "@/core/database/schema";
import { eq, and, desc } from "drizzle-orm";
import { getFactionRank } from "@/core/lib/factionRank";
import { buildFactionTaskExtras } from "@/core/lib/factionDetail";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { gameId, factionId } = body;

        if (!gameId || !factionId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const faction = await db.query.factions.findFirst({
            where: and(eq(factions.id, factionId), eq(factions.gameId, gameId)),
        });

        if (!faction) {
            return NextResponse.json({ faction: null });
        }

        const roster = await db
            .select({
                wallet: factionMembers.wallet,
                role: factionMembers.role,
                joinedAt: factionMembers.joinedAt,
                contributionPoints: factionMembers.contributionPoints,
                nickname: gameNicknames.nickname,
            })
            .from(factionMembers)
            .leftJoin(
                gameNicknames,
                and(eq(gameNicknames.userId, factionMembers.userId), eq(gameNicknames.gameId, factionMembers.gameId))
            )
            .where(eq(factionMembers.factionId, factionId))
            .orderBy(desc(factionMembers.contributionPoints));

        const rank = await getFactionRank(gameId, factionId);
        const taskExtras = await buildFactionTaskExtras(faction, gameId);

        return NextResponse.json({
            faction: {
                id: faction.id,
                number: faction.number,
                name: faction.name,
                symbol: faction.symbol,
                image: faction.image,
                description: faction.description,
                tokenCa: faction.tokenCa,
                founderWallet: faction.founderWallet,
                memberCount: roster.length,
                rank,
                ...taskExtras,
                roster: roster.map((r) => ({
                    wallet: r.wallet,
                    role: r.role,
                    nickname: r.nickname || null,
                    contributionPoints: r.contributionPoints,
                })),
            },
        });
    } catch (error) {
        console.error("[internal/faction/get-by-id] Error:", error);
        return NextResponse.json({ error: "get_failed" }, { status: 500 });
    }
}
