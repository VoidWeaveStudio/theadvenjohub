// app/api/admin/players/[userId]/skin/route.ts
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

        const sigError = await verifyAdminAction(req, body, "resetSkin", userId);
        if (sigError) return sigError;

        const { mode } = await applyLiveOps(userId, [{ kind: "skinReset" }]);

        return NextResponse.json({ success: true, mode, skinTextureUrl: null });
    } catch (error) {
        console.error("[admin/players/:userId/skin] Error:", error);
        return NextResponse.json({ error: "reset_failed" }, { status: 500 });
    }
}
