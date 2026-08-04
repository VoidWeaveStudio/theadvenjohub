// app/api/admin/factions/[factionId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import { factions, factionMembers, factionGates, gameNicknames } from "@/core/database/schema";
import { eq, and, desc } from "drizzle-orm";
import { buildFactionTaskExtras } from "@/core/lib/factionDetail";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ factionId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { factionId } = await params;

        const faction = await db.query.factions.findFirst({ where: eq(factions.id, factionId) });
        if (!faction) {
            return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        }

        const gate = await db.query.factionGates.findFirst({ where: eq(factionGates.factionId, factionId) });

        const roster = await db
            .select({
                userId: factionMembers.userId,
                wallet: factionMembers.wallet,
                role: factionMembers.role,
                joinedAt: factionMembers.joinedAt,
                contributionPoints: factionMembers.contributionPoints,
                tasksContributed: factionMembers.tasksContributed,
                nickname: gameNicknames.nickname,
            })
            .from(factionMembers)
            .leftJoin(
                gameNicknames,
                and(eq(gameNicknames.userId, factionMembers.userId), eq(gameNicknames.gameId, factionMembers.gameId))
            )
            .where(eq(factionMembers.factionId, factionId))
            .orderBy(desc(factionMembers.contributionPoints));

        const taskExtras = await buildFactionTaskExtras(faction, faction.gameId);

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
                createdAt: faction.createdAt,
                promoCodePurchaseTx: faction.promoCodePurchaseTx,
                promoCodePurchasedAt: faction.promoCodePurchasedAt,
                hasGate: !!gate,
                gatePurchaseTx: gate?.purchaseTx ?? null,
                gatePurchasedAt: gate?.purchasedAt ?? null,
                ...taskExtras,
                roster,
            },
        });
    } catch (error) {
        console.error("[admin/factions/:factionId] Error:", error);
        return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ factionId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { factionId } = await params;
        const body = await req.json().catch(() => ({}));

        const sigError = verifyAdminAction(req, body, "deleteFaction", factionId);
        if (sigError) return sigError;

        const [deleted] = await db.delete(factions).where(eq(factions.id, factionId)).returning();
        if (!deleted) {
            return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[admin/factions/:factionId DELETE] Error:", error);
        return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }
}
