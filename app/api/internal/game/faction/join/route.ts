// app/api/internal/game/faction/join/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factionMembers } from "@/core/database/schema";
import { eq, count } from "drizzle-orm";
import { getFactionRank } from "@/core/lib/factionRank";
import { joinFactionForUser } from "@/core/lib/factionMembership";

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

        const result = await joinFactionForUser({ userId, gameId, wallet, factionId });
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }
        if (result.alreadyMember) {
            return NextResponse.json({ error: "already_in_faction" }, { status: 409 });
        }

        const { faction } = result;

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
                role: "member",
            },
        });
    } catch (error) {
        console.error("[internal/faction/join] Error:", error);
        return NextResponse.json({ error: "join_failed" }, { status: 500 });
    }
}
