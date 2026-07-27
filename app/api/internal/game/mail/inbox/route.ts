// app/api/internal/game/mail/inbox/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { mailMessages, gameNicknames } from "@/core/database/schema";
import { eq, and, desc } from "drizzle-orm";

const MAX_RESULTS = 100;

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId } = body;

        if (!userId || !gameId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const rows = await db
            .select({
                id: mailMessages.id,
                senderUserId: mailMessages.senderUserId,
                senderWallet: mailMessages.senderWallet,
                subject: mailMessages.subject,
                body: mailMessages.body,
                isRead: mailMessages.isRead,
                createdAt: mailMessages.createdAt,
                senderNickname: gameNicknames.nickname,
            })
            .from(mailMessages)
            .leftJoin(
                gameNicknames,
                and(eq(gameNicknames.userId, mailMessages.senderUserId), eq(gameNicknames.gameId, gameId))
            )
            .where(eq(mailMessages.recipientUserId, userId))
            .orderBy(desc(mailMessages.createdAt))
            .limit(MAX_RESULTS);

        const unreadCount = rows.filter((r) => !r.isRead).length;

        return NextResponse.json({ mail: rows, unreadCount });
    } catch (error) {
        console.error("[internal/mail/inbox] Error:", error);
        return NextResponse.json({ error: "inbox_failed" }, { status: 500 });
    }
}
