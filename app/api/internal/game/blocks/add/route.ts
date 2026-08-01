// app/api/internal/game/blocks/add/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { users, gameNicknames, playerBlocks } from "@/core/database/schema";
import { eq, and, ilike } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { blockerUserId, gameId, targetWallet, targetNickname } = body;

        if (!blockerUserId || !gameId || (!targetWallet && !targetNickname)) {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        let targetUser;
        if (typeof targetWallet === "string" && targetWallet.trim().length > 0) {
            targetUser = await db.query.users.findFirst({ where: eq(users.wallet, targetWallet.trim()) });
        } else if (typeof targetNickname === "string" && targetNickname.trim().length > 0) {
            const nickRow = await db.query.gameNicknames.findFirst({
                where: and(eq(gameNicknames.gameId, gameId), ilike(gameNicknames.nickname, targetNickname.trim())),
            });
            if (nickRow) {
                targetUser = await db.query.users.findFirst({ where: eq(users.id, nickRow.userId) });
            }
        }

        if (!targetUser) {
            return NextResponse.json({ error: "user_not_found" }, { status: 404 });
        }
        if (targetUser.id === blockerUserId) {
            return NextResponse.json({ error: "cannot_block_self" }, { status: 400 });
        }

        await db.insert(playerBlocks).values({
            blockerUserId,
            blockedUserId: targetUser.id,
        }).onConflictDoNothing();

        const nick = await db.query.gameNicknames.findFirst({
            where: and(eq(gameNicknames.userId, targetUser.id), eq(gameNicknames.gameId, gameId)),
        });

        return NextResponse.json({
            success: true,
            blockedUserId: targetUser.id,
            blockedWallet: targetUser.wallet,
            blockedNickname: nick?.nickname || null,
        });
    } catch (error) {
        console.error("[internal/blocks/add] Error:", error);
        return NextResponse.json({ error: "block_failed" }, { status: 500 });
    }
}
