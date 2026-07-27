// app/api/internal/game/friends/remove/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { friendships } from "@/core/database/schema";
import { eq, and, or } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, friendUserId } = body;

        if (!userId || !friendUserId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        await db
            .delete(friendships)
            .where(
                or(
                    and(eq(friendships.userId, userId), eq(friendships.friendUserId, friendUserId)),
                    and(eq(friendships.userId, friendUserId), eq(friendships.friendUserId, userId))
                )
            );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[internal/friends/remove] Error:", error);
        return NextResponse.json({ error: "remove_failed" }, { status: 500 });
    }
}
