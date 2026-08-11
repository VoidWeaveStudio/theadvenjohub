// src/features/game/world/locations/tower/floors/main-hall/utils/collision.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../../../CollisionGrid";
import { inwardRotation, localToWorld } from "../layout";

export function insertBox(
    grid: CollisionGrid,
    centerX: number,
    centerZ: number,
    halfX: number,
    halfZ: number,
    minY: number,
    maxY: number
) {
    grid.insert(new THREE.Box3(
        new THREE.Vector3(centerX - halfX, minY, centerZ - halfZ),
        new THREE.Vector3(centerX + halfX, maxY, centerZ + halfZ)
    ));
}

export function insertRotatedBox(
    grid: CollisionGrid,
    centerX: number,
    centerZ: number,
    width: number,
    depth: number,
    rotation: number,
    minY: number,
    maxY: number
) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    if (Math.abs(sin) < 1e-4) {
        insertBox(grid, centerX, centerZ, width / 2, depth / 2, minY, maxY);
        return;
    }

    if (Math.abs(cos) < 1e-4) {
        insertBox(grid, centerX, centerZ, depth / 2, width / 2, minY, maxY);
        return;
    }

    grid.insertOrientedBox(centerX, centerZ, width, depth, rotation, minY, maxY);
}

export function insertLocalBox(
    grid: CollisionGrid,
    angle: number,
    radius: number,
    localX: number,
    localZ: number,
    width: number,
    depth: number,
    minY: number,
    maxY: number
) {
    const [x, , z] = localToWorld(angle, radius, localX, 0, localZ);
    insertRotatedBox(grid, x, z, width, depth, inwardRotation(angle), minY, maxY);
}

export function insertDisc(grid: CollisionGrid, radius: number, top: number, thickness: number) {
    grid.insertPlatform(0, radius, Math.max(0, top - thickness), top);
}

export function insertAnnulusDeck(
    grid: CollisionGrid,
    innerRadius: number,
    outerRadius: number,
    top: number,
    thickness: number
) {
    grid.insertPlatform(innerRadius, outerRadius, top - thickness, top);
}
