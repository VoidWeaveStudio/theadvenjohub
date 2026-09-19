// src/features/game/world/locations/tower/floors/token-gates/galaxy/ThemedBubblePlanet.ts
import * as THREE from "three";
import type { ShowcaseId } from "../../../../showcase/config";

interface ColorStop {
    t: number;
    r: number;
    g: number;
    b: number;
}

export interface BubbleTheme {
    stops: ColorStop[];
    rimColor: number;
}

const NOISE_TEXTURE_SIZE = 128;
const SURFACE_TEXTURE_SIZE = 256;
const UV_SCALE = new THREE.Vector2(3, 1.5);
const TIME_SCALE = 0.35;

let sharedNoiseTexture: THREE.Texture | null = null;
const surfaceTextureCache = new Map<string, THREE.Texture>();

function hash2(ix: number, iy: number, seed: number): number {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function tileableNoise(x: number, y: number, freq: number, seed: number): number {
    const fx = x * freq;
    const fy = y * freq;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);

    const x0 = ((ix % freq) + freq) % freq;
    const y0 = ((iy % freq) + freq) % freq;
    const x1 = (x0 + 1) % freq;
    const y1 = (y0 + 1) % freq;

    const v00 = hash2(x0, y0, seed);
    const v10 = hash2(x1, y0, seed);
    const v01 = hash2(x0, y1, seed);
    const v11 = hash2(x1, y1, seed);

    return (v00 * (1 - sx) + v10 * sx) * (1 - sy) + (v01 * (1 - sx) + v11 * sx) * sy;
}

function tileableFbm(x: number, y: number, baseFreq: number, octaves: number, seed: number): number {
    let sum = 0;
    let amplitude = 1;
    let total = 0;
    let freq = baseFreq;

    for (let o = 0; o < octaves; o++) {
        sum += tileableNoise(x, y, freq, seed + o * 97) * amplitude;
        total += amplitude;
        amplitude *= 0.5;
        freq *= 2;
    }

    return sum / total;
}

function getNoiseTexture(): THREE.Texture {
    if (sharedNoiseTexture) return sharedNoiseTexture;

    const size = NOISE_TEXTURE_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const u = x / size;
            const v = y / size;
            const i = (y * size + x) * 4;
            image.data[i] = tileableFbm(u, v, 4, 4, 11) * 255;
            image.data[i + 1] = tileableFbm(u, v, 4, 4, 733) * 255;
            image.data[i + 2] = tileableFbm(u, v, 4, 4, 1571) * 255;
            image.data[i + 3] = tileableFbm(u, v, 3, 4, 2999) * 255;
        }
    }
    ctx.putImageData(image, 0, 0);

    sharedNoiseTexture = new THREE.CanvasTexture(canvas);
    sharedNoiseTexture.wrapS = THREE.RepeatWrapping;
    sharedNoiseTexture.wrapT = THREE.RepeatWrapping;
    return sharedNoiseTexture;
}

function getSurfaceTexture(themeKey: string, theme: BubbleTheme): THREE.Texture {
    const cached = surfaceTextureCache.get(themeKey);
    if (cached) return cached;

    const size = SURFACE_TEXTURE_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(size, size);
    const stops = theme.stops;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const u = x / size;
            const v = y / size;

            const base = tileableFbm(u, v, 4, 5, 401);
            const veins = 1 - Math.abs(tileableFbm(u, v, 8, 4, 907) * 2 - 1);
            const heat = Math.min(1, Math.pow(base, 1.5) * 0.75 + Math.pow(veins, 4) * 0.9);

            let lower = stops[0];
            let upper = stops[stops.length - 1];
            for (let s = 0; s < stops.length - 1; s++) {
                if (heat >= stops[s].t && heat <= stops[s + 1].t) {
                    lower = stops[s];
                    upper = stops[s + 1];
                    break;
                }
            }
            const span = Math.max(1e-5, upper.t - lower.t);
            const k = Math.min(1, Math.max(0, (heat - lower.t) / span));

            const i = (y * size + x) * 4;
            image.data[i] = lower.r + (upper.r - lower.r) * k;
            image.data[i + 1] = lower.g + (upper.g - lower.g) * k;
            image.data[i + 2] = lower.b + (upper.b - lower.b) * k;
            image.data[i + 3] = 255;
        }
    }
    ctx.putImageData(image, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    surfaceTextureCache.set(themeKey, texture);
    return texture;
}

const planetVertex = /* glsl */ `
uniform vec2 uvScale;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
    vUv = uvScale * uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const planetFragment = /* glsl */ `
uniform float time;
uniform vec3 rimColor;
uniform sampler2D texture1;
uniform sampler2D texture2;
varying vec2 vUv;
varying vec3 vNormalView;
varying vec3 vViewDir;

void main( void ) {
    vec4 noise = texture2D( texture1, vUv );
    vec2 T1 = vUv + vec2( 1.5, - 1.5 ) * time * 0.02;
    vec2 T2 = vUv + vec2( - 0.5, 2.0 ) * time * 0.01;

    T1.x += noise.x * 2.0;
    T1.y += noise.y * 2.0;
    T2.x -= noise.y * 0.2;
    T2.y += noise.z * 0.2;

    float p = texture2D( texture1, T1 * 2.0 ).a;

    vec4 color = texture2D( texture2, T2 * 2.0 );
    vec4 temp = color * ( vec4( p, p, p, p ) * 2.0 ) + ( color * color - 0.1 );

    if( temp.r > 1.0 ) { temp.bg += clamp( temp.r - 2.0, 0.0, 100.0 ); }
    if( temp.g > 1.0 ) { temp.rb += temp.g - 1.0; }
    if( temp.b > 1.0 ) { temp.rg += temp.b - 1.0; }

    gl_FragColor = temp;

    float facing = clamp( dot( normalize( vNormalView ), normalize( vViewDir ) ), 0.0, 1.0 );
    float fresnel = pow( 1.0 - facing, 2.6 );
    gl_FragColor.rgb += rimColor * fresnel * 1.5;
    gl_FragColor.a = 1.0;
}
`;

export function createThemedPlanet(themeKey: string, theme: BubbleTheme, radius: number, segments = 40): THREE.Mesh {
    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            uvScale: { value: UV_SCALE.clone() },
            rimColor: { value: new THREE.Color(theme.rimColor) },
            texture1: { value: getNoiseTexture() },
            texture2: { value: getSurfaceTexture(themeKey, theme) },
        },
        vertexShader: planetVertex,
        fragmentShader: planetFragment,
        fog: false,
    });

    return new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.round(segments * 0.7)), material);
}

export function updateThemedPlanet(mesh: THREE.Mesh, delta: number) {
    const material = mesh.material as THREE.ShaderMaterial;
    material.uniforms.time.value += delta * TIME_SCALE;
}

// One entry per showcase set that already has its faction bubble moved in —
// see themedFactions.ts. Undefined themes fall back to the generic hashed-color
// planet, so this fills in one location at a time as each one graduates.
export const BUBBLE_THEMES: Partial<Record<ShowcaseId, BubbleTheme>> = {
    "show-war": {
        stops: [
            { t: 0.0, r: 10, g: 4, b: 4 },
            { t: 0.32, r: 54, g: 8, b: 8 },
            { t: 0.55, r: 122, g: 16, b: 12 },
            { t: 0.78, r: 206, g: 46, b: 16 },
            { t: 1.0, r: 255, g: 138, b: 46 },
        ],
        rimColor: 0xff2a16,
    },
};
