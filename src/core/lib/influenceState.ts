// src/core/lib/influenceState.ts
import { db } from "@/core/database";
import { appSettings } from "@/core/database/schema";
import { eq } from "drizzle-orm";

const INFLUENCE_STATE_KEY = "influence_state";

export const INFLUENCE_CRYSTAL_MAX_HEALTH = 40000;
export const INFLUENCE_ENTRY_FEE_MAX = 1000000;

export type InfluenceStatus = "closed" | "open" | "collapsing";
export type InfluencePhase = "sealed" | "claimable" | "owned" | "siege" | "collapse";
export type InfluenceFeeCurrency = "none" | "ash" | "tnj" | "faction";

export interface InfluenceBreach {
    x: number;
    y: number;
    z: number;
    spawnedAt: number;
}

export interface InfluenceCommand {
    id: string;
    type: "spawn_breach" | "close_breach" | "reset_point" | "force_siege";
}

export interface InfluenceState {
    status: InfluenceStatus;
    breach: InfluenceBreach;
    phase: InfluencePhase;
    ownerFactionId: string | null;
    ownerFactionName: string | null;
    ownerFactionSymbol: string | null;
    ownerFactionImage: string | null;
    feeCurrency: InfluenceFeeCurrency;
    feeAmount: number;
    feeTokenCa: string | null;
    feeWallet: string | null;
    bossDefeated: boolean;
    crystalHealth: number;
    nextSiegeAt: number;
    capturedAt: number;
    command: InfluenceCommand | null;
    lastCommandId: string | null;
    updatedAt: number;
}

export const DEFAULT_INFLUENCE_STATE: InfluenceState = {
    status: "closed",
    breach: { x: 0, y: 0, z: 0, spawnedAt: 0 },
    phase: "sealed",
    ownerFactionId: null,
    ownerFactionName: null,
    ownerFactionSymbol: null,
    ownerFactionImage: null,
    feeCurrency: "none",
    feeAmount: 0,
    feeTokenCa: null,
    feeWallet: null,
    bossDefeated: false,
    crystalHealth: INFLUENCE_CRYSTAL_MAX_HEALTH,
    nextSiegeAt: 0,
    capturedAt: 0,
    command: null,
    lastCommandId: null,
    updatedAt: 0,
};

const PHASES: InfluencePhase[] = ["sealed", "claimable", "owned", "siege", "collapse"];
const CURRENCIES: InfluenceFeeCurrency[] = ["none", "ash", "tnj", "faction"];
const COMMANDS: InfluenceCommand["type"][] = ["spawn_breach", "close_breach", "reset_point", "force_siege"];

function toFiniteNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableString(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeBreach(raw: unknown): InfluenceBreach {
    const source = (raw ?? {}) as Partial<InfluenceBreach>;
    return {
        x: toFiniteNumber(source.x, 0),
        y: toFiniteNumber(source.y, 0),
        z: toFiniteNumber(source.z, 0),
        spawnedAt: toFiniteNumber(source.spawnedAt, 0),
    };
}

function normalizeCommand(raw: unknown): InfluenceCommand | null {
    const source = raw as Partial<InfluenceCommand> | null | undefined;
    if (!source || typeof source.id !== "string") return null;
    if (!COMMANDS.includes(source.type as InfluenceCommand["type"])) return null;
    return { id: source.id, type: source.type as InfluenceCommand["type"] };
}

export function normalizeInfluenceState(raw: unknown): InfluenceState {
    const source = (raw ?? {}) as Partial<InfluenceState>;

    const status: InfluenceStatus =
        source.status === "open" || source.status === "collapsing" ? source.status : "closed";
    const phase: InfluencePhase = PHASES.includes(source.phase as InfluencePhase)
        ? (source.phase as InfluencePhase)
        : "sealed";
    const feeCurrency: InfluenceFeeCurrency = CURRENCIES.includes(source.feeCurrency as InfluenceFeeCurrency)
        ? (source.feeCurrency as InfluenceFeeCurrency)
        : "none";

    return {
        status,
        breach: normalizeBreach(source.breach),
        phase,
        ownerFactionId: nullableString(source.ownerFactionId),
        ownerFactionName: nullableString(source.ownerFactionName),
        ownerFactionSymbol: nullableString(source.ownerFactionSymbol),
        ownerFactionImage: nullableString(source.ownerFactionImage),
        feeCurrency,
        feeAmount: Math.max(0, Math.min(INFLUENCE_ENTRY_FEE_MAX, toFiniteNumber(source.feeAmount, 0))),
        feeTokenCa: nullableString(source.feeTokenCa),
        feeWallet: nullableString(source.feeWallet),
        bossDefeated: source.bossDefeated === true,
        crystalHealth: Math.max(0, Math.min(
            INFLUENCE_CRYSTAL_MAX_HEALTH,
            Math.round(toFiniteNumber(source.crystalHealth, INFLUENCE_CRYSTAL_MAX_HEALTH))
        )),
        nextSiegeAt: Math.max(0, Math.round(toFiniteNumber(source.nextSiegeAt, 0))),
        capturedAt: Math.max(0, Math.round(toFiniteNumber(source.capturedAt, 0))),
        command: normalizeCommand(source.command),
        lastCommandId: nullableString(source.lastCommandId),
        updatedAt: toFiniteNumber(source.updatedAt, 0),
    };
}

export async function getInfluenceState(): Promise<InfluenceState> {
    const rows = await db
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(eq(appSettings.key, INFLUENCE_STATE_KEY));

    const value = rows[0]?.value;
    if (!value) return { ...DEFAULT_INFLUENCE_STATE };

    try {
        return normalizeInfluenceState(JSON.parse(value));
    } catch {
        return { ...DEFAULT_INFLUENCE_STATE };
    }
}

export async function setInfluenceState(state: InfluenceState): Promise<InfluenceState> {
    const normalized = normalizeInfluenceState({ ...state, updatedAt: Date.now() });
    const serialized = JSON.stringify(normalized);

    await db
        .insert(appSettings)
        .values({ key: INFLUENCE_STATE_KEY, value: serialized, updatedAt: new Date() })
        .onConflictDoUpdate({
            target: appSettings.key,
            set: { value: serialized, updatedAt: new Date() },
        });

    return normalized;
}

export async function mergeInfluenceState(patch: Partial<InfluenceState>): Promise<InfluenceState> {
    const current = await getInfluenceState();
    return setInfluenceState({ ...current, ...patch });
}
