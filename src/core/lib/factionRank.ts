// src/core/lib/factionRank.ts
import { db } from "@/core/database";
import { factions, factionMembers } from "@/core/database/schema";
import { eq, desc, count } from "drizzle-orm";

export interface RankedFaction {
    id: string;
    number: number;
    name: string;
    symbol: string | null;
    image: string | null;
    description: string | null;
    tokenCa: string | null;
    founderWallet: string;
    memberCount: number;
    rank: number;
}

export async function getFactionsRankedByGame(gameId: string, limit = 200): Promise<RankedFaction[]> {
    const memberCount = count(factionMembers.id);

    const rows = await db
        .select({
            id: factions.id,
            number: factions.number,
            name: factions.name,
            symbol: factions.symbol,
            image: factions.image,
            description: factions.description,
            tokenCa: factions.tokenCa,
            founderWallet: factions.founderWallet,
            memberCount,
        })
        .from(factions)
        .leftJoin(factionMembers, eq(factionMembers.factionId, factions.id))
        .where(eq(factions.gameId, gameId))
        .groupBy(factions.id)
        .orderBy(desc(memberCount))
        .limit(limit);

    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function getFactionRank(gameId: string, factionId: string): Promise<number | null> {
    const ranked = await getFactionsRankedByGame(gameId);
    const found = ranked.find((f) => f.id === factionId);
    return found ? found.rank : null;
}
