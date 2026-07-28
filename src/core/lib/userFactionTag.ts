// src/core/lib/userFactionTag.ts
import { db } from "@/core/database";
import { factionMembers, factions } from "@/core/database/schema";
import { eq, and } from "drizzle-orm";

export type UserFactionTag = { name: string; symbol: string | null; image: string | null; number: number } | null;

export async function getUserFactionTag(userId: string, gameId: string): Promise<UserFactionTag> {
    const membership = await db.query.factionMembers.findFirst({
        where: and(eq(factionMembers.userId, userId), eq(factionMembers.gameId, gameId)),
    });
    if (!membership) return null;

    const factionRow = await db.query.factions.findFirst({ where: eq(factions.id, membership.factionId) });
    if (!factionRow) return null;

    return {
        name: factionRow.name,
        symbol: factionRow.symbol,
        image: factionRow.image,
        number: factionRow.number,
    };
}
