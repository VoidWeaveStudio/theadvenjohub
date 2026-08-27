// src/core/lib/adminLiveSync.ts
import { db } from "@/core/database";
import {
    users,
    gameInventories,
    gameCharacterProgression,
    gameStatistics,
} from "@/core/database/schema";
import { and, eq } from "drizzle-orm";
import { readProgress, writeProgress, readPlaceables } from "@/core/lib/adminProgress";
import {
    AdminGameCommand,
    LiveOp,
    isExpiredAdminGameCommand,
    queueAdminGameCommands,
    readAdminGameCommands,
    removeAdminGameCommands,
} from "@/core/lib/adminGameCommands";

export const LIVE_DELIVERY_GRACE_MS = 20_000;

export type DeliveryMode = "live" | "db";

export async function isUserOnline(userId: string): Promise<boolean> {
    const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
    return !!row?.isOnline;
}

async function applyOpToDatabase(userId: string, op: LiveOp): Promise<void> {
    switch (op.kind) {
        case "ashDelta":
        case "ashSet":
        case "placeableDelta":
        case "placeablesSet":
        case "placeablesEnsure":
        case "storageClear":
        case "skinReset": {
            const bundle = await readProgress(userId);
            if (!bundle) return;

            if (op.kind === "ashDelta") {
                const current = Math.max(0, Math.floor(Number(bundle.data.ash) || 0));
                bundle.data.ash = Math.max(0, current + op.delta);
            } else if (op.kind === "ashSet") {
                bundle.data.ash = Math.max(0, op.value);
            } else if (op.kind === "placeableDelta") {
                const placeables = readPlaceables(bundle);
                const current = Math.max(0, Math.floor(Number(placeables[op.itemId]) || 0));
                const next = Math.max(0, current + op.delta);
                if (next > 0) placeables[op.itemId] = next;
                else delete placeables[op.itemId];
                bundle.data.placeables = placeables;
            } else if (op.kind === "placeablesSet") {
                bundle.data.placeables = op.placeables;
            } else if (op.kind === "placeablesEnsure") {
                const placeables = readPlaceables(bundle);
                for (const [itemId, minimum] of Object.entries(op.minimums)) {
                    const current = Math.max(0, Math.floor(Number(placeables[itemId]) || 0));
                    placeables[itemId] = Math.max(current, minimum);
                }
                bundle.data.placeables = placeables;
            } else if (op.kind === "storageClear") {
                bundle.data.storage = {};
                bundle.data.storageOrphan = [];
            } else {
                bundle.data.skinTextureUrl = null;
            }

            await writeProgress(bundle);
            return;
        }

        case "inventoryClear":
            await db.delete(gameInventories).where(eq(gameInventories.userId, userId));
            return;

        case "inventoryRemoveSlot":
            await db
                .delete(gameInventories)
                .where(and(eq(gameInventories.userId, userId), eq(gameInventories.slot, op.slot)));
            return;

        case "progressionSet": {
            const existing = await db.query.gameCharacterProgression.findFirst({
                where: eq(gameCharacterProgression.userId, userId),
            });
            if (existing) {
                await db
                    .update(gameCharacterProgression)
                    .set({ level: op.level, totalXp: op.totalXp, updatedAt: new Date() })
                    .where(eq(gameCharacterProgression.id, existing.id));
                return;
            }

            const bundle = await readProgress(userId);
            if (!bundle) return;
            await db.insert(gameCharacterProgression).values({
                userId,
                gameId: bundle.gameId,
                level: op.level,
                totalXp: op.totalXp,
            });
            return;
        }

        case "progressionReset":
            await db
                .update(gameCharacterProgression)
                .set({ level: 1, totalXp: 0, branch: null, skills: "{}", loadout: "{}", respecCount: 0, updatedAt: new Date() })
                .where(eq(gameCharacterProgression.userId, userId));
            return;

        case "statisticsReset":
            await db
                .update(gameStatistics)
                .set({ kills: 0, deaths: 0, shotsFired: 0, buildingsPlaced: 0, playtimeSeconds: 0, updatedAt: new Date() })
                .where(eq(gameStatistics.userId, userId));
            return;
    }
}

async function flushCommands(commands: AdminGameCommand[]): Promise<string[]> {
    const done: string[] = [];

    for (const command of commands) {
        try {
            if (!isExpiredAdminGameCommand(command)) {
                await applyOpToDatabase(command.userId, command.op);
            }
            done.push(command.id);
        } catch (error) {
            console.error("[adminLiveSync] flush failed for", command.id, error);
        }
    }

    await removeAdminGameCommands(done);
    return done;
}

/**
 * Writes the queued changes straight to the database for players no live session
 * is going to pick them up for. Everything the game server still owns is left
 * alone so the two writers never fight over the same value.
 */
export async function flushPendingForUser(userId: string): Promise<number> {
    const now = Date.now();
    const pending = (await readAdminGameCommands()).filter((command) => {
        if (command.userId !== userId) return false;

        // A command already handed to the game server is in flight; its ack or
        // its rejection decides what happens to it, so writing it here too would
        // apply the same delta twice.
        return command.deliveredAt === null || now - command.deliveredAt > LIVE_DELIVERY_GRACE_MS;
    });

    if (pending.length === 0) return 0;

    const applied = await flushCommands(pending);
    return applied.length;
}

export async function flushCommandsByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;

    const pending = (await readAdminGameCommands()).filter((command) => ids.includes(command.id));
    if (pending.length === 0) return 0;

    return (await flushCommands(pending)).length;
}

export async function flushStaleCommands(onlineUserIds: string[] | null): Promise<number> {
    const now = Date.now();
    const online = onlineUserIds ? new Set(onlineUserIds) : null;

    const stale = (await readAdminGameCommands()).filter((command) => {
        if (online?.has(command.userId)) return false;

        // Age is the signal either way: a session that was going to take this
        // would have acknowledged it seconds ago. Waiting also keeps a second
        // game server, whose roster this one does not know about, from having
        // its deliveries written out from under it.
        const age = now - Math.max(command.createdAt, command.deliveredAt ?? 0);
        return age > LIVE_DELIVERY_GRACE_MS;
    });

    if (stale.length === 0) return 0;
    return (await flushCommands(stale)).length;
}

/**
 * The single entry point every admin mutation of session-owned state goes
 * through. While the player is in a live session the game server owns the value
 * in memory and overwrites the row on its next save, so the change is handed to
 * it as a delta instead of being written here — writing both would either lose
 * the grant or roll the player back to the last autosave.
 */
export async function applyLiveOps(userId: string, ops: LiveOp[]): Promise<{ mode: DeliveryMode }> {
    if (ops.length === 0) return { mode: "db" };

    const queued = await queueAdminGameCommands(userId, ops);
    if (queued.length === 0) return { mode: "db" };

    if (await isUserOnline(userId)) {
        return { mode: "live" };
    }

    await flushPendingForUser(userId);
    return { mode: "db" };
}
