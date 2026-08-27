// src/core/lib/adminGameCommands.ts
import { randomUUID } from "crypto";
import { db } from "@/core/database";
import { appSettings } from "@/core/database/schema";
import { eq, sql } from "drizzle-orm";

const COMMANDS_KEY = "admin_game_commands";
const MAX_COMMANDS = 500;
const COMMAND_TTL_MS = 6 * 60 * 60 * 1000;

export const ADMIN_COMMAND_PROTOCOL = 2;

export type LiveOp =
    | { kind: "ashDelta"; delta: number }
    | { kind: "ashSet"; value: number }
    | { kind: "placeableDelta"; itemId: string; delta: number }
    | { kind: "placeablesSet"; placeables: Record<string, number> }
    | { kind: "placeablesEnsure"; minimums: Record<string, number> }
    | { kind: "storageClear" }
    | { kind: "inventoryClear" }
    | { kind: "inventoryRemoveSlot"; slot: number }
    | { kind: "progressionSet"; level: number; totalXp: number }
    | { kind: "progressionReset" }
    | { kind: "statisticsReset" }
    | { kind: "skinReset" };

export interface AdminGameCommand {
    id: string;
    userId: string;
    createdAt: number;
    deliveredAt: number | null;
    op: LiveOp;
}

function normalizeOp(raw: unknown): LiveOp | null {
    if (!raw || typeof raw !== "object") return null;
    const source = raw as Record<string, unknown>;
    const kind = source.kind;

    const int = (value: unknown) => {
        const parsed = Math.trunc(Number(value));
        return Number.isFinite(parsed) ? parsed : null;
    };

    switch (kind) {
        case "ashDelta": {
            const delta = int(source.delta);
            return delta === null || delta === 0 ? null : { kind, delta };
        }
        case "ashSet": {
            const value = int(source.value);
            return value === null ? null : { kind, value: Math.max(0, value) };
        }
        case "placeableDelta": {
            const delta = int(source.delta);
            const itemId = typeof source.itemId === "string" ? source.itemId : "";
            return !itemId || delta === null || delta === 0 ? null : { kind, itemId, delta };
        }
        case "placeablesSet": {
            const placeables = source.placeables;
            if (!placeables || typeof placeables !== "object") return null;
            const clean: Record<string, number> = {};
            for (const [key, value] of Object.entries(placeables as Record<string, unknown>)) {
                const amount = int(value);
                if (amount !== null && amount > 0) clean[key] = amount;
            }
            return { kind, placeables: clean };
        }
        case "placeablesEnsure": {
            const minimums = source.minimums;
            if (!minimums || typeof minimums !== "object") return null;
            const clean: Record<string, number> = {};
            for (const [key, value] of Object.entries(minimums as Record<string, unknown>)) {
                const amount = int(value);
                if (amount !== null && amount > 0) clean[key] = amount;
            }
            return Object.keys(clean).length === 0 ? null : { kind, minimums: clean };
        }
        case "storageClear":
        case "inventoryClear":
        case "progressionReset":
        case "statisticsReset":
        case "skinReset":
            return { kind };
        case "inventoryRemoveSlot": {
            const slot = int(source.slot);
            return slot === null || slot < 0 ? null : { kind, slot };
        }
        case "progressionSet": {
            const level = int(source.level);
            const totalXp = int(source.totalXp);
            return level === null || totalXp === null ? null : { kind, level, totalXp };
        }
        default:
            return null;
    }
}

function normalize(raw: unknown): AdminGameCommand | null {
    if (!raw || typeof raw !== "object") return null;

    const source = raw as Record<string, unknown>;
    if (typeof source.id !== "string" || typeof source.userId !== "string") return null;

    const op = normalizeOp(source.op);
    if (!op) return null;

    const deliveredAt = Number(source.deliveredAt);

    return {
        id: source.id,
        userId: source.userId,
        createdAt: Number(source.createdAt) || 0,
        deliveredAt: Number.isFinite(deliveredAt) && deliveredAt > 0 ? deliveredAt : null,
        op,
    };
}

export async function readAdminGameCommands(): Promise<AdminGameCommand[]> {
    const rows = await db
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(eq(appSettings.key, COMMANDS_KEY));

    const value = rows[0]?.value;
    if (!value) return [];

    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(normalize).filter((c): c is AdminGameCommand => c !== null);
    } catch {
        return [];
    }
}

async function writeAdminGameCommands(commands: AdminGameCommand[]) {
    const serialized = JSON.stringify(commands.slice(-MAX_COMMANDS));

    await db
        .insert(appSettings)
        .values({ key: COMMANDS_KEY, value: serialized, updatedAt: new Date() })
        .onConflictDoUpdate({
            target: appSettings.key,
            set: { value: serialized, updatedAt: new Date() },
        });
}

/**
 * Appends in a single statement so two admin actions racing each other cannot
 * lose one another's commands the way a read-modify-write would.
 */
export async function queueAdminGameCommands(userId: string, ops: LiveOp[]): Promise<AdminGameCommand[]> {
    const queued: AdminGameCommand[] = [];
    const now = Date.now();

    for (const raw of ops) {
        const op = normalizeOp(raw);
        if (!op) continue;
        queued.push({ id: randomUUID(), userId, createdAt: now, deliveredAt: null, op });
    }

    if (queued.length === 0) return [];

    const payload = JSON.stringify(queued);

    try {
        await appendAtomically(payload);
    } catch (error) {
        console.error("[adminGameCommands] atomic append failed, rewriting queue:", error);
        await writeAdminGameCommands([...(await readAdminGameCommands()), ...queued]);
    }

    return queued;
}

async function appendAtomically(payload: string): Promise<void> {
    await db.execute(sql`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES (${COMMANDS_KEY}, ${payload}, now())
        ON CONFLICT (key) DO UPDATE SET
            value = (
                CASE
                    WHEN jsonb_typeof(COALESCE(NULLIF(app_settings.value, '')::jsonb, '[]'::jsonb)) = 'array'
                        THEN COALESCE(NULLIF(app_settings.value, '')::jsonb, '[]'::jsonb)
                    ELSE '[]'::jsonb
                END || ${payload}::jsonb
            )::text,
            updated_at = now()
    `);
}

export async function removeAdminGameCommands(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const remaining = (await readAdminGameCommands()).filter((command) => !ids.includes(command.id));
    await writeAdminGameCommands(remaining);
}

export async function markAdminGameCommandsDelivered(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const now = Date.now();
    const commands = (await readAdminGameCommands()).map((command) =>
        ids.includes(command.id) ? { ...command, deliveredAt: now } : command
    );
    await writeAdminGameCommands(commands);
}

export async function clearAdminGameCommandDelivery(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const commands = (await readAdminGameCommands()).map((command) =>
        ids.includes(command.id) ? { ...command, deliveredAt: null } : command
    );
    await writeAdminGameCommands(commands);
}

export function isExpiredAdminGameCommand(command: AdminGameCommand, now = Date.now()): boolean {
    return now - command.createdAt > COMMAND_TTL_MS;
}
