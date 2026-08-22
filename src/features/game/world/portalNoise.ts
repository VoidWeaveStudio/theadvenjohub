// src/features/game/world/portalNoise.ts
import * as THREE from "three";

// Every portal in the game used to compute value noise analytically in the
// fragment shader: a sin-based hash per lattice corner, four corners per 2D
// sample (eight per 3D sample), four octaves per fbm. The lift crystal alone
// worked out to roughly fifty sin() calls per pixel, and portals are additive
// layers with depthWrite off, so nothing rejects the fragments underneath.
//
// The same field baked once into a small tiling texture costs one fetch.

// Meshes carrying this name are the optional additive layers of a portal — the
// dome and the light beam. They are the widest, most overdrawn parts, and the
// first thing dropped when the quality preset asks for it.
export const PORTAL_EXTRA_LAYER = "portal-extra";

const SIZE = 128;
const OCTAVES = 4;

let texture: THREE.DataTexture | null = null;

function hash(x: number, y: number, wrap: number): number {
    // Wrapped lattice, so every octave tiles at the texture edge and the noise
    // can be sampled with RepeatWrapping without a visible seam.
    const xi = ((x % wrap) + wrap) % wrap;
    const yi = ((y % wrap) + wrap) % wrap;
    const n = Math.sin(xi * 127.1 + yi * 311.7) * 43758.5453;
    return n - Math.floor(n);
}

function smooth(t: number): number {
    return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, wrap: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);

    const n00 = hash(x0, y0, wrap);
    const n10 = hash(x0 + 1, y0, wrap);
    const n01 = hash(x0, y0 + 1, wrap);
    const n11 = hash(x0 + 1, y0 + 1, wrap);

    return (n00 * (1 - fx) + n10 * fx) * (1 - fy) + (n01 * (1 - fx) + n11 * fx) * fy;
}

function fbm(u: number, v: number, baseWrap: number): number {
    let sum = 0;
    let amp = 0.5;
    let wrap = baseWrap;

    for (let i = 0; i < OCTAVES; i++) {
        sum += valueNoise(u * wrap, v * wrap, wrap) * amp;
        wrap *= 2;
        amp *= 0.5;
    }

    return sum;
}

// One texture for the whole game: built on first use, never rebuilt, shared by
// every portal instance in every location.
export function getPortalNoiseTexture(): THREE.DataTexture {
    if (texture) return texture;

    const data = new Uint8Array(SIZE * SIZE * 4);

    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const u = x / SIZE;
            const v = y / SIZE;
            const at = (y * SIZE + x) * 4;

            // Three independent fields plus one flat octave. Shaders that used
            // two fbm calls now read two channels of the same fetch.
            data[at] = Math.round(Math.min(1, fbm(u, v, 4)) * 255);
            data[at + 1] = Math.round(Math.min(1, fbm(u + 0.37, v + 0.11, 6)) * 255);
            data[at + 2] = Math.round(Math.min(1, fbm(u + 0.71, v + 0.53, 3)) * 255);
            data[at + 3] = Math.round(valueNoise(u * 8, v * 8, 8) * 255);
        }
    }

    texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;

    return texture;
}

// Drop-in replacements for the old analytic helpers. Same names, same ranges,
// so the shader bodies below them did not have to be rewritten around them.
export const PORTAL_NOISE_GLSL = /* glsl */ `
uniform sampler2D uNoise;

float fbm(vec2 p) {
    return texture2D(uNoise, p * 0.15).r;
}

float fbm2(vec2 p) {
    return texture2D(uNoise, p * 0.15).g;
}

// The 3D variant the crystal needs: two slices of the same tiling field blended
// along the third axis. Two fetches instead of twenty-four sin() calls, and the
// result reads the same once it is animated.
float fbm3(vec3 p) {
    vec4 a = texture2D(uNoise, p.xy * 0.15);
    vec4 b = texture2D(uNoise, p.yz * 0.15 + 0.37);
    return mix(a.r, b.g, 0.5) * 0.75 + a.b * 0.25;
}
`;

export function disposePortalNoiseTexture() {
    texture?.dispose();
    texture = null;
}
