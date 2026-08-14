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
export const CAVE_BOSS_SPAWN = { x: 24, z: -262 };
export const CAVE_CHEST_REWARD = 1000;
export const CAVE_SECRET_DOOR_WIDTH = 7;
export const CAVE_SECRET_DOOR_HEIGHT = 6;

export const CAVE_CHAMBERS: CaveChamber[] = [
    { x: 0, z: 6, radius: 14, ceiling: 8 },
    { x: -46, z: -14, radius: 12, ceiling: 9 },
    { x: -58, z: -62, radius: 15, ceiling: 11 },
    { x: 2, z: -80, radius: 13, ceiling: 9 },
    { x: 44, z: -44, radius: 11, ceiling: 8 },
    { x: 62, z: -66, radius: 10, ceiling: 7 },
    { x: -10, z: -126, radius: 14, ceiling: 12 },
    { x: -56, z: -160, radius: 12, ceiling: 10 },
    { x: -16, z: -206, radius: 10, ceiling: 9 },
    { x: 24, z: -252, radius: 38, ceiling: 24 },
    { x: -102, z: -56, radius: 7, ceiling: 6 },
    { x: 40, z: -134, radius: 8, ceiling: 7 },
    { x: -98, z: -178, radius: 7, ceiling: 6.5 },
    { x: -84, z: -30, radius: 9, ceiling: 6.5, secretId: "crack" },
    { x: 88, z: -80, radius: 9, ceiling: 6.5, secretId: "lever" },
    { x: 24, z: -316, radius: 11, ceiling: 7, secretId: "vault" },
];

export const CAVE_BOSS_ARENA = { x: 24, z: -252, radius: 30 };

export const CAVE_TUNNELS: CaveTunnel[] = [
    { ax: 0, az: 6, bx: -34, bz: -2, halfWidth: 3.6, ceiling: 6 },
    { ax: -34, az: -2, bx: -46, bz: -14, halfWidth: 3.6, ceiling: 6 },
    { ax: -46, az: -14, bx: -52, bz: -46, halfWidth: 4, ceiling: 6.5 },
    { ax: -52, az: -46, bx: -58, bz: -62, halfWidth: 4, ceiling: 6.5 },
    { ax: -58, az: -62, bx: -14, bz: -74, halfWidth: 3.8, ceiling: 6 },
    { ax: -14, az: -74, bx: 2, bz: -80, halfWidth: 3.8, ceiling: 6 },
    { ax: 2, az: -80, bx: 44, bz: -44, halfWidth: 3.4, ceiling: 5.5 },
    { ax: 44, az: -44, bx: 12, bz: -2, halfWidth: 3.4, ceiling: 5.5 },
    { ax: 2, az: -80, bx: 46, bz: -70, halfWidth: 3.4, ceiling: 5.5 },
    { ax: 46, az: -70, bx: 62, bz: -66, halfWidth: 3.4, ceiling: 5.5 },
    { ax: 2, az: -80, bx: -6, bz: -112, halfWidth: 4.2, ceiling: 6.5 },
    { ax: -6, az: -112, bx: -10, bz: -126, halfWidth: 4.2, ceiling: 6.5 },
    { ax: -10, az: -126, bx: -44, bz: -146, halfWidth: 3.6, ceiling: 6 },
    { ax: -44, az: -146, bx: -56, bz: -160, halfWidth: 3.6, ceiling: 6 },
    { ax: -56, az: -160, bx: -30, bz: -196, halfWidth: 4, ceiling: 6.5 },
    { ax: -30, az: -196, bx: -16, bz: -206, halfWidth: 4, ceiling: 6.5 },
    { ax: -16, az: -206, bx: 4, bz: -230, halfWidth: 5, ceiling: 8 },
    { ax: 4, az: -230, bx: 18, bz: -240, halfWidth: 5, ceiling: 8 },
    { ax: -58, az: -62, bx: -92, bz: -58, halfWidth: 2.8, ceiling: 5 },
    { ax: -92, az: -58, bx: -102, bz: -56, halfWidth: 2.8, ceiling: 5 },
    { ax: -10, az: -126, bx: 26, bz: -132, halfWidth: 3, ceiling: 5 },
    { ax: 26, az: -132, bx: 40, bz: -134, halfWidth: 3, ceiling: 5 },
    { ax: -56, az: -160, bx: -88, bz: -172, halfWidth: 2.8, ceiling: 5 },
    { ax: -88, az: -172, bx: -98, bz: -178, halfWidth: 2.8, ceiling: 5 },
    { ax: -46, az: -14, bx: -70, bz: -24, halfWidth: 3, ceiling: 5 },
    { ax: -70, az: -24, bx: -84, bz: -30, halfWidth: 3, ceiling: 5, secretId: "crack" },
    { ax: 62, az: -66, bx: 78, bz: -74, halfWidth: 3, ceiling: 5 },
    { ax: 78, az: -74, bx: 88, bz: -80, halfWidth: 3, ceiling: 5, secretId: "lever" },
    { ax: 24, az: -288, bx: 24, bz: -316, halfWidth: 3.4, ceiling: 5.5, secretId: "vault" },
];

export const CAVE_SECRETS: CaveSecret[] = [
    { id: "crack", doorX: -74, doorZ: -25.7, doorAngle: 1.166, prompt: "[E] The wall here sounds hollow", requiresBoss: false },
    { id: "lever", doorX: 81, doorZ: -75.8, doorAngle: -1.03, prompt: "[E] A rusted lever hides behind the stone", requiresBoss: false },
    { id: "vault", doorX: 24, doorZ: -296, doorAngle: 0, prompt: "[E] The seal is cold and unmoving", requiresBoss: true },
];

export const CAVE_CHESTS: CaveChest[] = [
    { id: "crack", x: -86, z: -31, rotation: Math.PI * 0.35 },
    { id: "lever", x: 89, z: -79, rotation: -Math.PI * 0.3 },
    { id: "vault", x: 24, z: -318, rotation: 0 },
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

const CEILING_BLEND = 14;

export function sampleCave(x: number, z: number): CaveSample {
    let distance = Infinity;
    let secretId: string | null = null;
    let ceilingSum = 0;
    let weightSum = 0;

    const accumulate = (d: number, ceiling: number, secret: string | null) => {
        if (d < distance) {
            distance = d;
            secretId = secret;
        }

        const falloff = Math.max(0, d) / CEILING_BLEND + 1;
        const weight = 1 / (falloff * falloff * falloff);
        ceilingSum += ceiling * weight;
        weightSum += weight;
    };

    for (const chamber of CAVE_CHAMBERS) {
        accumulate(
            Math.sqrt((x - chamber.x) ** 2 + (z - chamber.z) ** 2) - chamber.radius,
            chamber.ceiling,
            chamber.secretId ?? null
        );
    }

    for (const tunnel of CAVE_TUNNELS) {
        accumulate(
            segmentDistance(x, z, tunnel.ax, tunnel.az, tunnel.bx, tunnel.bz) - tunnel.halfWidth,
            tunnel.ceiling,
            tunnel.secretId ?? null
        );
    }

    return {
        distance,
        ceiling: weightSum > 0 ? ceilingSum / weightSum : 6,
        secretId,
    };
}
