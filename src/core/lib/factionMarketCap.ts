// src/core/lib/factionMarketCap.ts
import { db } from "@/core/database";
import { factions } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { getTokenByCa } from "@/core/lib/dexscreener";

export { mcFrameTier, MC_FRAME_THRESHOLDS } from "@/core/lib/mcTier";

export const MC_STALE_MS = 10 * 60 * 1000;
const MAX_REFRESH_PER_PASS = 4;

export interface MarketCapRow {
    factionId: string;
    tokenCa: string | null;
    marketCap: number;
    marketCapAt: Date | null;
}

export async function refreshStaleMarketCaps(rows: MarketCapRow[]): Promise<Map<string, number>> {
    const fresh = new Map<string, number>();
    const now = Date.now();

    const stale = rows
        .filter((row) => !!row.tokenCa)
        .filter((row) => !row.marketCapAt || now - row.marketCapAt.getTime() > MC_STALE_MS)
        .slice(0, MAX_REFRESH_PER_PASS);

    if (stale.length === 0) return fresh;

    await Promise.all(stale.map(async (row) => {
        try {
            const token = await getTokenByCa(row.tokenCa!);
            const mc = Math.max(0, Math.round(Number(token?.mc) || 0));

            await db
                .update(factions)
                .set({ marketCap: mc, marketCapAt: new Date() })
                .where(eq(factions.id, row.factionId));

            fresh.set(row.factionId, mc);
        } catch {
            await db
                .update(factions)
                .set({ marketCapAt: new Date() })
                .where(eq(factions.id, row.factionId));
        }
    }));

    return fresh;
}
