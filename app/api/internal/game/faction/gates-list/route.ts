// app/api/internal/game/faction/gates-list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factionGates, factions, users } from "@/core/database/schema";
import { eq, sql } from "drizzle-orm";
import { isAdminFaction } from "@/core/lib/adminFaction";
import { refreshStaleMarketCaps, mcFrameTier } from "@/core/lib/factionMarketCap";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const [rows, countRows] = await Promise.all([
            db
                .select({
                    factionId: factions.id,
                    factionName: factions.name,
                    number: factions.number,
                    symbol: factions.symbol,
                    image: factions.image,
                    tokenCa: factions.tokenCa,
                    level: factions.level,
                    founderWallet: factions.founderWallet,
                    marketCap: factions.marketCap,
                    marketCapAt: factions.marketCapAt,
                })
                .from(factionGates)
                .innerJoin(factions, eq(factions.id, factionGates.factionId)),
            db.select({ value: sql<number>`count(*)::int` }).from(users),
        ]);

        const fresh = await refreshStaleMarketCaps(rows.map((row) => ({
            factionId: row.factionId,
            tokenCa: row.tokenCa,
            marketCap: row.marketCap,
            marketCapAt: row.marketCapAt,
        })));

        const gates = rows.map(({ founderWallet, marketCap, marketCapAt, ...gate }) => {
            void marketCapAt;
            const mc = fresh.get(gate.factionId) ?? marketCap;

            return {
                ...gate,
                isAdmin: isAdminFaction(founderWallet, gate.tokenCa),
                marketCap: mc,
                mcTier: mcFrameTier(mc),
            };
        });

        return NextResponse.json({
            success: true,
            gates,
            accountCount: countRows[0]?.value ?? 0,
        });
    } catch (error) {
        console.error("[internal/faction/gates-list] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
