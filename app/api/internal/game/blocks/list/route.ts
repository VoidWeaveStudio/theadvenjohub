// app/api/internal/game/blocks/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { playerBlocks, users, gameNicknames } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";
import { isAdminWallet, getFactionCreatorWallets } from "@/core/lib/playerBadges";

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
                userId: users.id,
                wallet: users.wallet,
                nickname: gameNicknames.nickname,
            })
            .from(playerBlocks)
            .innerJoin(users, eq(users.id, playerBlocks.blockedUserId))
            .leftJoin(gameNicknames, and(eq(gameNicknames.userId, users.id), eq(gameNicknames.gameId, gameId)))
            .where(eq(playerBlocks.blockerUserId, userId));

        const creatorWallets = await getFactionCreatorWallets(gameId, rows.map((r) => r.wallet));
        const blocked = rows.map((r) => ({
            ...r,
            isAdmin: isAdminWallet(r.wallet),
            isFactionCreator: creatorWallets.has(r.wallet),
        }));

        return NextResponse.json({ blocked });
    } catch (error) {
        console.error("[internal/blocks/list] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
