// app/api/internal/game/faction/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionMembers } from "@/core/database/schema";
import { eq, sql } from "drizzle-orm";
import { getFactionRank } from "@/core/lib/factionRank";
import { getTokenBalance } from "@/core/blockchain";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, wallet, name, symbol, image, description, tokenCa } = body;

        if (!userId || !gameId || !wallet || typeof name !== "string" || typeof tokenCa !== "string" || tokenCa.trim().length === 0) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const trimmedName = name.trim().slice(0, 50);
        if (trimmedName.length === 0) {
            return NextResponse.json({ error: "invalid_name" }, { status: 400 });
        }
        const trimmedDescription = typeof description === "string" ? description.trim().slice(0, 500) : "";
        const trimmedCa = tokenCa.trim().slice(0, 64);
        const trimmedSymbol = typeof symbol === "string" && symbol.trim().length > 0 ? symbol.trim().slice(0, 20) : null;
        const trimmedImage = typeof image === "string" && image.trim().length > 0 ? image.trim().slice(0, 512) : null;

        let balance: number;
        try {
            balance = await getTokenBalance(wallet, trimmedCa);
        } catch (err) {
            console.error("[internal/faction/create] balance check failed:", err);
            return NextResponse.json({ error: "balance_check_failed" }, { status: 502 });
        }
        if (balance <= 0) {
            return NextResponse.json({ error: "insufficient_token_balance" }, { status: 403 });
        }

        let created;
        try {
            [created] = await db.insert(factions).values({
                gameId,
                name: trimmedName,
                symbol: trimmedSymbol,
                image: trimmedImage,
                description: trimmedDescription,
                tokenCa: trimmedCa,
                founderUserId: userId,
                founderWallet: wallet,
            }).returning();
        } catch (insertError: any) {
            if (insertError?.code === "23505") {
                return NextResponse.json({ error: "name_taken" }, { status: 409 });
            }
            throw insertError;
        }

        try {
            await db.insert(factionMembers).values({
                factionId: created.id,
                userId,
                gameId,
                wallet,
                role: "founder",
                isDisplayed: sql`NOT EXISTS (SELECT 1 FROM faction_members WHERE user_id = ${userId} AND game_id = ${gameId})`,
            });
        } catch (membershipError: any) {
            if (membershipError?.code === "23505") {
              
                try {
                    await db.insert(factionMembers).values({
                        factionId: created.id,
                        userId,
                        gameId,
                        wallet,
                        role: "founder",
                        isDisplayed: false,
                    });
                } catch (retryError) {
                    await db.delete(factions).where(eq(factions.id, created.id));
                    throw retryError;
                }
            } else {
                await db.delete(factions).where(eq(factions.id, created.id));
                throw membershipError;
            }
        }

        const rank = await getFactionRank(gameId, created.id);

        return NextResponse.json({
            success: true,
            faction: {
                id: created.id,
                number: created.number,
                name: created.name,
                symbol: created.symbol,
                image: created.image,
                description: created.description,
                tokenCa: created.tokenCa,
                founderWallet: created.founderWallet,
                memberCount: 1,
                rank,
                role: "founder",
            },
        });
    } catch (error) {
        console.error("[internal/faction/create] Error:", error);
        return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }
}
