// app/api/internal/game/faction/set-displayed/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factions, factionMembers } from "@/core/database/schema";
import { eq, and, count } from "drizzle-orm";
import { getFactionRank } from "@/core/lib/factionRank";
import { buildFactionTaskExtras } from "@/core/lib/factionDetail";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, factionId } = body;

        if (!userId || !gameId || !factionId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const membership = await db.query.factionMembers.findFirst({
            where: and(eq(factionMembers.userId, userId), eq(factionMembers.factionId, factionId)),
        });
        if (!membership) {
            return NextResponse.json({ error: "not_a_member" }, { status: 404 });
        }

        await db.update(factionMembers)
            .set({ isDisplayed: false })
            .where(and(eq(factionMembers.userId, userId), eq(factionMembers.gameId, gameId), eq(factionMembers.isDisplayed, true)));

        try {
            await db.update(factionMembers)
                .set({ isDisplayed: true })
                .where(and(eq(factionMembers.userId, userId), eq(factionMembers.factionId, factionId)));
        } catch (updateError: any) {
            if (updateError?.code !== "23505") throw updateError;
        }

        const faction = await db.query.factions.findFirst({ where: eq(factions.id, factionId) });
        if (!faction) {
            return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        }

        const [{ memberCount }] = await db
            .select({ memberCount: count() })
            .from(factionMembers)
            .where(eq(factionMembers.factionId, faction.id));
        const rank = await getFactionRank(gameId, faction.id);
        const taskExtras = await buildFactionTaskExtras(faction, gameId);

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
                role: membership.role,
                isDisplayed: true,
                ...taskExtras,
            },
        });
    } catch (error) {
        console.error("[internal/faction/set-displayed] Error:", error);
        return NextResponse.json({ error: "set_displayed_failed" }, { status: 500 });
    }
}
