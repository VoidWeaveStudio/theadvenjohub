// app/api/internal/game/friends/accept/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { users, gameNicknames, friendships } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, requestUserId } = body;

        if (!userId || !gameId || !requestUserId) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const pending = await db.query.friendships.findFirst({
            where: and(
                eq(friendships.userId, requestUserId),
                eq(friendships.friendUserId, userId),
                eq(friendships.status, "pending")
            ),
        });

        if (!pending) {
            return NextResponse.json({ error: "request_not_found" }, { status: 404 });
        }

        await db
            .update(friendships)
            .set({ status: "accepted", respondedAt: new Date() })
            .where(eq(friendships.id, pending.id));

        const requester = await db.query.users.findFirst({ where: eq(users.id, requestUserId) });
        const nick = await db.query.gameNicknames.findFirst({
            where: and(eq(gameNicknames.userId, requestUserId), eq(gameNicknames.gameId, gameId)),
        });

        return NextResponse.json({
            success: true,
            friend: { userId: requestUserId, wallet: requester?.wallet || "", nickname: nick?.nickname || null },
        });
    } catch (error) {
        console.error("[internal/friends/accept] Error:", error);
        return NextResponse.json({ error: "accept_failed" }, { status: 500 });
    }
}
