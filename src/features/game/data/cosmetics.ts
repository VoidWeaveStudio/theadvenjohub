// src/features/game/data/cosmetics.ts
export type CosmeticSlot = "skin" | "accessory";

export type CosmeticId =
    | "trump_hair"
    | "trump_suit"
    | "pepe_frog"
    | "doge_shiba"
    | "wojak_hoodie"
    | "gigachad_marble"
    | "moon_astronaut"
    | "bull_market"
    | "bear_market"
    | "laser_eyes"
    | "deal_shades";

export interface CosmeticDefinition {
    id: CosmeticId;
    rarity: CosmeticRarity;
    dropWeight: number;
    slot: CosmeticSlot;
    name: string;
    description: string;
    priceAsh: number;
    accent: string;
}

export type CosmeticRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const COSMETIC_PRICE_ASH = 1;

export const COSMETIC_FRAGMENTS_PER_CRATE = 100;

export const COSMETIC_CRATE_ITEM_ID = "cosmetic-crate";

export const COSMETICS: CosmeticDefinition[] = [
    {
        id: "trump_hair",
        rarity: "uncommon",
        dropWeight: 150,
        slot: "accessory",
        name: "g.cosmetic.trump_hair.name",
        description: "g.cosmetic.trump_hair.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#E3B23C",
    },
    {
        id: "trump_suit",
        rarity: "rare",
        dropWeight: 90,
        slot: "skin",
        name: "g.cosmetic.trump_suit.name",
        description: "g.cosmetic.trump_suit.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#1E3A6E",
    },
    {
        id: "pepe_frog",
        rarity: "uncommon",
        dropWeight: 150,
        slot: "skin",
        name: "g.cosmetic.pepe_frog.name",
        description: "g.cosmetic.pepe_frog.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#5BA83A",
    },
    {
        id: "doge_shiba",
        rarity: "uncommon",
        dropWeight: 150,
        slot: "skin",
        name: "g.cosmetic.doge_shiba.name",
        description: "g.cosmetic.doge_shiba.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#D8A441",
    },
    {
        id: "wojak_hoodie",
        rarity: "common",
        dropWeight: 260,
        slot: "skin",
        name: "g.cosmetic.wojak_hoodie.name",
        description: "g.cosmetic.wojak_hoodie.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#8B9099",
    },
    {
        id: "gigachad_marble",
        rarity: "legendary",
        dropWeight: 12,
        slot: "skin",
        name: "g.cosmetic.gigachad_marble.name",
        description: "g.cosmetic.gigachad_marble.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#DEDAD2",
    },
    {
        id: "moon_astronaut",
        rarity: "rare",
        dropWeight: 90,
        slot: "skin",
        name: "g.cosmetic.moon_astronaut.name",
        description: "g.cosmetic.moon_astronaut.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#F0A24A",
    },
    {
        id: "bull_market",
        rarity: "rare",
        dropWeight: 90,
        slot: "skin",
        name: "g.cosmetic.bull_market.name",
        description: "g.cosmetic.bull_market.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#35D07F",
    },
    {
        id: "bear_market",
        rarity: "rare",
        dropWeight: 90,
        slot: "skin",
        name: "g.cosmetic.bear_market.name",
        description: "g.cosmetic.bear_market.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#E2554B",
    },
    {
        id: "laser_eyes",
        rarity: "epic",
        dropWeight: 40,
        slot: "accessory",
        name: "g.cosmetic.laser_eyes.name",
        description: "g.cosmetic.laser_eyes.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#FF4A24",
    },
    {
        id: "deal_shades",
        rarity: "common",
        dropWeight: 260,
        slot: "accessory",
        name: "g.cosmetic.deal_shades.name",
        description: "g.cosmetic.deal_shades.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#9AA3B2",
    },
];

export const COSMETICS_BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export const COSMETIC_IDS: CosmeticId[] = COSMETICS.map((c) => c.id);

export function isCosmeticId(value: unknown): value is CosmeticId {
    return typeof value === "string" && (COSMETIC_IDS as string[]).includes(value);
}

export const COSMETIC_TOTAL_DROP_WEIGHT = COSMETICS.reduce((sum, c) => sum + c.dropWeight, 0);

export function cosmeticRarity(id: string): CosmeticRarity {
    return COSMETICS_BY_ID.get(id as CosmeticId)?.rarity ?? "common";
}

export function cosmeticSlotOf(id: string): CosmeticSlot | null {
    return COSMETICS_BY_ID.get(id as CosmeticId)?.slot ?? null;
}

export interface CosmeticLoadout {
    skinId: CosmeticId | null;
    accessoryId: CosmeticId | null;
}

export function normalizeLoadout(skinId: unknown, accessoryId: unknown): CosmeticLoadout {
    const skin = isCosmeticId(skinId) && cosmeticSlotOf(skinId) === "skin" ? skinId : null;
    const accessory = isCosmeticId(accessoryId) && cosmeticSlotOf(accessoryId) === "accessory" ? accessoryId : null;
    return { skinId: skin, accessoryId: skin ? null : accessory };
}
