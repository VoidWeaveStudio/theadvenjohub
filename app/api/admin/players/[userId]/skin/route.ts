// app/api/admin/players/[userId]/skin/route.ts
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

        const sigError = verifyAdminAction(req, body, "resetSkin", userId);
        if (sigError) return sigError;

        const row = await db.query.gameProgress.findFirst({ where: eq(gameProgress.userId, userId) });
        if (!row) {
            return NextResponse.json({ success: true, skinTextureUrl: null });
        }

        let data: Record<string, unknown> = {};
        if (row.data) {
            try {
                data = JSON.parse(row.data);
            } catch {
                data = {};
            }
        }
        data.skinTextureUrl = null;

        await db
            .update(gameProgress)
            .set({ data: JSON.stringify(data), updatedAt: new Date() })
            .where(eq(gameProgress.id, row.id));

        return NextResponse.json({ success: true, skinTextureUrl: null });
    } catch (error) {
        console.error("[admin/players/:userId/skin] Error:", error);
        return NextResponse.json({ error: "reset_failed" }, { status: 500 });
    }
}
