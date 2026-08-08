// src/core/lib/shopCatalog.ts
export type ShopCurrency = "ash" | "tnj" | "usd";

export type ShopItemKind = "placeable" | "cosmetic" | "faction";

export interface ShopCatalogEntry {
    itemId: string;
    name: string;
    kind: ShopItemKind;
    description: string;
    defaultCurrency: ShopCurrency;
    defaultPriceAsh: number;
    defaultPriceTnj: number;
    defaultPriceUsdCents: number;
    maxOwned: number | null;
}

export const SHOP_CATALOG: ShopCatalogEntry[] = [
    { itemId: "sign-on-a-stick", name: "Sign on a Stick", kind: "placeable", description: "Placed in the open world", defaultCurrency: "ash", defaultPriceAsh: 100, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 10 },
    { itemId: "sphere", name: "Sphere", kind: "placeable", description: "Tradeable trinket", defaultCurrency: "ash", defaultPriceAsh: 100, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 50 },
    { itemId: "chair", name: "Chair", kind: "placeable", description: "Faction room furniture", defaultCurrency: "ash", defaultPriceAsh: 0, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 6 },
    { itemId: "table", name: "Table", kind: "placeable", description: "Faction room furniture", defaultCurrency: "ash", defaultPriceAsh: 0, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 2 },
    { itemId: "wardrobe", name: "Wardrobe", kind: "placeable", description: "Faction room furniture", defaultCurrency: "ash", defaultPriceAsh: 0, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 1 },
    { itemId: "wall-poster", name: "Wall Poster", kind: "placeable", description: "Faction room wall art", defaultCurrency: "ash", defaultPriceAsh: 100, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 4 },

    { itemId: "scream_mask", name: "Scream Mask", kind: "cosmetic", description: "Accessory", defaultCurrency: "ash", defaultPriceAsh: 1, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 1 },
    { itemId: "trump_hair", name: "Trump Hair", kind: "cosmetic", description: "Accessory", defaultCurrency: "ash", defaultPriceAsh: 1, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 1 },
    { itemId: "scream_robe", name: "Scream Costume", kind: "cosmetic", description: "Full skin", defaultCurrency: "ash", defaultPriceAsh: 1, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 1 },
    { itemId: "trump_suit", name: "Trump Business Suit", kind: "cosmetic", description: "Full skin", defaultCurrency: "ash", defaultPriceAsh: 1, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 1 },
    { itemId: "pepe_frog", name: "Pepe The Frog", kind: "cosmetic", description: "Full skin", defaultCurrency: "ash", defaultPriceAsh: 1, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 1 },

    { itemId: "faction_creation", name: "Faction Creation", kind: "faction", description: "Founding a faction at Alaric", defaultCurrency: "tnj", defaultPriceAsh: 0, defaultPriceTnj: 1000000, defaultPriceUsdCents: 5000, maxOwned: null },
    { itemId: "faction_promo_code", name: "Faction Promo Code", kind: "faction", description: "Shareable code granting the game", defaultCurrency: "tnj", defaultPriceAsh: 0, defaultPriceTnj: 1000000, defaultPriceUsdCents: 5000, maxOwned: null },
    { itemId: "faction_gate", name: "Faction Gate Room", kind: "faction", description: "Private room in Token Gates", defaultCurrency: "tnj", defaultPriceAsh: 0, defaultPriceTnj: 1000000, defaultPriceUsdCents: 5000, maxOwned: null },
];

export const SHOP_CATALOG_BY_ID = new Map(SHOP_CATALOG.map((e) => [e.itemId, e]));

export function isShopItemId(value: unknown): value is string {
    return typeof value === "string" && SHOP_CATALOG_BY_ID.has(value);
}

export interface ResolvedPrice {
    itemId: string;
    currency: ShopCurrency;
    priceAsh: number;
    priceTnj: number;
    priceUsdCents: number;
    enabled: boolean;
}

export function defaultPrice(entry: ShopCatalogEntry): ResolvedPrice {
    return {
        itemId: entry.itemId,
        currency: entry.defaultCurrency,
        priceAsh: entry.defaultPriceAsh,
        priceTnj: entry.defaultPriceTnj,
        priceUsdCents: entry.defaultPriceUsdCents,
        enabled: true,
    };
}
