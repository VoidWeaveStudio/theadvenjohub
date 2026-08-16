// src/core/lib/worldState.ts
import { db } from "@/core/database";
import { appSettings } from "@/core/database/schema";
import { eq } from "drizzle-orm";

const WORLD_STATE_KEY = "world_state";

export type WorldPortalStatus = "locked" | "active" | "cooldown";

export interface WorldPortalState {
    status: WorldPortalStatus;
    x: number;
    z: number;
    cooldownUntil: number;
    spawnedAt: number;
}

export interface WorldCommand {
    id: string;
    type: "force_portal" | "set_tier" | "clear_tier";
    tier: number | null;
}

export interface WorldState {
    mc: number;
    mcPeak: number;
    tier: number;
    adminTier: number | null;
    portal: WorldPortalState;
    command: WorldCommand | null;
    lastCommandId: string | null;
    updatedAt: number;
}

export const DEFAULT_WORLD_STATE: WorldState = {
    mc: 0,
    mcPeak: 0,
    tier: 0,
    adminTier: null,
    portal: { status: "locked", x: 0, z: 0, cooldownUntil: 0, spawnedAt: 0 },
    command: null,
    lastCommandId: null,
    updatedAt: 0,
};

function toFiniteNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePortal(raw: unknown): WorldPortalState {
    const source = (raw ?? {}) as Partial<WorldPortalState>;
    const status: WorldPortalStatus =
        source.status === "active" || source.status === "cooldown" ? source.status : "locked";

    return {
        status,
        x: toFiniteNumber(source.x, 0),
        z: toFiniteNumber(source.z, 0),
        cooldownUntil: toFiniteNumber(source.cooldownUntil, 0),
        spawnedAt: toFiniteNumber(source.spawnedAt, 0),
    };
}

function normalizeCommand(raw: unknown): WorldCommand | null {
    const source = raw as Partial<WorldCommand> | null | undefined;
    if (!source || typeof source.id !== "string") return null;
    if (source.type !== "force_portal" && source.type !== "set_tier" && source.type !== "clear_tier") return null;

    const tier = source.tier === null || source.tier === undefined ? null : Math.max(0, Math.floor(Number(source.tier) || 0));
    return { id: source.id, type: source.type, tier };
}

export function normalizeWorldState(raw: unknown): WorldState {
    const source = (raw ?? {}) as Partial<WorldState>;

    return {
        mc: Math.max(0, toFiniteNumber(source.mc, 0)),
        mcPeak: Math.max(0, toFiniteNumber(source.mcPeak, 0)),
        tier: Math.max(0, Math.floor(toFiniteNumber(source.tier, 0))),
        adminTier: source.adminTier === null || source.adminTier === undefined
            ? null
            : Math.max(0, Math.floor(toFiniteNumber(source.adminTier, 0))),
        portal: normalizePortal(source.portal),
        command: normalizeCommand(source.command),
        lastCommandId: typeof source.lastCommandId === "string" ? source.lastCommandId : null,
        updatedAt: toFiniteNumber(source.updatedAt, 0),
    };
}

export async function getWorldState(): Promise<WorldState> {
    const rows = await db
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(eq(appSettings.key, WORLD_STATE_KEY));

    const value = rows[0]?.value;
    if (!value) return { ...DEFAULT_WORLD_STATE };

    try {
        return normalizeWorldState(JSON.parse(value));
    } catch {
        return { ...DEFAULT_WORLD_STATE };
    }
}

export async function setWorldState(state: WorldState): Promise<WorldState> {
    const normalized = normalizeWorldState({ ...state, updatedAt: Date.now() });
    const serialized = JSON.stringify(normalized);

    await db
        .insert(appSettings)
        .values({ key: WORLD_STATE_KEY, value: serialized, updatedAt: new Date() })
        .onConflictDoUpdate({
            target: appSettings.key,
            set: { value: serialized, updatedAt: new Date() },
        });

    return normalized;
}

export async function mergeWorldState(patch: Partial<WorldState>): Promise<WorldState> {
    const current = await getWorldState();
    return setWorldState({ ...current, ...patch });
}
