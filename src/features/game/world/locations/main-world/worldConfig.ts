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

export const TOWER_X = 300;
export const TOWER_Z = 0;
export const TOWER_FLAT_RADIUS = 90;

export const CAVE_PORTAL_X = -148;
export const CAVE_PORTAL_Z = -96;

export interface LakeDefinition {
    x: number;
    z: number;
    radius: number;
    depth: number;
}

export const LAKES: LakeDefinition[] = [
    { x: -168, z: 128, radius: 96, depth: 13 },
    { x: 104, z: -238, radius: 72, depth: 10 },
    { x: -286, z: -186, radius: 58, depth: 8 },
];

export interface PortDefinition {
    angle: number;
    halfWidth: number;
}

export const PORTS: PortDefinition[] = [
    { angle: Math.PI * 0.18, halfWidth: 0.13 },
    { angle: Math.PI * 0.92, halfWidth: 0.1 },
    { angle: -Math.PI * 0.52, halfWidth: 0.11 },
];
