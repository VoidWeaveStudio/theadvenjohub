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