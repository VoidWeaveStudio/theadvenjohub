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
    { id: "sign-on-a-stick", name: "Sign on a Stick", icon: "🪧", price: 100, maxOwned: 10, placementScope: "main-world" },
    { id: "sphere", name: "Sphere", icon: "🔮", price: 100, maxOwned: 50, placeable: false, tradeable: true },
    { id: "home-teleport", name: "Homeward Charge", icon: "🌀", price: 250, maxOwned: 10, placeable: false, hint: "5s cast, 10 min cooldown" },
    { id: "storage-crate", name: "Storage Crate", icon: "📦", price: 200, maxOwned: null, placeable: false, hint: "Build it in your own room — 50 slots" },
    { id: "run-insurance", name: "Run Insurance", icon: "🛡️", price: 1000, maxOwned: 1, placeable: false, hint: "Keeps your tokens through one death" },
];
