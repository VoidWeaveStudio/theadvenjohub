// src/core/lib/companionInventory.ts
import { randomInt } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/core/database";
import {
    gameCompanions,
    gameCompanionLoadouts,
    gameMemeWallet,
    gameCrateOpenings,
} from "@/core/database/schema";
import {
    COMPANIONS,
    DEFAULT_COMPANION_ID,
    FRAGMENTS_PER_CRATE,
    TOTAL_DROP_WEIGHT,
    companionRarity,
    dustValueOf,
    isCompanionId,
    type CompanionId,
} from "@/features/game/data/companions";

export interface CompanionStack {
    itemId: string;
    quantity: number;
}

export interface CompanionState {
    owned: CompanionStack[];
    equipped: string | null;
    fragments: number;
    crates: number;
}

export const EMPTY_COMPANION_STATE: CompanionState = { owned: [], equipped: null, fragments: 0, crates: 0 };

function clampDelta(value: unknown): number {
    const num = Math.trunc(Number(value));
    if (!Number.isFinite(num)) return 0;
    return Math.max(-100000, Math.min(100000, num));
}

export async function seedLegacyDog(userId: string, gameId: string, legacyCount: number): Promise<void> {
    if (!(legacyCount > 0)) return;
    await db
        .insert(gameCompanions)
        .values({ userId, gameId, itemId: DEFAULT_COMPANION_ID, quantity: 1 })
        .onConflictDoNothing();
    await autoEquipIfUnset(userId, gameId, DEFAULT_COMPANION_ID);
}

async function autoEquipIfUnset(userId: string, gameId: string, companionId: CompanionId): Promise<void> {
    await db
        .insert(gameCompanionLoadouts)
        .values({ userId, gameId, companionId })
        .onConflictDoNothing();
}

async function ensureWalletRow(userId: string, gameId: string): Promise<void> {
    await db
        .insert(gameMemeWallet)
        .values({ userId, gameId, fragments: 0, crates: 0 })
        .onConflictDoNothing();
}

export async function readCompanionState(userId: string, gameId: string): Promise<CompanionState> {
    const [stacks, loadout, wallet] = await Promise.all([
        db
            .select({ itemId: gameCompanions.itemId, quantity: gameCompanions.quantity })
            .from(gameCompanions)
            .where(and(eq(gameCompanions.userId, userId), eq(gameCompanions.gameId, gameId))),
        db.query.gameCompanionLoadouts.findFirst({
            where: and(eq(gameCompanionLoadouts.userId, userId), eq(gameCompanionLoadouts.gameId, gameId)),
        }),
        db.query.gameMemeWallet.findFirst({
            where: and(eq(gameMemeWallet.userId, userId), eq(gameMemeWallet.gameId, gameId)),
        }),
    ]);

    const owned = stacks
        .filter((row) => isCompanionId(row.itemId) && row.quantity > 0)
        .map((row) => ({ itemId: row.itemId, quantity: row.quantity }))
        .sort((a, b) => a.itemId.localeCompare(b.itemId));

    const ownedIds = new Set(owned.map((row) => row.itemId));
    const requested = loadout?.companionId ?? null;
    const equipped = requested && ownedIds.has(requested) ? requested : null;

    return {
        owned,
        equipped,
        fragments: Math.max(0, wallet?.fragments ?? 0),
        crates: Math.max(0, wallet?.crates ?? 0),
    };
}

export async function adjustCompanion(
    userId: string,
    gameId: string,
    itemId: string,
    rawDelta: number
): Promise<boolean> {
    const delta = clampDelta(rawDelta);
    if (delta === 0 || !isCompanionId(itemId)) return false;

    if (delta > 0) {
        await db
            .insert(gameCompanions)
            .values({ userId, gameId, itemId, quantity: delta })
            .onConflictDoUpdate({
                target: [gameCompanions.userId, gameCompanions.gameId, gameCompanions.itemId],
                set: {
                    quantity: sql`${gameCompanions.quantity} + ${delta}`,
                    updatedAt: new Date(),
                },
            });
        await autoEquipIfUnset(userId, gameId, itemId);
        return true;
    }

    const needed = -delta;
    const updated = await db
        .update(gameCompanions)
        .set({ quantity: sql`${gameCompanions.quantity} - ${needed}`, updatedAt: new Date() })
        .where(
            and(
                eq(gameCompanions.userId, userId),
                eq(gameCompanions.gameId, gameId),
                eq(gameCompanions.itemId, itemId),
                sql`${gameCompanions.quantity} >= ${needed}`
            )
        )
        .returning({ quantity: gameCompanions.quantity });

    if (updated.length === 0) return false;

    if (updated[0].quantity <= 0) {
        await db
            .delete(gameCompanions)
            .where(
                and(
                    eq(gameCompanions.userId, userId),
                    eq(gameCompanions.gameId, gameId),
                    eq(gameCompanions.itemId, itemId),
                    sql`${gameCompanions.quantity} <= 0`
                )
            );
    }

    return true;
}

