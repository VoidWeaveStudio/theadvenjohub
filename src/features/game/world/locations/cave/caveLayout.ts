// src/features/game/world/locations/cave/caveLayout.ts

export interface CaveChamber {
    x: number;
    z: number;
    radius: number;
    ceiling: number;
    secretId?: string;
}

export interface CaveTunnel {
    ax: number;
    az: number;
    bx: number;
    bz: number;
    halfWidth: number;
    ceiling: number;
    secretId?: string;
}

export interface CaveSecret {
    id: string;
    doorX: number;
    doorZ: number;
    doorAngle: number;
    prompt: string;
    requiresBoss: boolean;
}

export interface CaveChest {
    id: string;
    x: number;
    z: number;
    rotation: number;
}

export const CAVE_FLOOR_Y = 0;
export const CAVE_ENTRANCE = { x: 0, z: 8 };
export const CAVE_BOSS_SPAWN = { x: 0, z: -132 };
export const CAVE_CHEST_REWARD = 1000;
export const CAVE_SECRET_DOOR_WIDTH = 7;
export const CAVE_SECRET_DOOR_HEIGHT = 6;

export const CAVE_CHAMBERS: CaveChamber[] = [
    { x: 0, z: 6, radius: 16, ceiling: 9 },
    { x: 0, z: -46, radius: 13, ceiling: 8 },
    { x: -54, z: -72, radius: 17, ceiling: 11 },
    { x: 50, z: -78, radius: 16, ceiling: 10 },
    { x: 0, z: -132, radius: 27, ceiling: 18 },
    { x: -92, z: -34, radius: 9, ceiling: 6.5, secretId: "crack" },
    { x: 88, z: -52, radius: 9, ceiling: 6.5, secretId: "lever" },
    { x: 0, z: -178, radius: 10, ceiling: 7, secretId: "vault" },
];

export const CAVE_TUNNELS: CaveTunnel[] = [
    { ax: 0, az: 6, bx: 0, bz: -46, halfWidth: 4.2, ceiling: 6 },
    { ax: 0, az: -46, bx: -54, bz: -72, halfWidth: 3.8, ceiling: 5.5 },
    { ax: 0, az: -46, bx: 50, bz: -78, halfWidth: 3.8, ceiling: 5.5 },
    { ax: 0, az: -46, bx: 0, bz: -132, halfWidth: 5, ceiling: 7 },
    { ax: -54, az: -72, bx: -78, bz: -40, halfWidth: 3.2, ceiling: 5 },
    { ax: 50, az: -78, bx: 74, bz: -56, halfWidth: 3.2, ceiling: 5 },
    { ax: -78, az: -40, bx: -92, bz: -34, halfWidth: 3, ceiling: 5, secretId: "crack" },
    { ax: 74, az: -56, bx: 88, bz: -52, halfWidth: 3, ceiling: 5, secretId: "lever" },
    { ax: 0, az: -132, bx: 0, bz: -178, halfWidth: 3.4, ceiling: 5.5, secretId: "vault" },
];

export const CAVE_SECRETS: CaveSecret[] = [
    { id: "crack", doorX: -80.5, doorZ: -39.4, doorAngle: Math.PI * 0.42, prompt: "[E] The wall here sounds hollow", requiresBoss: false },
    { id: "lever", doorX: 76.5, doorZ: -55.4, doorAngle: -Math.PI * 0.42, prompt: "[E] A rusted lever hides behind the stone", requiresBoss: false },
    { id: "vault", doorX: 0, doorZ: -157, doorAngle: 0, prompt: "[E] The seal is cold and unmoving", requiresBoss: true },
];

export const CAVE_CHESTS: CaveChest[] = [
    { id: "crack", x: -93, z: -33, rotation: Math.PI * 0.35 },
    { id: "lever", x: 89, z: -51, rotation: -Math.PI * 0.3 },
    { id: "vault", x: 0, z: -180, rotation: 0 },
];

export function segmentDistance(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
    const dx = bx - ax;
    const dz = bz - az;
    const lengthSquared = dx * dx + dz * dz;

    let t = lengthSquared > 0 ? ((px - ax) * dx + (pz - az) * dz) / lengthSquared : 0;
    t = Math.max(0, Math.min(1, t));

    const cx = ax + dx * t;
    const cz = az + dz * t;
    return Math.sqrt((px - cx) ** 2 + (pz - cz) ** 2);
}

export interface CaveSample {
    distance: number;
    ceiling: number;
    secretId: string | null;
}

export function sampleCave(x: number, z: number): CaveSample {
    let distance = Infinity;
    let ceiling = 6;
    let secretId: string | null = null;

    for (const chamber of CAVE_CHAMBERS) {
        const d = Math.sqrt((x - chamber.x) ** 2 + (z - chamber.z) ** 2) - chamber.radius;
        if (d < distance) {
            distance = d;
            ceiling = chamber.ceiling;
            secretId = chamber.secretId ?? null;
        }
    }

    for (const tunnel of CAVE_TUNNELS) {
        const d = segmentDistance(x, z, tunnel.ax, tunnel.az, tunnel.bx, tunnel.bz) - tunnel.halfWidth;
        if (d < distance) {
            distance = d;
            ceiling = tunnel.ceiling;
            secretId = tunnel.secretId ?? null;
        }
    }

    return { distance, ceiling, secretId };
}
