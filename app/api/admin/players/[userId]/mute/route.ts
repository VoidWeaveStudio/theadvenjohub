// app/api/admin/players/[userId]/mute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import { users } from "@/core/database/schema";
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
        const { durationMinutes } = body;

        const MAX_MUTE_MINUTES = 30 * 24 * 60;
        if (durationMinutes !== null && (typeof durationMinutes !== "number" || durationMinutes <= 0 || durationMinutes > MAX_MUTE_MINUTES)) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const sigError = verifyAdminAction(req, body, durationMinutes === null ? "unmute" : "mute", userId);
        if (sigError) return sigError;

        const mutedUntil = durationMinutes === null ? null : new Date(Date.now() + durationMinutes * 60_000);

        const [updated] = await db
            .update(users)
            .set({ mutedUntil, updatedAt: new Date() })
            .where(eq(users.id, userId))
            .returning();

        if (!updated) {
            return NextResponse.json({ error: "user_not_found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, mutedUntil: updated.mutedUntil });
    } catch (error) {
        console.error("[admin/players/:userId/mute] Error:", error);
        return NextResponse.json({ error: "mute_failed" }, { status: 500 });
    }
}
