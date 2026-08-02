// src/features/game/data/placeableItems.ts
export interface PlaceableItem {
    id: string;
    name: string;
    icon: string;
    price: number;
    maxOwned: number;
}

export const PLACEABLE_ITEMS: PlaceableItem[] = [
    { id: "sign-on-a-stick", name: "Sign on a Stick", icon: "🪧", price: 100, maxOwned: 10 },
];
