// app/api/internal/game/friends/request/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { users, gameNicknames, friendships } from "@/core/database/schema";
import { eq, and, or } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { userId, gameId, targetWallet, targetNickname } = body;

        if (!userId || !gameId || (!targetWallet && !targetNickname)) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        let targetUser;
        if (typeof targetWallet === "string" && targetWallet.trim().length > 0) {
            targetUser = await db.query.users.findFirst({ where: eq(users.wallet, targetWallet.trim()) });
        } else if (typeof targetNickname === "string" && targetNickname.trim().length > 0) {
            const nickRow = await db.query.gameNicknames.findFirst({
                where: and(eq(gameNicknames.gameId, gameId), eq(gameNicknames.nickname, targetNickname.trim())),
            });
            if (nickRow) {
                targetUser = await db.query.users.findFirst({ where: eq(users.id, nickRow.userId) });
            }
        }

        if (!targetUser) {
            return NextResponse.json({ error: "user_not_found" }, { status: 404 });
        }
        if (targetUser.id === userId) {
            return NextResponse.json({ error: "cannot_friend_self" }, { status: 400 });
        }

        const existingEither = await db.query.friendships.findFirst({
            where: or(
                and(eq(friendships.userId, userId), eq(friendships.friendUserId, targetUser.id)),
                and(eq(friendships.userId, targetUser.id), eq(friendships.friendUserId, userId))
            ),
        });

        if (existingEither) {
            if (existingEither.status === "accepted") {
                return NextResponse.json({ error: "already_friends" }, { status: 409 });
            }
            if (existingEither.userId === userId) {
                return NextResponse.json({ error: "request_already_sent" }, { status: 409 });
            }

            const [accepted] = await db
                .update(friendships)
                .set({ status: "accepted", respondedAt: new Date() })
                .where(eq(friendships.id, existingEither.id))
                .returning();

            const nick = await db.query.gameNicknames.findFirst({
                where: and(eq(gameNicknames.userId, targetUser.id), eq(gameNicknames.gameId, gameId)),
            });

            return NextResponse.json({
                success: true,
                status: accepted.status,
                friend: { userId: targetUser.id, wallet: targetUser.wallet, nickname: nick?.nickname || null },
            });
        }

        await db.insert(friendships).values({
            userId,
            friendUserId: targetUser.id,
            status: "pending",
        });

        const nick = await db.query.gameNicknames.findFirst({
            where: and(eq(gameNicknames.userId, targetUser.id), eq(gameNicknames.gameId, gameId)),
        });

        return NextResponse.json({
            success: true,
            status: "pending",
            friend: { userId: targetUser.id, wallet: targetUser.wallet, nickname: nick?.nickname || null },
        });
    } catch (error) {
        console.error("[internal/friends/request] Error:", error);
        return NextResponse.json({ error: "request_failed" }, { status: 500 });
    }
}
