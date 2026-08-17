// src/core/lib/adminGameCommands.ts
import { randomUUID } from "crypto";
import { db } from "@/core/database";
import { appSettings } from "@/core/database/schema";
import { eq } from "drizzle-orm";

const COMMANDS_KEY = "admin_game_commands";
const MAX_COMMANDS = 200;
const COMMAND_TTL_MS = 30 * 60 * 1000;

interface AdminCommandBase {
    id: string;
    userId: string;
    createdAt: number;
}

export interface AdminSetLevelCommand extends AdminCommandBase {
    type: "setLevel";
    level: number;
    totalXp: number;
}

export interface AdminRemoveInventorySlotCommand extends AdminCommandBase {
    type: "removeInventorySlot";
    slot: number;
}

export type AdminGameCommand = AdminSetLevelCommand | AdminRemoveInventorySlotCommand;

function commandKey(command: AdminGameCommand): string {
    return command.type === "setLevel"
        ? `setLevel:${command.userId}`
        : `removeInventorySlot:${command.userId}:${command.slot}`;
}

function normalize(raw: unknown): AdminGameCommand | null {
    if (!raw || typeof raw !== "object") return null;

    const source = raw as Record<string, unknown>;
    if (typeof source.id !== "string" || typeof source.userId !== "string") return null;

    const base: AdminCommandBase = {
        id: source.id,
        userId: source.userId,
        createdAt: Number(source.createdAt) || 0,
    };

    if (source.type === "setLevel") {
        const level = Math.floor(Number(source.level));
        const totalXp = Math.floor(Number(source.totalXp));
        if (!Number.isFinite(level) || !Number.isFinite(totalXp)) return null;

        return { ...base, type: "setLevel", level, totalXp };
    }

    if (source.type === "removeInventorySlot") {
        const slot = Math.floor(Number(source.slot));
        if (!Number.isInteger(slot) || slot < 0) return null;

        return { ...base, type: "removeInventorySlot", slot };
    }

    return null;
}

async function readCommands(): Promise<AdminGameCommand[]> {
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

async function writeCommands(commands: AdminGameCommand[]) {
    const serialized = JSON.stringify(commands);

    await db
        .insert(appSettings)
        .values({ key: COMMANDS_KEY, value: serialized, updatedAt: new Date() })
        .onConflictDoUpdate({
            target: appSettings.key,
            set: { value: serialized, updatedAt: new Date() },
        });
}

type QueuedCommand =
    | Omit<AdminSetLevelCommand, "id" | "createdAt">
    | Omit<AdminRemoveInventorySlotCommand, "id" | "createdAt">;

export async function queueAdminGameCommand(command: QueuedCommand) {
    const now = Date.now();
    const pending = (await readCommands()).filter((c) => now - c.createdAt < COMMAND_TTL_MS);

    const queued = { ...command, id: randomUUID(), createdAt: now } as AdminGameCommand;
    const key = commandKey(queued);

    await writeCommands([...pending.filter((c) => commandKey(c) !== key), queued].slice(-MAX_COMMANDS));
}

export async function drainAdminGameCommands(): Promise<AdminGameCommand[]> {
    const now = Date.now();
    const commands = (await readCommands()).filter((c) => now - c.createdAt < COMMAND_TTL_MS);
    if (commands.length > 0) await writeCommands([]);

    return commands;
}
