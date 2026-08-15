// app/api/admin/players/[userId]/placeables/route.ts
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
        const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
        const delta = Number(body.delta);

        if (!itemId || !Number.isFinite(delta) || delta === 0) {
            return NextResponse.json({ error: "invalid_request" }, { status: 400 });
        }

        const sigError = await verifyAdminAction(req, body, delta > 0 ? "grantItem" : "takeItem", `${userId}:${itemId}`);
        if (sigError) return sigError;

        const row = await db.query.gameProgress.findFirst({ where: eq(gameProgress.userId, userId) });
        if (!row) {
            return NextResponse.json({ error: "no_progress" }, { status: 404 });
        }

        let data: Record<string, any> = {};
        if (row.data) {
            try {
                data = JSON.parse(row.data);
            } catch {
                data = {};
            }
        }

        const placeables: Record<string, number> = (data.placeables && typeof data.placeables === "object") ? data.placeables : {};
        const current = Math.max(0, Math.floor(Number(placeables[itemId]) || 0));
        const next = Math.max(0, current + Math.floor(delta));
        if (next > 0) {
            placeables[itemId] = next;
        } else {
            delete placeables[itemId];
        }
        data.placeables = placeables;

        await db
            .update(gameProgress)
            .set({ data: JSON.stringify(data), updatedAt: new Date() })
            .where(eq(gameProgress.id, row.id));

        return NextResponse.json({ success: true, placeables });
    } catch (error) {
        console.error("[admin/players/:userId/placeables] Error:", error);
        return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
}
