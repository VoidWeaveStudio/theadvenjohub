// app/api/internal/game/mail/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { users, gameNicknames, mailMessages } from "@/core/database/schema";
import { eq, and, ilike } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, wallet, recipientWallet, recipientNickname, subject, body: mailBody } = body;

        if (!userId || !gameId || !wallet || typeof subject !== "string" || typeof mailBody !== "string") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }
        if (!recipientWallet && !recipientNickname) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const trimmedSubject = subject.trim().slice(0, 100);
        const trimmedBody = mailBody.trim().slice(0, 2000);
        if (trimmedSubject.length === 0 || trimmedBody.length === 0) {
            return NextResponse.json({ error: "invalid_message" }, { status: 400 });
        }

        let recipient;
        if (typeof recipientWallet === "string" && recipientWallet.trim().length > 0) {
            recipient = await db.query.users.findFirst({ where: eq(users.wallet, recipientWallet.trim()) });
        } else if (typeof recipientNickname === "string" && recipientNickname.trim().length > 0) {
            const nickRow = await db.query.gameNicknames.findFirst({
                where: and(eq(gameNicknames.gameId, gameId), ilike(gameNicknames.nickname, recipientNickname.trim())),
            });
            if (nickRow) {
                recipient = await db.query.users.findFirst({ where: eq(users.id, nickRow.userId) });
            }
        }

        if (!recipient) {
            return NextResponse.json({ error: "recipient_not_found" }, { status: 404 });
        }
        if (recipient.id === userId) {
            return NextResponse.json({ error: "cannot_mail_self" }, { status: 400 });
        }

        const [inserted] = await db.insert(mailMessages).values({
            senderUserId: userId,
            senderWallet: wallet,
            recipientUserId: recipient.id,
            subject: trimmedSubject,
            body: trimmedBody,
        }).returning();

        return NextResponse.json({ success: true, mailId: inserted.id, recipientUserId: recipient.id });
    } catch (error) {
        console.error("[internal/mail/send] Error:", error);
        return NextResponse.json({ error: "send_failed" }, { status: 500 });
    }
}
