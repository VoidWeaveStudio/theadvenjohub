// src/features/game/world/locations/main-world/worldConfig.ts

export const WORLD_SIZE = 1000;
export const WORLD_HALF = WORLD_SIZE / 2;

export const CHUNK_SIZE = 125;
export const CHUNKS_PER_SIDE = WORLD_SIZE / CHUNK_SIZE;
export const CHUNK_SEGMENTS = 48;
export const VIEW_CHUNK_RADIUS = 2;

export const WORLD_SEED = 20260812;

export const SEA_LEVEL = 0;
export const SEABED_DEPTH = -16;
export const SHORE_RADIUS = 400;
export const RING_INNER = 428;
export const RING_OUTER = 496;
export const PLAY_RADIUS = 466;

export const SAFE_ZONE_RADIUS = 34;
export const SPAWN_FLAT_RADIUS = 52;

export const RAMPART_BAND_NEAR = 8;
export const RAMPART_BAND_FAR = 34;
export const RAMPART_FOG_NEAR = 36;
export const RAMPART_FOG_FAR = 50;
export const RAMPART_VISIBLE_MARGIN = 54;

export const TOWER_X = 300;
export const TOWER_Z = 0;
export const TOWER_FLAT_RADIUS = 90;
export const TOWER_PLAZA_HALF_WIDTH = 46;
export const TOWER_PLAZA_NEAR = 26;
export const TOWER_PLAZA_FAR = 122;

export function insideTowerPlaza(x: number, z: number): boolean {
    const along = TOWER_X - x;
    if (along < TOWER_PLAZA_NEAR || along > TOWER_PLAZA_FAR) return false;
    return Math.abs(z - TOWER_Z) <= TOWER_PLAZA_HALF_WIDTH;
}

export const CAVE_PORTAL_X = -31;
export const CAVE_PORTAL_Z = 31;

export interface LakeDefinition {
    x: number;
    z: number;
    radius: number;
    depth: number;
}

export const LAKES: LakeDefinition[] = [
    { x: -168, z: 128, radius: 96, depth: 13 },
    { x: 186, z: 158, radius: 72, depth: 10 },
    { x: -286, z: -186, radius: 58, depth: 8 },
];

export interface PortDefinition {
    angle: number;
    halfWidth: number;
}

export const PORTS: PortDefinition[] = [
    { angle: Math.PI * 0.18, halfWidth: 0.13 },
    { angle: Math.PI * 0.92, halfWidth: 0.1 },
];

export const COVE_ANGLE = -Math.PI * 0.52;
export const COVE_CENTER_RADIUS = 322;
export const COVE_RADIUS = 176;
export const COVE_FLOOR = -7.5;
export const COVE_SHELF = -1;
export const COVE_BERM = 1.6;
export const COVE_RIM = 5.2;
export const COVE_MOUTH_HALF_WIDTH = 74;
export const COVE_CHANNEL_END = 540;
export const COVE_RING_OPENNESS = 0.19;

export const COVE_X = Math.cos(COVE_ANGLE) * COVE_CENTER_RADIUS;
export const COVE_Z = Math.sin(COVE_ANGLE) * COVE_CENTER_RADIUS;

export const HARBOR_PIER_COUNT = 2;
export const HARBOR_DECK_Y = 2.1;
