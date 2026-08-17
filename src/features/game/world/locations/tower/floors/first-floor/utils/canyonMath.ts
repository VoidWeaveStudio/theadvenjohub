// src/features/game/world/locations/tower/floors/first-floor/utils/canyonMath.ts
export const CANYON_HALF_WIDTH = 50;
export const CANYON_HUB_LENGTH = 100;
export const CANYON_START_Z = CANYON_HUB_LENGTH;
export const SAFE_ENTRANCE_DEPTH = 100;
export const COMBAT_DEPTH = 360;
export const BOSS_ZONE_DEPTH = 40;
export const SEGMENT_LENGTH = SAFE_ENTRANCE_DEPTH + COMBAT_DEPTH + BOSS_ZONE_DEPTH;
export const SEAL_TRIGGER_MARGIN = 20;
export const RETURN_PAD_OFFSET = 20;
export const FLOOR_HALF_WIDTH = 100;

export function segmentStartZ(segment: number): number {
    return CANYON_START_Z + (segment - 1) * SEGMENT_LENGTH;
}

export function pathOffsetX(z: number): number {
    if (z <= CANYON_START_Z) return 0;
    const rel = z - CANYON_START_Z;
    return Math.sin(rel * 0.008) * 22 + Math.sin(rel * 0.021 + 1.7) * 9;
}

export function halfWidthAt(z: number): number {
    if (z <= CANYON_START_Z) return CANYON_HALF_WIDTH;
    const rel = z - CANYON_START_Z;
    return Math.max(25, CANYON_HALF_WIDTH + Math.sin(rel * 0.006 + 0.5) * 15);
}
