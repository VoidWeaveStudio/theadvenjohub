// app/api/internal/game/faction/grant/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factionMembers, factions } from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { moveTreasury } from "@/core/lib/factionTreasury";
import { isFactionHead } from "@/core/lib/factionPermissions";
import { adjustWallet } from "@/core/lib/companionInventory";
import { adjustCosmeticWallet } from "@/core/lib/cosmeticCrates";

const MAX_PER_GRANT = 500;

function amount(raw: unknown): number {
    const parsed = Math.trunc(Number(raw));
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.min(MAX_PER_GRANT, parsed);
}

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { factionId, gameId, userId, targetUserId } = body;

        if (
            typeof factionId !== "string" ||
            typeof gameId !== "string" ||
            typeof userId !== "string" ||
            typeof targetUserId !== "string"
        ) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const companionFragments = amount(body.companionFragments);
        const cosmeticFragments = amount(body.cosmeticFragments);

        if (companionFragments === 0 && cosmeticFragments === 0) {
            return NextResponse.json({ error: "nothing_to_grant" }, { status: 400 });
        }

        const faction = await db.query.factions.findFirst({ where: eq(factions.id, factionId) });
        if (!faction) return NextResponse.json({ error: "faction_not_found" }, { status: 404 });

        if (!isFactionHead(faction, userId)) {
            return NextResponse.json({ error: "head_only" }, { status: 403 });
        }

        const target = await db.query.factionMembers.findFirst({
            where: and(eq(factionMembers.factionId, factionId), eq(factionMembers.userId, targetUserId)),
        });
        if (!target) return NextResponse.json({ error: "not_a_member" }, { status: 403 });

        const spend = await moveTreasury(
            factionId,
            gameId,
            "grant",
            { companionFragments: -companionFragments, cosmeticFragments: -cosmeticFragments },
            { userId: targetUserId, note: "grant" }
        );

        if (!spend.ok) {
            return NextResponse.json({ error: spend.error }, { status: spend.error === "not_found" ? 404 : 409 });
        }

        let deliveredCompanion = 0;
        let deliveredCosmetic = 0;

        if (companionFragments > 0) {
            deliveredCompanion = (await adjustWallet(targetUserId, gameId, companionFragments, 0))
                ? companionFragments
                : 0;
        }

        if (cosmeticFragments > 0) {
            deliveredCosmetic = (await adjustCosmeticWallet(targetUserId, gameId, cosmeticFragments, 0))
                ? cosmeticFragments
                : 0;
        }

        const failedCompanion = companionFragments - deliveredCompanion;
        const failedCosmetic = cosmeticFragments - deliveredCosmetic;
        let treasury = spend.balance;

        if (failedCompanion > 0 || failedCosmetic > 0) {
            const refund = await moveTreasury(
                factionId,
                gameId,
                "grant",
                { companionFragments: failedCompanion, cosmeticFragments: failedCosmetic },
                { userId: targetUserId, note: "grant_refund" }
            );
            if (refund.ok) treasury = refund.balance;
        }

        if (deliveredCompanion === 0 && deliveredCosmetic === 0) {
            return NextResponse.json({ error: "grant_failed", treasury }, { status: 409 });
        }

        return NextResponse.json({
            success: true,
            treasury,
            targetUserId,
            companionFragments: deliveredCompanion,
            cosmeticFragments: deliveredCosmetic,
        });
    } catch (error) {
        console.error("[internal/faction/grant] Error:", error);
        return NextResponse.json({ error: "grant_failed" }, { status: 500 });
    }
}
