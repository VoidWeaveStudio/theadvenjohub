// src/features/game/data/cosmetics.ts
export type CosmeticSlot = "skin" | "accessory";

export type CosmeticId =
    | "scream_mask"
    | "scream_robe"
    | "trump_hair"
    | "trump_suit"
    | "pepe_frog"
    | "doge_shiba"
    | "wojak_hoodie"
    | "gigachad_marble"
    | "moon_astronaut"
    | "bull_market"
    | "bear_market"
    | "wif_hat"
    | "laser_eyes"
    | "deal_shades";

export interface CosmeticDefinition {
    id: CosmeticId;
    slot: CosmeticSlot;
    name: string;
    description: string;
    priceAsh: number;
    accent: string;
}

export const COSMETIC_PRICE_ASH = 1;

export const COSMETICS: CosmeticDefinition[] = [
    {
        id: "scream_mask",
        slot: "accessory",
        name: "g.cosmetic.scream_mask.name",
        description: "g.cosmetic.scream_mask.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#E8E8EC",
    },
    {
        id: "trump_hair",
        slot: "accessory",
        name: "g.cosmetic.trump_hair.name",
        description: "g.cosmetic.trump_hair.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#E3B23C",
    },
    {
        id: "scream_robe",
        slot: "skin",
        name: "g.cosmetic.scream_robe.name",
        description: "g.cosmetic.scream_robe.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#2A2A32",
    },
    {
        id: "trump_suit",
        slot: "skin",
        name: "g.cosmetic.trump_suit.name",
        description: "g.cosmetic.trump_suit.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#1E3A6E",
    },
    {
        id: "pepe_frog",
        slot: "skin",
        name: "g.cosmetic.pepe_frog.name",
        description: "g.cosmetic.pepe_frog.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#5BA83A",
    },
    {
        id: "doge_shiba",
        slot: "skin",
        name: "g.cosmetic.doge_shiba.name",
        description: "g.cosmetic.doge_shiba.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#D8A441",
    },
    {
        id: "wojak_hoodie",
        slot: "skin",
        name: "g.cosmetic.wojak_hoodie.name",
        description: "g.cosmetic.wojak_hoodie.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#8B9099",
    },
    {
        id: "gigachad_marble",
        slot: "skin",
        name: "g.cosmetic.gigachad_marble.name",
        description: "g.cosmetic.gigachad_marble.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#DEDAD2",
    },
    {
        id: "moon_astronaut",
        slot: "skin",
        name: "g.cosmetic.moon_astronaut.name",
        description: "g.cosmetic.moon_astronaut.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#F0A24A",
    },
    {
        id: "bull_market",
        slot: "skin",
        name: "g.cosmetic.bull_market.name",
        description: "g.cosmetic.bull_market.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#35D07F",
    },
    {
        id: "bear_market",
        slot: "skin",
        name: "g.cosmetic.bear_market.name",
        description: "g.cosmetic.bear_market.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#E2554B",
    },
    {
        id: "wif_hat",
        slot: "accessory",
        name: "g.cosmetic.wif_hat.name",
        description: "g.cosmetic.wif_hat.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#EFA3C6",
    },
    {
        id: "laser_eyes",
        slot: "accessory",
        name: "g.cosmetic.laser_eyes.name",
        description: "g.cosmetic.laser_eyes.description",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#FF4A24",
    },
    {
        id: "deal_shades",
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
