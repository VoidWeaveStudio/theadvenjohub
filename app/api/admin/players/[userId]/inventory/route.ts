// app/api/admin/players/[userId]/inventory/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import { gameInventories } from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { userId } = await params;
        const body = await req.json();
        const slot = Number(body.slot);

        if (!Number.isInteger(slot)) {
            return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, "removeInventoryItem", `${userId}:${slot}`);
        if (sigError) return sigError;

        const [deleted] = await db
            .delete(gameInventories)
            .where(and(eq(gameInventories.userId, userId), eq(gameInventories.slot, slot)))
            .returning();

        if (!deleted) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[admin/players/:userId/inventory] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
