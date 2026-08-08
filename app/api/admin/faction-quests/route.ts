// app/api/admin/faction-quests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/core/admin/requireAdmin";
import { db } from "@/core/database";
import { factionQuests, factions, gameNicknames } from "@/core/database/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
    const admin = requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    try {
        const rows = await db
            .select({
                id: factionQuests.id,
                factionId: factionQuests.factionId,
                factionName: factions.name,
                factionSymbol: factions.symbol,
                factionImage: factions.image,
                createdByWallet: factionQuests.createdByWallet,
                createdByNickname: gameNicknames.nickname,
                questType: factionQuests.questType,
                targetUrl: factionQuests.targetUrl,
                rewardAsh: factionQuests.rewardAsh,
                slotsTotal: factionQuests.slotsTotal,
                slotsClaimed: factionQuests.slotsClaimed,
                bankAsh: factionQuests.bankAsh,
                paidOutAsh: factionQuests.paidOutAsh,
                listingFeeAsh: factionQuests.listingFeeAsh,
                status: factionQuests.status,
                createdAt: factionQuests.createdAt,
                completedAt: factionQuests.completedAt,
            })
            .from(factionQuests)
            .innerJoin(factions, eq(factions.id, factionQuests.factionId))
            .leftJoin(
                gameNicknames,
                and(
                    eq(gameNicknames.userId, factionQuests.createdByUserId),
                    eq(gameNicknames.gameId, factionQuests.gameId)
                )
            )
            .orderBy(desc(factionQuests.createdAt))
            .limit(200);

        return NextResponse.json({
            quests: rows.map((r) => ({
                ...r,
                slotsRemaining: Math.max(0, r.slotsTotal - r.slotsClaimed),
                bankRemainingAsh: Math.max(0, r.bankAsh - r.paidOutAsh),
            })),
        });
    } catch (error) {
        console.error("[admin/faction-quests] GET Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
