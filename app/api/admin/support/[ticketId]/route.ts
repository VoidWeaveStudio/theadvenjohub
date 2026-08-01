// app/api/admin/support/[ticketId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { verifyAdminAction } from "@/core/admin/verifyAdminAction";
import { db } from "@/core/database";
import { supportTickets, mailMessages } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { getOrCreateSystemUser } from "@/core/lib/systemMailSender";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ ticketId: string }> }
) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const { ticketId } = await params;
        const body = await req.json();
        const { reply } = body;

        if (typeof reply !== "string" || reply.trim().length === 0) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const sigError = verifyAdminAction(req, body, "support_reply", ticketId);
        if (sigError) return sigError;

        const trimmedReply = reply.trim().slice(0, 2000);

        const [ticket] = await db
            .update(supportTickets)
            .set({ reply: trimmedReply, status: "answered", repliedAt: new Date() })
            .where(eq(supportTickets.id, ticketId))
            .returning();

        if (!ticket) {
            return NextResponse.json({ error: "ticket_not_found" }, { status: 404 });
        }

        const systemUser = await getOrCreateSystemUser();
        if (systemUser) {
            await db.insert(mailMessages).values({
                senderUserId: systemUser.id,
                senderWallet: systemUser.wallet,
                recipientUserId: ticket.userId,
                subject: "Support replied to your message",
                body: `Your message:\n${ticket.message}\n\nReply:\n${trimmedReply}`,
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[admin/support/:ticketId] Error:", error);
        return NextResponse.json({ error: "reply_failed" }, { status: 500 });
    }
}
