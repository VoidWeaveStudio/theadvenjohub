// app/api/internal/game/faction/boost/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factionBoosts, factionMembers, factions } from "@/core/database/schema";
import { and, eq, gt, sql } from "drizzle-orm";
import { moveTreasury } from "@/core/lib/factionTreasury";
import { hasFactionPermission, FACTION_PERM_TREASURY } from "@/core/lib/factionPermissions";
import {
    boostById,
    boostPrice,
    isBoostDuration,
    BOOST_DURATION_MS,
    boostCatalogPayload,
} from "@/core/lib/factionBoosts";

async function readActive(factionId: string) {
    const rows = await db
        .select({ boostId: factionBoosts.boostId, expiresAt: factionBoosts.expiresAt })
        .from(factionBoosts)
        .where(and(eq(factionBoosts.factionId, factionId), gt(factionBoosts.expiresAt, new Date())));

    return rows
        .filter((row) => !!boostById(row.boostId))
        .map((row) => ({ boostId: row.boostId, expiresAt: row.expiresAt.getTime() }));
}

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { action, factionId, gameId, userId } = body;

        if (typeof factionId !== "string" || typeof gameId !== "string") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        if (action === "list") {
            const active = await readActive(factionId);
            return NextResponse.json({ success: true, catalog: boostCatalogPayload(), active });
        }

        if (action !== "buy") {
            return NextResponse.json({ error: "unknown_action" }, { status: 400 });
        }

        if (typeof userId !== "string") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const boost = boostById(body.boostId);
        const duration = body.duration;
        if (!boost || !isBoostDuration(duration)) {
            return NextResponse.json({ error: "unknown_boost" }, { status: 400 });
        }

        const faction = await db.query.factions.findFirst({ where: eq(factions.id, factionId) });
        if (!faction) return NextResponse.json({ error: "faction_not_found" }, { status: 404 });

        const membership = await db.query.factionMembers.findFirst({
            where: and(eq(factionMembers.factionId, factionId), eq(factionMembers.userId, userId)),
        });
        if (!membership) return NextResponse.json({ error: "not_a_member" }, { status: 403 });

        if (!hasFactionPermission(faction, userId, membership.permissions ?? 0, FACTION_PERM_TREASURY)) {
            return NextResponse.json({ error: "no_treasury_access" }, { status: 403 });
        }

        const price = boostPrice(boost, duration);
        const spend = await moveTreasury(factionId, gameId, "boost", { ash: -price }, {
            userId,
            note: `${boost.id}:${duration}`,
        });

        if (!spend.ok) {
            return NextResponse.json({ error: spend.error }, { status: spend.error === "not_found" ? 404 : 409 });
        }

        const now = new Date();
        const span = BOOST_DURATION_MS[duration];

        try {
            await db
                .insert(factionBoosts)
                .values({
                    factionId,
                    gameId,
                    boostId: boost.id,
                    expiresAt: new Date(now.getTime() + span),
                    purchasedByUserId: userId,
                })
                .onConflictDoUpdate({
                    target: [factionBoosts.factionId, factionBoosts.boostId],
                    set: {
                        expiresAt: sql`GREATEST(${factionBoosts.expiresAt}, ${now}) + ${sql.raw(`interval '${span} milliseconds'`)}`,
                        purchasedByUserId: userId,
                    },
                });
        } catch (error) {
            await moveTreasury(factionId, gameId, "boost", { ash: price }, {
                userId,
                note: `refund:${boost.id}`,
            });
            throw error;
        }

        const active = await readActive(factionId);
        return NextResponse.json({ success: true, treasury: spend.balance, active, boostId: boost.id });
    } catch (error) {
        console.error("[internal/faction/boost] Error:", error);
        return NextResponse.json({ error: "boost_failed" }, { status: 500 });
    }
}
