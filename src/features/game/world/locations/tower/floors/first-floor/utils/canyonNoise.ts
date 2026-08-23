// src/features/game/world/locations/tower/floors/first-floor/utils/canyonNoise.ts

export function hash2(x: number, z: number, seed: number): number {
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

    const a = hash2(ix, iz, seed);
    const b = hash2(ix + 1, iz, seed);
    const c = hash2(ix, iz + 1, seed);
    const d = hash2(ix + 1, iz + 1, seed);

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

export function ridged(x: number, z: number, octaves: number, seed: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let total = 0;

    for (let i = 0; i < octaves; i++) {
        const n = 1 - Math.abs(valueNoise(x * frequency, z * frequency, seed + i * 977) * 2 - 1);
        value += amplitude * n * n;
        total += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return value / total;
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
