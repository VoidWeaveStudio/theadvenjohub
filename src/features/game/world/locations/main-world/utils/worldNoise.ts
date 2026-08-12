// src/features/game/world/locations/main-world/utils/worldNoise.ts

export function hashInt(x: number, z: number, seed: number): number {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 362437);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function valueNoise(x: number, z: number, seed: number): number {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;

    const ux = fx * fx * (3 - 2 * fx);
    const uz = fz * fz * (3 - 2 * fz);

    const a = hashInt(ix, iz, seed);
    const b = hashInt(ix + 1, iz, seed);
    const c = hashInt(ix, iz + 1, seed);
    const d = hashInt(ix + 1, iz + 1, seed);

    const top = a + (b - a) * ux;
    const bottom = c + (d - c) * ux;
    return top + (bottom - top) * uz;
}

export function fbm(x: number, z: number, octaves: number, seed: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let total = 0;

    for (let i = 0; i < octaves; i++) {
        value += amplitude * valueNoise(x * frequency, z * frequency, seed + i * 1013);
        total += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return value / total;
}

function hash3(x: number, y: number, z: number, seed: number): number {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ Math.imul(seed | 0, 362437);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function valueNoise3(x: number, y: number, z: number, seed: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);

    const fx = x - ix;
    const fy = y - iy;
    const fz = z - iz;

    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const uz = fz * fz * (3 - 2 * fz);

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const c000 = hash3(ix, iy, iz, seed);
    const c100 = hash3(ix + 1, iy, iz, seed);
    const c010 = hash3(ix, iy + 1, iz, seed);
    const c110 = hash3(ix + 1, iy + 1, iz, seed);
    const c001 = hash3(ix, iy, iz + 1, seed);
    const c101 = hash3(ix + 1, iy, iz + 1, seed);
    const c011 = hash3(ix, iy + 1, iz + 1, seed);
    const c111 = hash3(ix + 1, iy + 1, iz + 1, seed);

    const x00 = lerp(c000, c100, ux);
    const x10 = lerp(c010, c110, ux);
    const x01 = lerp(c001, c101, ux);
    const x11 = lerp(c011, c111, ux);

    return lerp(lerp(x00, x10, uy), lerp(x01, x11, uy), uz);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

export function createRandom(seed: number): () => number {
    let state = (seed >>> 0) || 1;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}
