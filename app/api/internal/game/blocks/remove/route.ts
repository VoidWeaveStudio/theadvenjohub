// app/api/internal/game/blocks/remove/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { playerBlocks } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { blockerUserId, blockedUserId } = body;

        if (!blockerUserId || !blockedUserId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        await db
            .delete(playerBlocks)
            .where(and(eq(playerBlocks.blockerUserId, blockerUserId), eq(playerBlocks.blockedUserId, blockedUserId)));

        return NextResponse.json({ success: true, blockedUserId });
    } catch (error) {
        console.error("[internal/blocks/remove] Error:", error);
        return NextResponse.json({ error: "unblock_failed" }, { status: 500 });
    }
}
