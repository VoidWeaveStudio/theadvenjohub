// src/core/lib/cosmeticCrates.ts
import { randomInt } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/core/database";
import { gameCosmetics, gameCosmeticWallet, gameCrateOpenings } from "@/core/database/schema";
import {
    COSMETICS,
    COSMETIC_FRAGMENTS_PER_CRATE,
    cosmeticRarity,
    isCosmeticId,
    type CosmeticId,
} from "@/features/game/data/cosmetics";

export interface CosmeticCrateState {
    owned: string[];
    fragments: number;
    crates: number;
}

export const EMPTY_COSMETIC_CRATE_STATE: CosmeticCrateState = { owned: [], fragments: 0, crates: 0 };

function clampDelta(value: unknown): number {
    const num = Math.trunc(Number(value));
    if (!Number.isFinite(num)) return 0;
    return Math.max(-100000, Math.min(100000, num));
}

async function ensureWalletRow(userId: string, gameId: string): Promise<void> {
    await db
        .insert(gameCosmeticWallet)
        .values({ userId, gameId, fragments: 0, crates: 0 })
        .onConflictDoNothing();
}

export async function readCosmeticCrateState(userId: string, gameId: string): Promise<CosmeticCrateState> {
    const [owned, wallet] = await Promise.all([
        db
            .select({ itemId: gameCosmetics.itemId })
            .from(gameCosmetics)
            .where(and(eq(gameCosmetics.userId, userId), eq(gameCosmetics.gameId, gameId))),
        db.query.gameCosmeticWallet.findFirst({
            where: and(eq(gameCosmeticWallet.userId, userId), eq(gameCosmeticWallet.gameId, gameId)),
        }),
    ]);

    return {
        owned: owned.map((row) => row.itemId).filter(isCosmeticId).sort(),
        fragments: Math.max(0, wallet?.fragments ?? 0),
        crates: Math.max(0, wallet?.crates ?? 0),
    };
}

export async function adjustCosmeticWallet(
    userId: string,
    gameId: string,
    rawFragments: number,
    rawCrates: number
): Promise<boolean> {
    const fragments = clampDelta(rawFragments);
    const crates = clampDelta(rawCrates);
    if (fragments === 0 && crates === 0) return false;

    await ensureWalletRow(userId, gameId);

    const updated = await db
        .update(gameCosmeticWallet)
        .set({
            fragments: sql`${gameCosmeticWallet.fragments} + ${fragments}`,
            crates: sql`${gameCosmeticWallet.crates} + ${crates}`,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(gameCosmeticWallet.userId, userId),
                eq(gameCosmeticWallet.gameId, gameId),
                sql`${gameCosmeticWallet.fragments} + ${fragments} >= 0`,
                sql`${gameCosmeticWallet.crates} + ${crates} >= 0`
            )
        )
        .returning({ id: gameCosmeticWallet.id });

    return updated.length > 0;
}

export async function combineCosmeticFragments(
    userId: string,
    gameId: string
): Promise<{ ok: true; state: CosmeticCrateState } | { ok: false; error: string }> {
    const spent = await adjustCosmeticWallet(userId, gameId, -COSMETIC_FRAGMENTS_PER_CRATE, 1);
    if (!spent) return { ok: false, error: "not_enough_fragments" };
    return { ok: true, state: await readCosmeticCrateState(userId, gameId) };
}

export function rollCosmeticSecure(exclude: Set<string>): CosmeticId | null {
    const pool = COSMETICS.filter((entry) => !exclude.has(entry.id));
    if (pool.length === 0) return null;

    const total = pool.reduce((sum, entry) => sum + entry.dropWeight, 0);
    let ticket = randomInt(0, total);

    for (const entry of pool) {
        ticket -= entry.dropWeight;
        if (ticket < 0) return entry.id;
    }

    return pool[0].id;
}

export async function openCosmeticCrate(
    userId: string,
    gameId: string
): Promise<
    | { ok: true; itemId: CosmeticId; rarity: string; state: CosmeticCrateState }
    | { ok: false; error: string }
> {
    const state = await readCosmeticCrateState(userId, gameId);
    if (state.crates <= 0) return { ok: false, error: "no_crate" };

    const itemId = rollCosmeticSecure(new Set(state.owned));
    if (!itemId) return { ok: false, error: "collection_complete" };

    const spent = await adjustCosmeticWallet(userId, gameId, 0, -1);
    if (!spent) return { ok: false, error: "no_crate" };

    const granted = await db
        .insert(gameCosmetics)
        .values({ userId, gameId, itemId, pricePaidAsh: 0 })
        .onConflictDoNothing()
        .returning({ id: gameCosmetics.id });

    if (granted.length === 0) {
        await adjustCosmeticWallet(userId, gameId, 0, 1);
        return { ok: false, error: "grant_failed" };
    }

    const rarity = cosmeticRarity(itemId);
    try {
        await db.insert(gameCrateOpenings).values({ userId, gameId, itemId, rarity, source: "cosmetic" });
    } catch (error) {
        console.error("[cosmeticCrates] crate opening log failed:", error);
    }

    return { ok: true, itemId, rarity, state: await readCosmeticCrateState(userId, gameId) };
}
