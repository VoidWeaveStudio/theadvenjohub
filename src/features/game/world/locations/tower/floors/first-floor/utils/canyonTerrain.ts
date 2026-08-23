// src/features/game/world/locations/tower/floors/first-floor/utils/canyonTerrain.ts
import { CANYON_HALF_WIDTH, CANYON_START_Z, halfWidthAt } from "./canyonMath";
import { fbm, ridged, smoothstep } from "./canyonNoise";

export const HUB_BACK_Z = -13;
export const HUB_MESH_START_Z = -34;

const TALUS_RUN = 10;
const TALUS_HEIGHT = 3.4;
export const WALL_OUTER_RUN = 64;

const CENTER_BLEND_NEAR = CANYON_START_Z - 45;
const CENTER_BLEND_FAR = CANYON_START_Z + 50;

const SEED_DUNES = 1301;
const SEED_EDGE = 4177;
const SEED_CREST = 7717;
const SEED_RUN = 9391;
const SEED_RIM = 2609;
const SEED_GULLY = 6151;

export function terrainCenterX(z: number): number {
    const rel = Math.max(0, z - CANYON_START_Z);
    const raw = Math.sin(rel * 0.008) * 22 + Math.sin(rel * 0.021 + 1.7) * 9;
    return raw * smoothstep(CENTER_BLEND_NEAR, CENTER_BLEND_FAR, z);
}

export function terrainHalfWidth(z: number): number {
    const rel = Math.max(0, z - CANYON_START_Z);
    const smoothed = Math.max(25, CANYON_HALF_WIDTH + Math.sin(rel * 0.006 + 0.5) * 15);
    return Math.max(halfWidthAt(z), smoothed);
}

export function wallFootDistance(z: number, side: number): number {
    const wobble = fbm(z * 0.019, side * 41.5, 3, SEED_EDGE);
    return terrainHalfWidth(z) * (1.03 + wobble * 0.24);
}

export function wallCrestHeight(z: number, side: number): number {
    const broad = fbm(z * 0.0042, side * 19.5, 3, SEED_CREST);
    const notch = ridged(z * 0.016, side * 6.5, 2, SEED_GULLY);
    return 34 + broad * 36 - notch * 9;
}

function cliffRun(z: number, side: number): number {
    return 12 + fbm(z * 0.027, side * 12.5, 2, SEED_RUN) * 15;
}

function hubBackRise(z: number): number {
    if (z > HUB_BACK_Z + 4) return 0;
    return Math.pow(smoothstep(HUB_BACK_Z + 4, HUB_BACK_Z - 21, z), 1.5) * 44;
}

function floorHeight(x: number, z: number, dist: number, foot: number): number {
    const wash = -0.85 * Math.exp(-Math.pow(dist / (foot * 0.3), 2));
    const dunes = (fbm(x * 0.011, z * 0.009, 3, SEED_DUNES) - 0.5) * 2.1;
    const ripple = Math.sin(z * 0.045 + x * 0.012) * 0.22;
    const apron = smoothstep(foot * 0.55, foot, dist) * 1.5;
    return wash + dunes + ripple + apron;
}

function cliffProfile(d: number, run: number, crest: number): number {
    const u = Math.min(1, d / run);
    const swept = 1 - Math.pow(1 - u, 2.2);

    const k = u * 3;
    const bench = Math.floor(k);
    const stepped = (bench + smoothstep(0.62, 0.97, k - bench)) / 3;

    return TALUS_HEIGHT + (crest - TALUS_HEIGHT) * (swept * 0.55 + stepped * 0.45);
}

export function canyonHeight(x: number, z: number): number {
    const back = hubBackRise(z);
    const centerX = terrainCenterX(z);
    const dx = x - centerX;
    const dist = Math.abs(dx);
    const side = dx < 0 ? -1 : 1;
    const foot = wallFootDistance(z, side);
    const d = dist - foot;
    const ground = floorHeight(x, z, dist, foot);

    if (d <= -TALUS_RUN) return ground + back;

    const pedestal = floorHeight(centerX + side * foot, z, foot, foot);

    if (d <= 0) {
        const t = smoothstep(-TALUS_RUN, 0, d);
        return ground + (pedestal + TALUS_HEIGHT - ground) * Math.pow(t, 1.7) + back;
    }

    const crest = wallCrestHeight(z, side);
    const run = cliffRun(z, side);
    let height = pedestal + cliffProfile(d, run, crest);

    if (d > run) {
        const rim = (fbm(x * 0.021, z * 0.019, 3, SEED_RIM) - 0.5) * 8;
        const climb = Math.min(d - run, 34) * 0.14;
        height += (rim + climb) * smoothstep(run, run + 9, d);
    }

    return height + back;
}

export function lowestAcross(z: number, samples: number = 9): number {
    const centerX = terrainCenterX(z);
    const halfWidth = terrainHalfWidth(z);
    let lowest = Infinity;

    for (let i = 0; i < samples; i++) {
        const t = (i / (samples - 1)) * 2 - 1;
        const height = canyonHeight(centerX + t * halfWidth, z);
        if (height < lowest) lowest = height;
    }

    return lowest;
}

export class CanyonTerrain {
    public getHeightAt(x: number, z: number): number {
        return canyonHeight(x, z);
    }
}
