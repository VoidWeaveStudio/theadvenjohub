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
        name: "Scream Mask",
        description: "The pale ghost face with the long screaming mouth.",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#E8E8EC",
    },
    {
        id: "trump_hair",
        slot: "accessory",
        name: "Trump Hair",
        description: "Swept-back blond hairstyle that never moves.",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#E3B23C",
    },
    {
        id: "scream_robe",
        slot: "skin",
        name: "Scream Costume",
        description: "Full black hooded robe with the ghost face.",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#2A2A32",
    },
    {
        id: "trump_suit",
        slot: "skin",
        name: "Trump Business Suit",
        description: "Navy suit, white shirt, long red tie, and the hair.",
        priceAsh: COSMETIC_PRICE_ASH,
        accent: "#1E3A6E",
    },
    {
        id: "pepe_frog",
        slot: "skin",
        name: "Pepe The Frog",
        description: "The green memecoin frog, head to toe.",
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
