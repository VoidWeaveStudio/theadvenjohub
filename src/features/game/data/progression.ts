// src/features/game/data/progression.ts
import catalog from "./progression.catalog.json";

export type BranchId = "gunslinger" | "arcanist";

export interface BranchDefinition {
    id: BranchId;
    name: string;
    weapon: "rifle" | "staff";
    resourceName: string;
    accent: string;
    tagline: string;
}

export interface TierDefinition {
    index: number;
    id: string;
    name: string;
    emoji: string;
    minLevel: number;
    accent: string;
    memeAbility: string;
}

export interface MemeAbilityDefinition {
    id: string;
    name: string;
    description: string;
    emoji: string;
    cooldownMs: number;
    durationMs: number;
    params: Record<string, number | string | boolean>;
}

export interface WeaponTierDefinition {
    tier: number;
    minLevel: number;
    rifleName: string;
    staffName: string;
    accent: string;
}

export const MAX_LEVEL: number = catalog.maxLevel;
export const XP_CURVE = catalog.xpCurve;
export const ENERGY = catalog.energy;
export const RESPEC = catalog.respec;
export const XP_SOURCES = catalog.xpSources;
export const QUEST_XP: Record<string, number> = catalog.questXp;
export const PVP_SCALING = catalog.pvpScaling;
export const BRANCHES = catalog.branches as BranchDefinition[];
export const TIERS = catalog.tiers as TierDefinition[];
export const MEME_ABILITIES = catalog.memeAbilities as unknown as MemeAbilityDefinition[];
export const WEAPON_TIERS = catalog.weaponTiers as WeaponTierDefinition[];

export const BRANCHES_BY_ID = new Map(BRANCHES.map((b) => [b.id, b]));
export const MEME_ABILITIES_BY_ID = new Map(MEME_ABILITIES.map((m) => [m.id, m]));

const LEVEL_XP: number[] = buildLevelTable();

function buildLevelTable(): number[] {
    const table: number[] = [0, 0];
    for (let level = 1; level < MAX_LEVEL; level++) {
        table[level + 1] = table[level] + xpToNext(level);
    }
    return table;
}

export function xpToNext(level: number): number {
    if (level >= MAX_LEVEL) return 0;
    return Math.round(XP_CURVE.base * Math.pow(level, XP_CURVE.exponent));
}

export function totalXpForLevel(level: number): number {
    const clamped = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
    return LEVEL_XP[clamped];
}

export interface LevelState {
    level: number;
    xpIntoLevel: number;
    xpForLevel: number;
}

export function levelFromTotalXp(totalXp: number): LevelState {
    const xp = Math.max(0, Math.floor(totalXp));
    let level = 1;
    while (level < MAX_LEVEL && xp >= LEVEL_XP[level + 1]) level++;
    return {
        level,
        xpIntoLevel: xp - LEVEL_XP[level],
        xpForLevel: xpToNext(level),
    };
}

export function skillPointsForLevel(level: number): number {
    const clamped = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
    const perLevel = (clamped - 1) * catalog.skillPoints.perLevel;
    const bonus = catalog.skillPoints.bonusLevels.filter((l) => l <= clamped).length;
    return perLevel + bonus;
}

export function tierForLevel(level: number): TierDefinition {
    let current = TIERS[0];
    for (const tier of TIERS) {
        if (level >= tier.minLevel) current = tier;
    }
    return current;
}

export function weaponTierForLevel(level: number): WeaponTierDefinition {
    let current = WEAPON_TIERS[0];
    for (const tier of WEAPON_TIERS) {
        if (level >= tier.minLevel) current = tier;
    }
    return current;
}

export function memeAbilitiesForLevel(level: number): MemeAbilityDefinition[] {
    return TIERS.filter((t) => level >= t.minLevel)
        .map((t) => MEME_ABILITIES_BY_ID.get(t.memeAbility))
        .filter((m): m is MemeAbilityDefinition => !!m);
}

export function respecCostAsh(level: number, respecCount: number): number {
    if (level < RESPEC.freeBelowLevel) return 0;
    const raw = RESPEC.baseCostAsh * Math.pow(RESPEC.growth, Math.max(0, respecCount));
    return Math.min(RESPEC.maxCostAsh, Math.round(raw));
}

export function isBranchId(value: unknown): value is BranchId {
    return value === "gunslinger" || value === "arcanist";
}
