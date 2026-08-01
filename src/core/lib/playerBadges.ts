// src/core/lib/playerBadges.ts
import { db } from "@/core/database";
import { factions } from "@/core/database/schema";
import { eq, and, inArray } from "drizzle-orm";

export function isAdminWallet(wallet: string | null | undefined): boolean {
    return !!process.env.ADMIN_WALLET && !!wallet && wallet === process.env.ADMIN_WALLET;
}

export async function isFactionCreatorWallet(gameId: string, wallet: string | null | undefined): Promise<boolean> {
    if (!wallet) return false;
    const row = await db.query.factions.findFirst({
        where: and(eq(factions.gameId, gameId), eq(factions.verifiedCreatorWallet, wallet)),
        columns: { id: true },
    });
    return !!row;
}

export async function getFactionCreatorWallets(gameId: string, wallets: string[]): Promise<Set<string>> {
    const unique = Array.from(new Set(wallets.filter(Boolean)));
    if (unique.length === 0) return new Set();

    const rows = await db
        .select({ verifiedCreatorWallet: factions.verifiedCreatorWallet })
        .from(factions)
        .where(and(eq(factions.gameId, gameId), inArray(factions.verifiedCreatorWallet, unique)));

    return new Set(rows.map((r) => r.verifiedCreatorWallet).filter((w): w is string => !!w));
}
