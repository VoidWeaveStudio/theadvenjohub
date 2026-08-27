// src/core/lib/adminScopes.ts

export const GRANT_SCOPES = [
    "license",
    "ash",
    "placeables",
    "companions",
    "cosmetics",
    "crates",
    "progression",
    "achievements",
] as const;

export const WIPE_SCOPES = [
    "license",
    "ash",
    "placeables",
    "inventory",
    "storage",
    "companions",
    "cosmetics",
    "crates",
    "progression",
    "achievements",
    "factions",
    "buildings",
    "statistics",
] as const;

export type GrantScope = (typeof GRANT_SCOPES)[number];
export type WipeScope = (typeof WIPE_SCOPES)[number];

export const SCOPE_LABELS: Record<GrantScope | WipeScope, string> = {
    license: "Game licence",
    ash: "Ash balance",
    placeables: "Placeables & consumables",
    inventory: "Token inventory",
    storage: "Storage crate",
    companions: "Companions",
    cosmetics: "Skins & accessories",
    crates: "Crates & fragments",
    progression: "Level & skills",
    achievements: "Achievements",
    factions: "Faction memberships",
    buildings: "Buildings & furniture",
    statistics: "Lifetime statistics",
};
