// app/api/internal/game/faction/join/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionMembers } from "@/core/database/schema";
import { eq, and, count } from "drizzle-orm";
import { getFactionRank } from "@/core/lib/factionRank";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, wallet, factionId } = body;

        if (!userId || !gameId || !wallet || !factionId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        try {
            await db.insert(factionMembers).values({
                factionId,
                userId,
                gameId,
                wallet,
                role: "member",
            });
        } catch (insertError: any) {
            if (insertError?.code === "23505") {
                return NextResponse.json({ error: "already_in_faction" }, { status: 409 });
            }
            if (insertError?.code === "23503") {
                return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
            }
            throw insertError;
        }

        const faction = await db.query.factions.findFirst({
            where: and(eq(factions.id, factionId), eq(factions.gameId, gameId)),
        });
        if (!faction) {
            return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        }

        const [{ memberCount }] = await db
            .select({ memberCount: count() })
            .from(factionMembers)
            .where(eq(factionMembers.factionId, factionId));

        const rank = await getFactionRank(gameId, factionId);

        return NextResponse.json({
            success: true,
            faction: {
                id: faction.id,
                number: faction.number,
                name: faction.name,
                symbol: faction.symbol,
                image: faction.image,
                description: faction.description,
                tokenCa: faction.tokenCa,
                founderWallet: faction.founderWallet,
                memberCount,
                rank,
            },
        });
    } catch (error) {
        console.error("[internal/faction/join] Error:", error);
        return NextResponse.json({ error: "join_failed" }, { status: 500 });
    }
}
