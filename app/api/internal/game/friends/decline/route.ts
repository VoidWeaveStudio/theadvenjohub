// app/api/internal/game/friends/decline/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { friendships } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, requestUserId } = body;

        if (!userId || !requestUserId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        await db
            .delete(friendships)
            .where(
                and(
                    eq(friendships.userId, requestUserId),
                    eq(friendships.friendUserId, userId),
                    eq(friendships.status, "pending")
                )
            );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[internal/friends/decline] Error:", error);
        return NextResponse.json({ error: "decline_failed" }, { status: 500 });
    }
}
