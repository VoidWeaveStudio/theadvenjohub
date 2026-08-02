// app/api/internal/game/chat/log/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { chatMessages } from "@/core/database/schema";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { gameId, senderUserId, senderWallet, senderNickname, factionId, message } = body;

        if (!gameId || !senderUserId || !senderWallet || !senderNickname || typeof message !== "string") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        await db.insert(chatMessages).values({
            gameId,
            senderUserId,
            senderWallet,
            senderNickname: senderNickname.slice(0, 30),
            factionId: factionId || null,
            message: message.slice(0, 500),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[internal/chat/log] Error:", error);
        return NextResponse.json({ error: "log_failed" }, { status: 500 });
    }
}
