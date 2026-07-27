// app/api/internal/game/mail/mark-read/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { mailMessages } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, mailId } = body;

        if (!userId || !mailId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        await db
            .update(mailMessages)
            .set({ isRead: true })
            .where(and(eq(mailMessages.id, mailId), eq(mailMessages.recipientUserId, userId)));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[internal/mail/mark-read] Error:", error);
        return NextResponse.json({ error: "mark_read_failed" }, { status: 500 });
    }
}
