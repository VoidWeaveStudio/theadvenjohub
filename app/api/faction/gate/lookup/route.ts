// app/api/faction/gate/lookup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/core/database";
import { factions, factionGates } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/core/auth/lib/auth";
import { checkRateLimit, formatRateLimitHeaders, getClientIp } from "@/core/lib/rateLimit";
import { canManageFaction } from "@/core/lib/factionAuth";

export async function GET(req: NextRequest) {
    const ip = getClientIp(req);
    const rl = await checkRateLimit(`faction:gate:lookup:${ip}`, {
        maxAttempts: 20,
        windowMs: 60_000,
        prefix: "api:faction:gate:lookup",
    });
    if (!rl.allowed) {
        return NextResponse.json({ error: "too_many_attempts" }, { status: 429, headers: formatRateLimitHeaders(rl) });
    }

    try {
        const { searchParams } = new URL(req.url);
        const ca = searchParams.get("ca")?.trim();
        if (!ca || ca.length < 32) {
            return NextResponse.json({ error: "invalid_ca" }, { status: 400, headers: formatRateLimitHeaders(rl) });
        }

        const faction = await db.query.factions.findFirst({ where: eq(factions.tokenCa, ca) });
        if (!faction) {
            return NextResponse.json({ faction: null }, { headers: formatRateLimitHeaders(rl) });
        }

        const gate = await db.query.factionGates.findFirst({ where: eq(factionGates.factionId, faction.id) });

        let canPurchase = false;
        if (!gate) {
            const authResult = await requireAuth(req);
            if (!(authResult instanceof NextResponse)) {
                canPurchase = canManageFaction(faction, authResult.user.userId);
            }
        }

        return NextResponse.json({
            faction: {
                id: faction.id,
                name: faction.name,
                symbol: faction.symbol,
                image: faction.image,
                tokenCa: faction.tokenCa,
            },
            hasGate: !!gate,
            canPurchase,
        }, { headers: formatRateLimitHeaders(rl) });
    } catch (error) {
        console.error("[faction/gate/lookup] Error:", error);
        return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
    }
}
