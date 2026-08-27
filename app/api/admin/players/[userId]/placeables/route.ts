// app/api/admin/players/[userId]/placeables/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { applyLiveOps } from "@/core/lib/adminLiveSync";
import { readPlaceables, readProgress } from "@/core/lib/adminProgress";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { userId } = await params;
        const body = await req.json();
        const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
        const delta = Math.trunc(Number(body.delta));

        if (!itemId || !Number.isFinite(delta) || delta === 0) {
            return NextResponse.json({ error: "invalid_request" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, delta > 0 ? "grantItem" : "takeItem", `${userId}:${itemId}`);
        if (sigError) return sigError;

        const { mode } = await applyLiveOps(userId, [{ kind: "placeableDelta", itemId, delta }]);
        const bundle = await readProgress(userId);

        return NextResponse.json({
            success: true,
            mode,
            placeables: bundle ? readPlaceables(bundle) : {},
        });
    } catch (error) {
        console.error("[admin/players/:userId/placeables] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
