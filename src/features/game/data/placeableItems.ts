// src/features/game/data/placeableItems.ts
export interface PlaceableItem {
    id: string;
    name: string;
    icon: string;
    price: number;
    maxOwned: number | null;
    placeable?: boolean;
    tradeable?: boolean;
    placementScope?: "main-world";
    hint?: string;
}

export const PLACEABLE_ITEMS: PlaceableItem[] = [
    { id: "sign-on-a-stick", name: "g.placeable.sign-on-a-stick.name", icon: "🪧", price: 100, maxOwned: 10, placementScope: "main-world" },
    { id: "sphere", name: "g.placeable.sphere.name", icon: "🔮", price: 100, maxOwned: 50, placeable: false, tradeable: true },
    { id: "home-teleport", name: "g.placeable.home-teleport.name", icon: "🌀", price: 250, maxOwned: 10, placeable: false, hint: "g.placeable.home-teleport.hint" },
    { id: "storage-crate", name: "g.placeable.storage-crate.name", icon: "📦", price: 200, maxOwned: null, placeable: false, hint: "g.placeable.storage-crate.hint" },
    { id: "run-insurance", name: "g.placeable.run-insurance.name", icon: "🛡️", price: 1000, maxOwned: 1, placeable: false, hint: "g.placeable.run-insurance.hint" },
];
