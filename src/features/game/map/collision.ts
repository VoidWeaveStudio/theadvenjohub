//src\features\game\map\collision.ts
import { CollisionBox } from '../types';
import { PLAYER_RADIUS } from '../constants';

export function checkCollision(
    x: number,
    z: number,
    collisionBoxes: CollisionBox[],
    radius: number = PLAYER_RADIUS
): boolean {
    for (const box of collisionBoxes) {
        const closestX = Math.max(box.minX, Math.min(x, box.maxX));
        const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));

        const distanceX = x - closestX;
        const distanceZ = z - closestZ;

        if (distanceX * distanceX + distanceZ * distanceZ < radius * radius) {
            return true;
        }
    }
    return false;
}

export function pushOutOfCollision(
    x: number,
    z: number,
    collisionBoxes: CollisionBox[],
    radius: number = PLAYER_RADIUS
): { x: number; z: number } {
    let newX = x;
    let newZ = z;
    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
        let pushed = false;

        for (const box of collisionBoxes) {
            const closestX = Math.max(box.minX, Math.min(newX, box.maxX));
            const closestZ = Math.max(box.minZ, Math.min(newZ, box.maxZ));

            const distanceX = newX - closestX;
            const distanceZ = newZ - closestZ;
            const distanceSquared = distanceX * distanceX + distanceZ * distanceZ;

            if (distanceSquared < radius * radius) {
                const distance = Math.sqrt(distanceSquared);
                if (distance > 0) {
                    const overlap = radius - distance;
                    const pushX = (distanceX / distance) * overlap;
                    const pushZ = (distanceZ / distance) * overlap;
                    newX += pushX;
                    newZ += pushZ;
                    pushed = true;
                } else {
                    newX += radius;
                    pushed = true;
                }
            }
        }

        if (!pushed) break;
        iterations++;
    }

    return { x: newX, z: newZ };
}

export function isSpawnPointSafe(
    x: number,
    z: number,
    collisionBoxes: CollisionBox[],
    radius: number = PLAYER_RADIUS,
    safetyMargin: number = 1.0
): boolean {
    return !checkCollision(x, z, collisionBoxes, radius + safetyMargin);
}