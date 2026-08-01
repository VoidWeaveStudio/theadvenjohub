// app/api/internal/game/support/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { supportTickets } from "@/core/database/schema";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, wallet, subject, message } = body;

        if (
            !userId || !gameId || !wallet ||
            typeof subject !== "string" || subject.trim().length === 0 ||
            typeof message !== "string" || message.trim().length === 0
        ) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const [inserted] = await db.insert(supportTickets).values({
            userId,
            gameId,
            wallet,
            subject: subject.trim().slice(0, 100),
            message: message.trim().slice(0, 2000),
        }).returning();

        return NextResponse.json({ success: true, ticketId: inserted.id });
    } catch (error) {
        console.error("[internal/support/send] Error:", error);
        return NextResponse.json({ error: "send_failed" }, { status: 500 });
    }
}
