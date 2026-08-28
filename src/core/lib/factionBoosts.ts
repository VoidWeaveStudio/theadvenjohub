// src/core/lib/factionBoosts.ts
export const BOOST_DURATIONS = ["day", "week", "month"] as const;
export type BoostDuration = (typeof BOOST_DURATIONS)[number];

export const BOOST_DURATION_MS: Record<BoostDuration, number> = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
};

const DURATION_PRICE_MULT: Record<BoostDuration, number> = {
    day: 1,
    week: 5,
    month: 16,
};

export type BoostEffect = "maxHealth" | "moveSpeed" | "loot" | "xp";

export interface FactionBoost {
    id: string;
    effect: BoostEffect;
    magnitude: number;
    dayPrice: number;
    label: string;
    description: string;
}

export const FACTION_BOOSTS: FactionBoost[] = [
    { id: "vitality", effect: "maxHealth", magnitude: 0.12, dayPrice: 1200, label: "g.fb.vitality.label", description: "g.fb.vitality.description" },
    { id: "swiftness", effect: "moveSpeed", magnitude: 0.08, dayPrice: 1200, label: "g.fb.swiftness.label", description: "g.fb.swiftness.description" },
    { id: "scavenging", effect: "loot", magnitude: 0.2, dayPrice: 1800, label: "g.fb.scavenging.label", description: "g.fb.scavenging.description" },
    { id: "insight", effect: "xp", magnitude: 0.15, dayPrice: 1500, label: "g.fb.insight.label", description: "g.fb.insight.description" },
];

const BY_ID = new Map(FACTION_BOOSTS.map((boost) => [boost.id, boost]));

export function boostById(id: string): FactionBoost | null {
    return BY_ID.get(id) ?? null;
}

export function isBoostDuration(value: unknown): value is BoostDuration {
    return typeof value === "string" && (BOOST_DURATIONS as readonly string[]).includes(value);
}

export function boostPrice(boost: FactionBoost, duration: BoostDuration): number {
    return boost.dayPrice * DURATION_PRICE_MULT[duration];
}

export interface ActiveBoost {
    boostId: string;
    expiresAt: number;
}

export function boostCatalogPayload(): Array<{
    id: string;
    effect: BoostEffect;
    magnitude: number;
    label: string;
    description: string;
    prices: Record<BoostDuration, number>;
}> {
    return FACTION_BOOSTS.map((boost) => ({
        id: boost.id,
        effect: boost.effect,
        magnitude: boost.magnitude,
        label: boost.label,
        description: boost.description,
        prices: {
            day: boostPrice(boost, "day"),
            week: boostPrice(boost, "week"),
            month: boostPrice(boost, "month"),
        },
    }));
}
