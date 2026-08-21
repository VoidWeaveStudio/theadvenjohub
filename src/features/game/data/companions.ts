// src/features/game/data/companions.ts
export type CompanionRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type CompanionId =
    | "pet-dog"
    | "pet-shiba"
    | "pet-pepe"
    | "pet-bonk"
    | "pet-chad"
    | "pet-rocket"
    | "pet-diamond"
    | "pet-kraken";

export interface CompanionDefinition {
    id: CompanionId;
    rarity: CompanionRarity;
    nameKey: string;
    descriptionKey: string;
    dropWeight: number;
    accent: string;
    icon: string;
}

export interface RarityMeta {
    id: CompanionRarity;
    labelKey: string;
    color: string;
    glow: string;
    dustValue: number;
}

export const CRATE_ITEM_ID = "companion-crate";

export const FRAGMENTS_PER_CRATE = 100;

export const RARITY_ORDER: CompanionRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export const RARITY_META: Record<CompanionRarity, RarityMeta> = {
    common: { id: "common", labelKey: "g.rarity.common", color: "#9CA3AF", glow: "rgba(156,163,175,0.45)", dustValue: 5 },
    uncommon: { id: "uncommon", labelKey: "g.rarity.uncommon", color: "#4ADE80", glow: "rgba(74,222,128,0.45)", dustValue: 12 },
    rare: { id: "rare", labelKey: "g.rarity.rare", color: "#4FD1FF", glow: "rgba(79,209,255,0.5)", dustValue: 25 },
    epic: { id: "epic", labelKey: "g.rarity.epic", color: "#C084FC", glow: "rgba(192,132,252,0.55)", dustValue: 45 },
    legendary: { id: "legendary", labelKey: "g.rarity.legendary", color: "#FFD166", glow: "rgba(255,209,102,0.6)", dustValue: 100 },
};

export const COMPANIONS: CompanionDefinition[] = [
    { id: "pet-dog", rarity: "common", nameKey: "g.pet.pet-dog.name", descriptionKey: "g.pet.pet-dog.hint", dropWeight: 260, accent: "#8A6B4F", icon: "🐕" },
    { id: "pet-shiba", rarity: "common", nameKey: "g.pet.pet-shiba.name", descriptionKey: "g.pet.pet-shiba.hint", dropWeight: 240, accent: "#E0A458", icon: "🐶" },
    { id: "pet-pepe", rarity: "uncommon", nameKey: "g.pet.pet-pepe.name", descriptionKey: "g.pet.pet-pepe.hint", dropWeight: 140, accent: "#5BA83A", icon: "🐸" },
    { id: "pet-bonk", rarity: "uncommon", nameKey: "g.pet.pet-bonk.name", descriptionKey: "g.pet.pet-bonk.hint", dropWeight: 130, accent: "#F5A524", icon: "🏏" },
    { id: "pet-chad", rarity: "rare", nameKey: "g.pet.pet-chad.name", descriptionKey: "g.pet.pet-chad.hint", dropWeight: 80, accent: "#7DD3FC", icon: "🐂" },
    { id: "pet-rocket", rarity: "rare", nameKey: "g.pet.pet-rocket.name", descriptionKey: "g.pet.pet-rocket.hint", dropWeight: 70, accent: "#F87171", icon: "🚀" },
    { id: "pet-diamond", rarity: "epic", nameKey: "g.pet.pet-diamond.name", descriptionKey: "g.pet.pet-diamond.hint", dropWeight: 60, accent: "#C084FC", icon: "💎" },
    { id: "pet-kraken", rarity: "legendary", nameKey: "g.pet.pet-kraken.name", descriptionKey: "g.pet.pet-kraken.hint", dropWeight: 20, accent: "#FFD166", icon: "🐙" },
];

export const COMPANIONS_BY_ID = new Map(COMPANIONS.map((c) => [c.id, c]));

export const COMPANION_IDS: CompanionId[] = COMPANIONS.map((c) => c.id);

export const DEFAULT_COMPANION_ID: CompanionId = "pet-dog";

export const TOTAL_DROP_WEIGHT = COMPANIONS.reduce((sum, c) => sum + c.dropWeight, 0);

export function isCompanionId(value: unknown): value is CompanionId {
    return typeof value === "string" && (COMPANION_IDS as string[]).includes(value);
}

export function companionRarity(id: string): CompanionRarity {
    return COMPANIONS_BY_ID.get(id as CompanionId)?.rarity ?? "common";
}

export function dustValueOf(id: string): number {
    return RARITY_META[companionRarity(id)].dustValue;
}

export function dropChanceOf(id: string): number {
    const entry = COMPANIONS_BY_ID.get(id as CompanionId);
    if (!entry) return 0;
    return (entry.dropWeight / TOTAL_DROP_WEIGHT) * 100;
}

export function rarityRank(rarity: CompanionRarity): number {
    return RARITY_ORDER.indexOf(rarity);
}

export function sortByRarity(ids: string[]): string[] {
    return [...ids].sort((a, b) => {
        const diff = rarityRank(companionRarity(b)) - rarityRank(companionRarity(a));
        if (diff !== 0) return diff;
        return COMPANION_IDS.indexOf(a as CompanionId) - COMPANION_IDS.indexOf(b as CompanionId);
    });
}

export function rollCompanion(random: number): CompanionId {
    const clamped = Math.min(0.999999999, Math.max(0, random));
    let ticket = clamped * TOTAL_DROP_WEIGHT;
    for (const entry of COMPANIONS) {
        ticket -= entry.dropWeight;
        if (ticket < 0) return entry.id;
    }
    return COMPANIONS[0].id;
}
