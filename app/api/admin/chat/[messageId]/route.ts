// app/api/admin/chat/[messageId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import { chatMessages } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ messageId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { messageId } = await params;
        const body = await req.json();

        const sigError = await verifyAdminAction(req, body, "deleteChatMessage", messageId);
        if (sigError) return sigError;

        const [row] = await db
            .update(chatMessages)
            .set({ deletedAt: new Date(), deletedByAdminWallet: body.wallet })
            .where(eq(chatMessages.id, messageId))
            .returning();

        if (!row) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[admin/chat/:messageId] Error:", error);
        return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }
}
