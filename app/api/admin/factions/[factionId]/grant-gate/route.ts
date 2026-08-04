// app/api/admin/factions/[factionId]/grant-gate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { db } from "@/core/database";
import { factions, factionGates } from "@/core/database/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ factionId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { factionId } = await params;
        const body = await req.json();

        const sigError = verifyAdminAction(req, body, "grantFactionGate", factionId);
        if (sigError) return sigError;

        const faction = await db.query.factions.findFirst({ where: eq(factions.id, factionId) });
        if (!faction) {
            return NextResponse.json({ error: "faction_not_found" }, { status: 404 });
        }

        const existingGate = await db.query.factionGates.findFirst({ where: eq(factionGates.factionId, factionId) });
        if (existingGate) {
            return NextResponse.json({ error: "already_granted" }, { status: 409 });
        }

        let created;
        try {
            [created] = await db.insert(factionGates).values({
                factionId,
                purchaseTx: null,
            }).returning();
        } catch (insertError: any) {
            if (insertError?.code === "23505") {
                return NextResponse.json({ error: "already_granted" }, { status: 409 });
            }
            throw insertError;
        }

        return NextResponse.json({
            success: true,
            gate: { id: created.id, factionId: created.factionId, purchasedAt: created.purchasedAt },
        });
    } catch (error) {
        console.error("[admin/factions/:factionId/grant-gate] Error:", error);
        return NextResponse.json({ error: "grant_failed" }, { status: 500 });
    }
}
