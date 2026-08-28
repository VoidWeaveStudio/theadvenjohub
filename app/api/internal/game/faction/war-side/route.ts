// app/api/internal/game/faction/war-side/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factionMembers, factionWarSides, factionWars } from "@/core/database/schema";
import { and, eq, inArray } from "drizzle-orm";
import { isParticipant } from "@/core/lib/factionWar";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { action, gameId } = body;

        if (typeof gameId !== "string") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        if (action === "list") {
            const wars = await db
                .select({ id: factionWars.id })
                .from(factionWars)
                .where(and(eq(factionWars.gameId, gameId), eq(factionWars.status, "active")));

            if (wars.length === 0) return NextResponse.json({ success: true, sides: [] });

            const rows = await db
                .select({
                    warId: factionWarSides.warId,
                    userId: factionWarSides.userId,
                    sideFactionId: factionWarSides.sideFactionId,
                })
                .from(factionWarSides)
                .where(inArray(factionWarSides.warId, wars.map((war) => war.id)));

            return NextResponse.json({ success: true, sides: rows });
        }

        const { warId, userId } = body;
        if (typeof warId !== "string" || typeof userId !== "string") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const war = await db.query.factionWars.findFirst({ where: eq(factionWars.id, warId) });
        if (!war) return NextResponse.json({ error: "war_not_found" }, { status: 404 });
        if (war.status !== "active") return NextResponse.json({ error: "war_over" }, { status: 409 });

        const memberships = await db
            .select({ factionId: factionMembers.factionId })
            .from(factionMembers)
            .where(and(
                eq(factionMembers.userId, userId),
                inArray(factionMembers.factionId, [war.declarerFactionId, war.defenderFactionId])
            ));

        if (memberships.length < 2) {
            return NextResponse.json({ error: "not_torn" }, { status: 409 });
        }

        if (action !== "choose") {
            return NextResponse.json({ error: "unknown_action" }, { status: 400 });
        }

        const rawSide = body.sideFactionId;
        const sideFactionId = typeof rawSide === "string" ? rawSide : null;

        if (sideFactionId !== null && !isParticipant(war, sideFactionId)) {
            return NextResponse.json({ error: "bad_side" }, { status: 400 });
        }

        const paidAsh = Math.max(0, Math.trunc(Number(body.paidAsh)) || 0);

        await db
            .insert(factionWarSides)
            .values({ warId, userId, sideFactionId, paidAsh })
            .onConflictDoUpdate({
                target: [factionWarSides.warId, factionWarSides.userId],
                set: { sideFactionId, paidAsh, chosenAt: new Date() },
            });

        return NextResponse.json({ success: true, warId, userId, sideFactionId });
    } catch (error) {
        console.error("[internal/faction/war-side] Error:", error);
        return NextResponse.json({ error: "war_side_failed" }, { status: 500 });
    }
}
