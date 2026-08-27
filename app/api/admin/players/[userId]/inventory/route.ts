// app/api/admin/players/[userId]/inventory/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { applyLiveOps } from "@/core/lib/adminLiveSync";

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

        if (!Number.isInteger(slot) || slot < 0) {
            return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, "removeInventoryItem", `${userId}:${slot}`);
        if (sigError) return sigError;

        const { mode } = await applyLiveOps(userId, [{ kind: "inventoryRemoveSlot", slot }]);

        return NextResponse.json({ success: true, mode });
    } catch (error) {
        console.error("[admin/players/:userId/inventory] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
