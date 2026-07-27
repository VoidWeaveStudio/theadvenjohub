// app/api/internal/game/faction/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionMembers } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";
import { getFactionRank } from "@/core/lib/factionRank";

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

        const existingMembership = await db.query.factionMembers.findFirst({
            where: and(eq(factionMembers.userId, userId), eq(factionMembers.gameId, gameId)),
        });
        if (existingMembership) {
            return NextResponse.json({ error: "already_in_faction" }, { status: 409 });
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
            });
        } catch (membershipError: any) {
            await db.delete(factions).where(eq(factions.id, created.id));
            if (membershipError?.code === "23505") {
                return NextResponse.json({ error: "already_in_faction" }, { status: 409 });
            }
            throw membershipError;
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
            },
        });
    } catch (error) {
        console.error("[internal/faction/create] Error:", error);
        return NextResponse.json({ error: "create_failed" }, { status: 500 });
    }
}
