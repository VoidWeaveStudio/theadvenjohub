// app/api/internal/game/faction/join/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionMembers } from "@/core/database/schema";
import { eq, and, count, sql } from "drizzle-orm";
import { getFactionRank } from "@/core/lib/factionRank";
import { getTokenBalance } from "@/core/blockchain";

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

        const faction = await db.query.factions.findFirst({
            where: and(eq(factions.id, factionId), eq(factions.gameId, gameId)),
        });
        if (!faction) {
            return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        }

        if (faction.tokenCa) {
            let balance: number;
            try {
                balance = await getTokenBalance(wallet, faction.tokenCa);
            } catch (err) {
                console.error("[internal/faction/join] balance check failed:", err);
                return NextResponse.json({ error: "balance_check_failed" }, { status: 502 });
            }
            if (balance <= 0) {
                return NextResponse.json({ error: "insufficient_token_balance" }, { status: 403 });
            }
        }

        try {
            await db.insert(factionMembers).values({
                factionId,
                userId,
                gameId,
                wallet,
                role: "member",
                isDisplayed: sql`NOT EXISTS (SELECT 1 FROM faction_members WHERE user_id = ${userId} AND game_id = ${gameId})`,
            });
        } catch (insertError: any) {
            if (insertError?.code === "23505") {
       
                try {
                    await db.insert(factionMembers).values({
                        factionId, userId, gameId, wallet, role: "member", isDisplayed: false,
                    });
                } catch (retryError: any) {
                    if (retryError?.code === "23505") {
                        return NextResponse.json({ error: "already_in_faction" }, { status: 409 });
                    }
                    throw retryError;
                }
            } else if (insertError?.code === "23503") {
                return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
            } else {
                throw insertError;
            }
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
                role: "member",
            },
        });
    } catch (error) {
        console.error("[internal/faction/join] Error:", error);
        return NextResponse.json({ error: "join_failed" }, { status: 500 });
    }
}
