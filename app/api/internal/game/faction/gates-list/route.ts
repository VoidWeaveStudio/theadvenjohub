// app/api/internal/game/faction/gates-list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyInternalRequest, unauthorizedResponse } from "@/core/lib/internalAuth";
import { db } from "@/core/database";
import { factionGates, factions } from "@/core/database/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
    if (!verifyInternalRequest(req)) {
        return unauthorizedResponse();
    }

    try {
        const rows = await db
            .select({
                factionId: factions.id,
                factionName: factions.name,
                symbol: factions.symbol,
                image: factions.image,
                tokenCa: factions.tokenCa,
            })
            .from(factionGates)
            .innerJoin(factions, eq(factions.id, factionGates.factionId));

        return NextResponse.json({ success: true, gates: rows });
    } catch (error) {
        console.error("[internal/faction/gates-list] Error:", error);
        return NextResponse.json({ error: "list_failed" }, { status: 500 });
    }
}
