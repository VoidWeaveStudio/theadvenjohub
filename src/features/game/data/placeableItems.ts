// src/features/game/data/placeableItems.ts
export interface PlaceableItem {
    id: string;
    name: string;
    icon: string;
    price: number;
    maxOwned: number;
    placeable?: boolean;
    tradeable?: boolean;
    placementScope?: "main-world";
}

export const PLACEABLE_ITEMS: PlaceableItem[] = [
    { id: "sign-on-a-stick", name: "Sign on a Stick", icon: "🪧", price: 100, maxOwned: 10, placementScope: "main-world" },
    { id: "sphere", name: "Sphere", icon: "🔮", price: 100, maxOwned: 50, placeable: false, tradeable: true },
];
