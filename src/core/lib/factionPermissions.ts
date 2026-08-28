// src/core/lib/factionPermissions.ts
export const FACTION_PERM_TREASURY = 1;
export const FACTION_PERM_TASKS = 2;
export const FACTION_PERM_WAR = 4;
export const FACTION_PERM_MODERATION = 8;

export const FACTION_PERM_ALL =
    FACTION_PERM_TREASURY | FACTION_PERM_TASKS | FACTION_PERM_WAR | FACTION_PERM_MODERATION;

export const FACTION_PERM_KEYS = ["treasury", "tasks", "war", "moderation"] as const;
export type FactionPermissionKey = (typeof FACTION_PERM_KEYS)[number];

export const FACTION_PERM_BITS: Record<FactionPermissionKey, number> = {
    treasury: FACTION_PERM_TREASURY,
    tasks: FACTION_PERM_TASKS,
    war: FACTION_PERM_WAR,
    moderation: FACTION_PERM_MODERATION,
};

export function sanitizePermissions(raw: unknown): number {
    const parsed = Math.trunc(Number(raw));
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed & FACTION_PERM_ALL;
}

export function factionHeadUserId(faction: {
    founderUserId: string;
    verifiedCreatorUserId: string | null;
}): string {
    return faction.verifiedCreatorUserId ?? faction.founderUserId;
}

export function isFactionHead(
    faction: { founderUserId: string; verifiedCreatorUserId: string | null },
    userId: string
): boolean {
    return factionHeadUserId(faction) === userId;
}

export function hasFactionPermission(
    faction: { founderUserId: string; verifiedCreatorUserId: string | null },
    userId: string,
    memberPermissions: number,
    bit: number
): boolean {
    if (isFactionHead(faction, userId)) return true;
    return (sanitizePermissions(memberPermissions) & bit) === bit;
}
