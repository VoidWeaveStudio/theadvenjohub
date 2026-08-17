// src/core/lib/roomLayoutAccess.ts
import { db } from "@/core/database";
import { factions } from "@/core/database/schema";
import { eq } from "drizzle-orm";
import { canManageFaction } from "@/core/lib/factionAuth";

export type LotOwnerType = "personal" | "faction";

export async function canEditLot(
    ownerType: LotOwnerType,
    ownerId: string,
    userId: string
): Promise<boolean> {
    if (ownerType === "personal") return ownerId === userId;

    const [faction] = await db
        .select({
            founderUserId: factions.founderUserId,
            verifiedCreatorUserId: factions.verifiedCreatorUserId,
        })
        .from(factions)
        .where(eq(factions.id, ownerId))
        .limit(1);

    if (!faction) return false;
    return canManageFaction(faction, userId);
}
