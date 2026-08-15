// app/api/admin/players/[userId]/ash/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import { gameProgress } from "@/core/database/schema";
import { eq } from "drizzle-orm";
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
        const delta = Number(body.delta);

        if (!Number.isFinite(delta) || delta === 0) {
            return NextResponse.json({ error: "invalid_delta" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, delta > 0 ? "grantAsh" : "takeAsh", userId);
        if (sigError) return sigError;

        const row = await db.query.gameProgress.findFirst({ where: eq(gameProgress.userId, userId) });
        if (!row) {
            return NextResponse.json({ error: "no_progress" }, { status: 404 });
        }

        let data: Record<string, unknown> = {};
        if (row.data) {
            try {
                data = JSON.parse(row.data);
            } catch {
                data = {};
            }
        }

        const currentAsh = Math.max(0, Math.floor(Number(data.ash) || 0));
        const nextAsh = Math.max(0, currentAsh + Math.floor(delta));
        data.ash = nextAsh;

        await db
            .update(gameProgress)
            .set({ data: JSON.stringify(data), updatedAt: new Date() })
            .where(eq(gameProgress.id, row.id));

        return NextResponse.json({ success: true, ash: nextAsh });
    } catch (error) {
        console.error("[admin/players/:userId/ash] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
