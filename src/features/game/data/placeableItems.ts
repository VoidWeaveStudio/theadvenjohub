// src/features/game/data/placeableItems.ts
export interface PlaceableItem {
    id: string;
    name: string;
    icon: string;
    price: number;
    maxOwned: number;
    placeable?: boolean;
    tradeable?: boolean;
    placementScope?: "main-world" | "own-faction-room";
}

export const PLACEABLE_ITEMS: PlaceableItem[] = [
    { id: "sign-on-a-stick", name: "Sign on a Stick", icon: "🪧", price: 100, maxOwned: 10, placementScope: "main-world" },
    { id: "sphere", name: "Sphere", icon: "🔮", price: 100, maxOwned: 50, placeable: false, tradeable: true },
    { id: "chair", name: "Chair", icon: "🪑", price: 0, maxOwned: 6, placementScope: "own-faction-room" },
    { id: "table", name: "Table", icon: "🛋️", price: 0, maxOwned: 2, placementScope: "own-faction-room" },
    { id: "wardrobe", name: "Wardrobe", icon: "🚪", price: 0, maxOwned: 1, placementScope: "own-faction-room" },
    { id: "wall-poster", name: "Wall Poster", icon: "🖼️", price: 100, maxOwned: 4, placementScope: "own-faction-room" },
];