export async function adjustWallet(
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
        .update(gameMemeWallet)
        .set({
            fragments: sql`${gameMemeWallet.fragments} + ${fragments}`,
            crates: sql`${gameMemeWallet.crates} + ${crates}`,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(gameMemeWallet.userId, userId),
                eq(gameMemeWallet.gameId, gameId),
                sql`${gameMemeWallet.fragments} + ${fragments} >= 0`,
                sql`${gameMemeWallet.crates} + ${crates} >= 0`
            )
        )
        .returning({ id: gameMemeWallet.id });

    return updated.length > 0;
}

export async function equipCompanion(
    userId: string,
    gameId: string,
    companionId: string | null
): Promise<{ ok: true; equipped: string | null } | { ok: false; error: string }> {
    let wanted: CompanionId | null = null;

    if (companionId !== null) {
        if (!isCompanionId(companionId)) return { ok: false, error: "unknown_companion" };
        const stack = await db.query.gameCompanions.findFirst({
            where: and(
                eq(gameCompanions.userId, userId),
                eq(gameCompanions.gameId, gameId),
                eq(gameCompanions.itemId, companionId)
            ),
        });
        if (!stack || stack.quantity <= 0) return { ok: false, error: "not_owned" };
        wanted = companionId;
    }

    await db
        .insert(gameCompanionLoadouts)
        .values({ userId, gameId, companionId: wanted })
        .onConflictDoUpdate({
            target: [gameCompanionLoadouts.userId, gameCompanionLoadouts.gameId],
            set: { companionId: wanted, updatedAt: new Date() },
        });

    return { ok: true, equipped: wanted };
}

export async function dustCompanion(
    userId: string,
    gameId: string,
    itemId: string
): Promise<{ ok: true; fragments: number; state: CompanionState } | { ok: false; error: string }> {
    if (!isCompanionId(itemId)) return { ok: false, error: "unknown_companion" };

    const stack = await db.query.gameCompanions.findFirst({
        where: and(
            eq(gameCompanions.userId, userId),
            eq(gameCompanions.gameId, gameId),
            eq(gameCompanions.itemId, itemId)
        ),
    });
    if (!stack || stack.quantity < 2) return { ok: false, error: "no_duplicate" };

    const removed = await adjustCompanion(userId, gameId, itemId, -1);
    if (!removed) return { ok: false, error: "no_duplicate" };

    const reward = dustValueOf(itemId);
    const credited = await adjustWallet(userId, gameId, reward, 0);
    if (!credited) {
        await adjustCompanion(userId, gameId, itemId, 1);
        return { ok: false, error: "dust_failed" };
    }

    return { ok: true, fragments: reward, state: await readCompanionState(userId, gameId) };
}

export async function combineFragments(
    userId: string,
    gameId: string
): Promise<{ ok: true; state: CompanionState } | { ok: false; error: string }> {
    const spent = await adjustWallet(userId, gameId, -FRAGMENTS_PER_CRATE, 1);
    if (!spent) return { ok: false, error: "not_enough_fragments" };
    return { ok: true, state: await readCompanionState(userId, gameId) };
}

export function rollCompanionSecure(): CompanionId {
    let ticket = randomInt(0, TOTAL_DROP_WEIGHT);
    for (const entry of COMPANIONS) {
        ticket -= entry.dropWeight;
        if (ticket < 0) return entry.id;
    }
    return COMPANIONS[0].id;
}

export async function openCrate(
    userId: string,
    gameId: string
): Promise<{ ok: true; itemId: CompanionId; rarity: string; state: CompanionState } | { ok: false; error: string }> {
    const spent = await adjustWallet(userId, gameId, 0, -1);
    if (!spent) return { ok: false, error: "no_crate" };

    const itemId = rollCompanionSecure();
    const granted = await adjustCompanion(userId, gameId, itemId, 1);
    if (!granted) {
        await adjustWallet(userId, gameId, 0, 1);
        return { ok: false, error: "grant_failed" };
    }

    const rarity = companionRarity(itemId);
    try {
        await db.insert(gameCrateOpenings).values({ userId, gameId, itemId, rarity, source: "crate" });
    } catch (error) {
        console.error("[companionInventory] crate opening log failed:", error);
    }

    return { ok: true, itemId, rarity, state: await readCompanionState(userId, gameId) };
}
