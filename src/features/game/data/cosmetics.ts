// src/features/game/data/cosmetics.ts
export type CosmeticSlot = "skin" | "accessory";

export type CosmeticId =
    | "scream_mask"
    | "scream_robe"
    | "trump_hair"
    | "trump_suit"
    | "pepe_frog";

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
