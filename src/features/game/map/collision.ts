// src/features/game/map/collision.ts

import { CollisionBox } from '../types';
import { COLLISION_CONFIG } from '../config/gameConfig';
import { SpatialGrid } from './SpatialGrid';

let globalGrid: SpatialGrid | null = null;

export function buildCollisionGrid(boxes: CollisionBox[]): SpatialGrid {
    const grid = new SpatialGrid(COLLISION_CONFIG.gridCellSize);
    for (const box of boxes) {
        grid.insert(box);
    }
    globalGrid = grid;
    return grid;
}

export function getCollisionGrid(): SpatialGrid | null {
    return globalGrid;
}

export function checkCollision(
    x: number,
    z: number,
    collisionBoxes: CollisionBox[],
    radius: number = COLLISION_CONFIG.playerRadius,
): boolean {
    if (globalGrid) {
        const nearby = globalGrid.query(x, z, radius + 5);
        for (const box of nearby) {
            const closestX = Math.max(box.minX, Math.min(x, box.maxX));
            const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
            const dx = x - closestX;
            const dz = z - closestZ;
            if (dx * dx + dz * dz < radius * radius) return true;
        }
        return false;
    }

    for (const box of collisionBoxes) {
        const closestX = Math.max(box.minX, Math.min(x, box.maxX));
        const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
        const dx = x - closestX;
        const dz = z - closestZ;
        if (dx * dx + dz * dz < radius * radius) return true;
    }
    return false;
}

export function pushOutOfCollision(
    x: number,
    z: number,
    collisionBoxes: CollisionBox[],
    radius: number = COLLISION_CONFIG.playerRadius,
): { x: number; z: number } {
    if (!checkCollision(x, z, collisionBoxes, radius)) {
        return { x, z };
    }

    for (let r = 0.5; r <= 5.0; r += 0.5) {
        for (let angle = 0; angle < Math.PI * 2; angle += 0.4) {
            const nx = x + Math.cos(angle) * r;
            const nz = z + Math.sin(angle) * r;
            if (!checkCollision(nx, nz, collisionBoxes, radius)) {
                return { x: nx, z: nz };
            }
        }
    }

    return { x, z };
}

export function isSpawnPointSafe(
    x: number,
    z: number,
    collisionBoxes: CollisionBox[],
    radius: number = COLLISION_CONFIG.playerRadius,
    safetyMargin: number = 1.0,
): boolean {
    return !checkCollision(x, z, collisionBoxes, radius + safetyMargin);
}