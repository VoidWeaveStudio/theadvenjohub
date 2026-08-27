// app/api/admin/players/[userId]/ash/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { applyLiveOps } from "@/core/lib/adminLiveSync";
import { readProgress } from "@/core/lib/adminProgress";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { userId } = await params;
        const body = await req.json();
        const delta = Math.trunc(Number(body.delta));

        if (!Number.isFinite(delta) || delta === 0) {
            return NextResponse.json({ error: "invalid_delta" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, delta > 0 ? "grantAsh" : "takeAsh", userId);
        if (sigError) return sigError;

        const { mode } = await applyLiveOps(userId, [{ kind: "ashDelta", delta }]);
        const bundle = await readProgress(userId);

        return NextResponse.json({
            success: true,
            mode,
            ash: Math.max(0, Math.floor(Number(bundle?.data?.ash) || 0)),
        });
    } catch (error) {
        console.error("[admin/players/:userId/ash] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
