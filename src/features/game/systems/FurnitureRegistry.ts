// src/features/game/systems/FurnitureRegistry.ts
import * as THREE from "three";
import { Chair } from "../entities/furniture/Chair";
import { Table } from "../entities/furniture/Table";
import { Wardrobe } from "../entities/furniture/Wardrobe";
import { WallPoster } from "../entities/furniture/WallPoster";

export interface FurnitureEntity {
    readonly id: string;
    readonly mesh: THREE.Group;
    dispose(scene: THREE.Scene): void;
    update?(now: number): void;
    toggleOpen?(): void;
    updateContent?(contentType: "text" | "draw", textContent: string | null, drawingUrl: string | null): void;
    ownerId?: string;
    ownerNickname?: string;
    contentType?: "text" | "draw" | null;
    textContent?: string | null;
    drawingUrl?: string | null;
}

export interface FurnitureOwner {
    ownerId: string;
    ownerNickname: string;
    contentType?: "text" | "draw" | null;
    textContent?: string | null;
    drawingUrl?: string | null;
}

export interface FurnitureDef {
    itemId: string;
    wallMounted: boolean;
    maxPlacedPerOwner: number;
    build(id: string, ghost: boolean, owner?: FurnitureOwner): FurnitureEntity;
}

export const FURNITURE_DEFS: Record<string, FurnitureDef> = {
    chair: {
        itemId: "chair",
        wallMounted: false,
        maxPlacedPerOwner: 6,
        build: (id, ghost) => new Chair(id, ghost),
    },
    table: {
        itemId: "table",
        wallMounted: false,
        maxPlacedPerOwner: 2,
        build: (id, ghost) => new Table(id, ghost),
    },
    wardrobe: {
        itemId: "wardrobe",
        wallMounted: false,
        maxPlacedPerOwner: 1,
        build: (id, ghost) => new Wardrobe(id, ghost),
    },
    "wall-poster": {
        itemId: "wall-poster",
        wallMounted: true,
        maxPlacedPerOwner: 4,
        build: (id, ghost, owner) =>
            new WallPoster(
                id,
                owner?.ownerId ?? "",
                owner?.ownerNickname ?? "",
                owner?.contentType ?? null,
                owner?.textContent ?? null,
                owner?.drawingUrl ?? null,
                ghost
            ),
    },
};

export function isFurnitureItemId(itemId: string): boolean {
    return itemId in FURNITURE_DEFS;
}
