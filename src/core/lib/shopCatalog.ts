// src/core/lib/shopCatalog.ts
export type ShopCurrency = "ash" | "tnj" | "usd";

export type ShopItemKind = "placeable" | "cosmetic" | "faction" | "consumable" | "pet";

export interface ShopCatalogEntry {
    itemId: string;
    name: string;
    nameKey: string;
    kind: ShopItemKind;
    description: string;
    descriptionKey: string;
    defaultCurrency: ShopCurrency;
    defaultPriceAsh: number;
    defaultPriceTnj: number;
    defaultPriceUsdCents: number;
    maxOwned: number | null;
}

export const SHOP_CATALOG: ShopCatalogEntry[] = [
    { itemId: "sign-on-a-stick", name: "Sign on a Stick", nameKey: "g.placeable.sign-on-a-stick.name", kind: "placeable", description: "Placed in the open world", descriptionKey: "g.shopItem.sign-on-a-stick.description", defaultCurrency: "ash", defaultPriceAsh: 100, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 10 },
    { itemId: "sphere", name: "Sphere", nameKey: "g.placeable.sphere.name", kind: "placeable", description: "Tradeable trinket", descriptionKey: "g.shopItem.sphere.description", defaultCurrency: "ash", defaultPriceAsh: 100, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 50 },
    { itemId: "chair", name: "Chair", nameKey: "g.build.item.chair", kind: "placeable", description: "Faction room furniture", descriptionKey: "g.shopItem.factionFurniture", defaultCurrency: "ash", defaultPriceAsh: 0, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 6 },
    { itemId: "table", name: "Table", nameKey: "g.build.item.table", kind: "placeable", description: "Faction room furniture", descriptionKey: "g.shopItem.factionFurniture", defaultCurrency: "ash", defaultPriceAsh: 0, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 2 },
    { itemId: "wardrobe", name: "Wardrobe", nameKey: "g.shopItem.wardrobe.name", kind: "placeable", description: "Faction room furniture", descriptionKey: "g.shopItem.factionFurniture", defaultCurrency: "ash", defaultPriceAsh: 0, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 1 },
    { itemId: "wall-poster", name: "Wall Poster", nameKey: "g.placeable.wall-poster.name", kind: "placeable", description: "Faction room wall art", descriptionKey: "g.shopItem.wall-poster.description", defaultCurrency: "ash", defaultPriceAsh: 100, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 4 },
    { itemId: "storage-crate", name: "Storage Crate", nameKey: "g.placeable.storage-crate.name", kind: "placeable", description: "Token vault built in your own room", descriptionKey: "g.shopItem.storage-crate.description", defaultCurrency: "ash", defaultPriceAsh: 200, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: null },

    { itemId: "home-teleport", name: "Homeward Charge", nameKey: "g.placeable.home-teleport.name", kind: "consumable", description: "Five second cast, teleports you to your spawn beacon", descriptionKey: "g.shopItem.home-teleport.description", defaultCurrency: "ash", defaultPriceAsh: 250, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 10 },
    { itemId: "run-insurance", name: "Run Insurance", nameKey: "g.placeable.run-insurance.name", kind: "consumable", description: "Keeps your tokens through one death", descriptionKey: "g.placeable.run-insurance.hint", defaultCurrency: "ash", defaultPriceAsh: 1000, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 1 },

    { itemId: "pet-dog", name: "Scrap Hound", nameKey: "g.pet.pet-dog.name", kind: "pet", description: "Fetches loot from mobs you killed", descriptionKey: "g.shopItem.pet-dog.description", defaultCurrency: "usd", defaultPriceAsh: 0, defaultPriceTnj: 100000, defaultPriceUsdCents: 500, maxOwned: 1 },

    { itemId: "scream_mask", name: "Scream Mask", nameKey: "g.cosmetic.scream_mask.name", kind: "cosmetic", description: "Accessory", descriptionKey: "g.shopItem.accessory", defaultCurrency: "ash", defaultPriceAsh: 1, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 1 },
    { itemId: "trump_hair", name: "Trump Hair", nameKey: "g.cosmetic.trump_hair.name", kind: "cosmetic", description: "Accessory", descriptionKey: "g.shopItem.accessory", defaultCurrency: "ash", defaultPriceAsh: 1, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 1 },
    { itemId: "scream_robe", name: "Scream Costume", nameKey: "g.cosmetic.scream_robe.name", kind: "cosmetic", description: "Full skin", descriptionKey: "g.shopItem.fullSkin", defaultCurrency: "ash", defaultPriceAsh: 1, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 1 },
    { itemId: "trump_suit", name: "Trump Business Suit", nameKey: "g.cosmetic.trump_suit.name", kind: "cosmetic", description: "Full skin", descriptionKey: "g.shopItem.fullSkin", defaultCurrency: "ash", defaultPriceAsh: 1, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 1 },
    { itemId: "pepe_frog", name: "Pepe The Frog", nameKey: "g.cosmetic.pepe_frog.name", kind: "cosmetic", description: "Full skin", descriptionKey: "g.shopItem.fullSkin", defaultCurrency: "ash", defaultPriceAsh: 1, defaultPriceTnj: 0, defaultPriceUsdCents: 0, maxOwned: 1 },

    { itemId: "faction_creation", name: "Faction Creation", nameKey: "g.shopItem.faction_creation.name", kind: "faction", description: "Founding a faction at Alaric", descriptionKey: "g.shopItem.faction_creation.description", defaultCurrency: "tnj", defaultPriceAsh: 0, defaultPriceTnj: 1000000, defaultPriceUsdCents: 5000, maxOwned: null },
    { itemId: "faction_promo_code", name: "Faction Promo Code", nameKey: "g.shopItem.faction_promo_code.name", kind: "faction", description: "Shareable code granting the game", descriptionKey: "g.shopItem.faction_promo_code.description", defaultCurrency: "tnj", defaultPriceAsh: 0, defaultPriceTnj: 1000000, defaultPriceUsdCents: 5000, maxOwned: null },
    { itemId: "faction_gate", name: "Faction Gate Room", nameKey: "g.shopItem.faction_gate.name", kind: "faction", description: "Private room in Token Gates", descriptionKey: "g.shopItem.faction_gate.description", defaultCurrency: "tnj", defaultPriceAsh: 0, defaultPriceTnj: 1000000, defaultPriceUsdCents: 5000, maxOwned: null },
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
