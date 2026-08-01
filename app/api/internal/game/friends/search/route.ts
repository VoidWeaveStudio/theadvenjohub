// app/api/internal/game/friends/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { users, gameNicknames } from "@/core/database/schema";
import { eq, and, ilike, ne } from "drizzle-orm";
import { getUserFactionTag, UserFactionTag } from "@/core/lib/userFactionTag";
import { isAdminWallet, isFactionCreatorWallet } from "@/core/lib/playerBadges";

const MAX_RESULTS = 20;

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { gameId, userId, query } = body;

        const trimmed = typeof query === "string" ? query.trim() : "";
        if (!gameId || trimmed.length === 0) {
            return NextResponse.json({ results: [] });
        }

        const results: { userId: string; wallet: string; nickname: string | null; faction: UserFactionTag; isAdmin: boolean; isFactionCreator: boolean }[] = [];

        const byWallet = await db.query.users.findFirst({ where: eq(users.wallet, trimmed) });
        if (byWallet && byWallet.id !== userId) {
            const nick = await db.query.gameNicknames.findFirst({
                where: and(eq(gameNicknames.userId, byWallet.id), eq(gameNicknames.gameId, gameId)),
            });
            const faction = await getUserFactionTag(byWallet.id, gameId);
            results.push({
                userId: byWallet.id,
                wallet: byWallet.wallet,
                nickname: nick?.nickname || null,
                faction,
                isAdmin: isAdminWallet(byWallet.wallet),
                isFactionCreator: await isFactionCreatorWallet(gameId, byWallet.wallet),
            });
        }

        const byNickname = await db
            .select({ userId: gameNicknames.userId, nickname: gameNicknames.nickname, wallet: users.wallet })
            .from(gameNicknames)
            .innerJoin(users, eq(users.id, gameNicknames.userId))
            .where(and(eq(gameNicknames.gameId, gameId), ilike(gameNicknames.nickname, `%${trimmed}%`), ne(gameNicknames.userId, userId || "")))
            .limit(MAX_RESULTS);

        for (const row of byNickname) {
            if (!results.some((r) => r.userId === row.userId)) {
                const faction = await getUserFactionTag(row.userId, gameId);
                results.push({
                    userId: row.userId,
                    wallet: row.wallet,
                    nickname: row.nickname,
                    faction,
                    isAdmin: isAdminWallet(row.wallet),
                    isFactionCreator: await isFactionCreatorWallet(gameId, row.wallet),
                });
            }
        }

        return NextResponse.json({ results: results.slice(0, MAX_RESULTS) });
    } catch (error) {
        console.error("[internal/friends/search] Error:", error);
        return NextResponse.json({ error: "search_failed" }, { status: 500 });
    }
}
