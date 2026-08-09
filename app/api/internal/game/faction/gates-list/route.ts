// app/api/internal/game/faction/gates-list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factionGates, factions, users } from "@/core/database/schema";
import { eq, sql } from "drizzle-orm";
import { isAdminFaction } from "@/core/lib/adminFaction";

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
                    roomAccess: factions.roomAccess,
                    founderWallet: factions.founderWallet,
                })
                .from(factionGates)
                .innerJoin(factions, eq(factions.id, factionGates.factionId)),
            db.select({ value: sql<number>`count(*)::int` }).from(users),
        ]);

        const gates = rows.map(({ founderWallet, ...gate }) => ({
            ...gate,
            isAdmin: isAdminFaction(founderWallet, gate.tokenCa),
        }));

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
