// app/api/internal/game/player-profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { users, gameNicknames, gameStatistics, gameProgress, factionMembers, factions } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const body = await req.json();
        const { gameId, wallet } = body;

        if (!gameId || typeof wallet !== "string") {
            return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
        }

        const user = await db.query.users.findFirst({ where: eq(users.wallet, wallet) });
        if (!user) {
            return NextResponse.json({ profile: null });
        }

        const [nickname, statistics, progress, memberships] = await Promise.all([
            db.query.gameNicknames.findFirst({
                where: and(eq(gameNicknames.userId, user.id), eq(gameNicknames.gameId, gameId)),
            }),
            db.query.gameStatistics.findFirst({
                where: and(eq(gameStatistics.userId, user.id), eq(gameStatistics.gameId, gameId)),
            }),
            db.query.gameProgress.findFirst({
                where: and(eq(gameProgress.userId, user.id), eq(gameProgress.gameId, gameId)),
            }),
            db.query.factionMembers.findMany({
                where: and(eq(factionMembers.userId, user.id), eq(factionMembers.gameId, gameId)),
            }),
        ]);

        let ash = 0;
        if (progress?.data) {
            try {
                const parsed = JSON.parse(progress.data);
                ash = Number(parsed?.ash) || 0;
            } catch {
                ash = 0;
            }
        }

        const factionsList: Array<{
            id: string; number: number; name: string; symbol: string | null; image: string | null;
            founderWallet: string; verifiedCreatorWallet: string | null; isDisplayed: boolean;
        }> = [];
        for (const membership of memberships) {
            const factionRow = await db.query.factions.findFirst({ where: eq(factions.id, membership.factionId) });
            if (!factionRow) continue;
            factionsList.push({
                id: factionRow.id,
                number: factionRow.number,
                name: factionRow.name,
                symbol: factionRow.symbol,
                image: factionRow.image,
                founderWallet: factionRow.founderWallet,
                verifiedCreatorWallet: factionRow.verifiedCreatorWallet,
                isDisplayed: membership.isDisplayed,
            });
        }

        return NextResponse.json({
            profile: {
                wallet: user.wallet,
                nickname: nickname?.nickname || null,
                kills: statistics?.kills ?? 0,
                deaths: statistics?.deaths ?? 0,
                playtimeSeconds: statistics?.playtimeSeconds ?? 0,
                ash,
                factions: factionsList,
            },
        });
    } catch (error) {
        console.error("[internal/player-profile] Error:", error);
        return NextResponse.json({ error: "profile_failed" }, { status: 500 });
    }
}
