// app/api/admin/players/[userId]/level/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { applyLiveOps } from "@/core/lib/adminLiveSync";
import { MAX_LEVEL, skillPointsForLevel, totalXpForLevel } from "@/features/game/data/progression";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { userId } = await params;
        const body = await req.json();
        const level = Math.floor(Number(body.level));

        if (!Number.isFinite(level) || level < 1 || level > MAX_LEVEL) {
            return NextResponse.json({ error: "invalid_level" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, "setLevel", userId);
        if (sigError) return sigError;

        const totalXp = totalXpForLevel(level);
        const { mode } = await applyLiveOps(userId, [{ kind: "progressionSet", level, totalXp }]);

        return NextResponse.json({
            success: true,
            mode,
            level,
            totalXp,
            skillPoints: skillPointsForLevel(level),
        });
    } catch (error) {
        console.error("[admin/players/:userId/level] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
