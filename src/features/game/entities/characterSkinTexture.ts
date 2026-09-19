// src/features/game/entities/characterSkinTexture.ts
import * as THREE from "three";
import { BODY_REGIONS, RegionPalette } from "./characterRegions";

const TEXTURE_SIZE = 512;
const SEAM_PADDING = 3;
const SHADE_STEPS = 24;
const SHADE_LOW = 0.72;
const SHADE_HIGH = 1.12;

// A flat color per body region reads as clothing only where two regions happen to land
// on different colors — otherwise it's an arbitrary blotch (e.g. a torso and legs that
// happen to share a palette color look like a single unbroken void). These bands paint a
// thin, sharply darkened "seam" — collar and hem on the torso, a cuff on the legs — using
// the same height-normalized value already computed for shading, so a jacket/shirt and
// pants silhouette reads even when neighboring regions are close in color. Vertical
// position doesn't separate "shoulder" from "hand" on a T-pose arm (the arm runs mostly
// along X, not Y, in the bind pose this bakes from), so sleeves are left untrimmed.
const TORSO_COLLAR_BAND: [number, number] = [0.8, 0.845];
const TORSO_HEM_BAND: [number, number] = [0.455, 0.5];
const LEGS_CUFF_BAND: [number, number] = [0.06, 0.1];
const TRIM_DARKEN = 0.4;

function inBand(value: number, band: [number, number]): boolean {
    return value >= band[0] && value <= band[1];
}

function shadeStepAt(height01: number, jitter: number): number {
    const shaded = height01 * (SHADE_STEPS - 1) + jitter;
    return Math.max(0, Math.min(SHADE_STEPS - 1, Math.round(shaded)));
}

function bakeRegionSkinTexture(
    geometry: THREE.BufferGeometry,
    regionIndex: Uint8Array,
    palette: RegionPalette
): THREE.CanvasTexture | null {
    const uv = geometry.getAttribute("uv");
    const index = geometry.getIndex();
    const position = geometry.getAttribute("position");
    if (!uv || !index || !position) return null;

    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext("2d")!;

    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < position.count; i++) {
        const y = position.getY(i);
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    const span = maxY - minY || 1;

    const baseColor = BODY_REGIONS.map((region) => new THREE.Color(palette[region]));
    const shaded = new THREE.Color();
    const swatch: string[] = new Array(BODY_REGIONS.length * SHADE_STEPS);

    const colorFor = (region: number, step: number): string => {
        const slot = region * SHADE_STEPS + step;
        const cached = swatch[slot];
        if (cached) return cached;

        const factor = SHADE_LOW + (SHADE_HIGH - SHADE_LOW) * (step / (SHADE_STEPS - 1));
        shaded.copy(baseColor[region] ?? baseColor[0]).multiplyScalar(factor);
        const hex = `#${shaded.getHexString()}`;
        swatch[slot] = hex;
        return hex;
    };

    const trimSwatch: string[] = new Array(BODY_REGIONS.length);
    const trimColorFor = (region: number): string => {
        const cached = trimSwatch[region];
        if (cached) return cached;

        shaded.copy(baseColor[region] ?? baseColor[0]).multiplyScalar(1 - TRIM_DARKEN);
        const hex = `#${shaded.getHexString()}`;
        trimSwatch[region] = hex;
        return hex;
    };

    const torsoRegion = BODY_REGIONS.indexOf("torso");
    const legsRegion = BODY_REGIONS.indexOf("legs");

    ctx.fillStyle = colorFor(BODY_REGIONS.indexOf("torso"), Math.floor(SHADE_STEPS * 0.6));
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = SEAM_PADDING;

    for (let t = 0; t < index.count; t += 3) {
        const a = index.getX(t);
        const b = index.getX(t + 1);
        const c = index.getX(t + 2);

        const ra = regionIndex[a];
        const rb = regionIndex[b];
        const rc = regionIndex[c];
        const region = rb === rc ? rb : ra;

        const height = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
        const heightFraction = (height - minY) / span;
        const jitter = ((a * 7 + b * 13 + c * 29) % 5) * 0.25 - 0.5;

        const isTrim =
            (region === torsoRegion && (inBand(heightFraction, TORSO_COLLAR_BAND) || inBand(heightFraction, TORSO_HEM_BAND))) ||
            (region === legsRegion && inBand(heightFraction, LEGS_CUFF_BAND));
        const color = isTrim ? trimColorFor(region) : colorFor(region, shadeStepAt(heightFraction, jitter));

        ctx.fillStyle = color;
        ctx.strokeStyle = color;

        ctx.beginPath();
        ctx.moveTo(uv.getX(a) * TEXTURE_SIZE, uv.getY(a) * TEXTURE_SIZE);
        ctx.lineTo(uv.getX(b) * TEXTURE_SIZE, uv.getY(b) * TEXTURE_SIZE);
        ctx.lineTo(uv.getX(c) * TEXTURE_SIZE, uv.getY(c) * TEXTURE_SIZE);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
    }

    // A flat fill per region reads as painted plastic — a fine deterministic weave/grain
    // pass on top gives it a fabric feel without touching the region color logic above.
    // Deterministic (hashed from pixel position, no RNG) so the bake stays pure.
    ctx.globalCompositeOperation = "source-atop";
    for (let y = 0; y < TEXTURE_SIZE; y += 2) {
        for (let x = 0; x < TEXTURE_SIZE; x += 2) {
            const h = (x * 13 + y * 37 + (x >> 2) * 7) % 23;
            if (h < 15) continue;
            const light = h % 2 === 0;
            ctx.fillStyle = light ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
            ctx.fillRect(x, y, 2, 2);
        }
    }
    ctx.globalCompositeOperation = "source-over";

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
}

const textureCache = new Map<string, THREE.CanvasTexture>();

export function getRegionSkinTexture(
    id: string,
    geometry: THREE.BufferGeometry,
    regionIndex: Uint8Array,
    palette: RegionPalette
): THREE.CanvasTexture | null {
    const cached = textureCache.get(id);
    if (cached) return cached;

    const texture = bakeRegionSkinTexture(geometry, regionIndex, palette);
    if (texture) textureCache.set(id, texture);
    return texture;
}

export function disposeSkinTextures() {
    textureCache.forEach((texture) => texture.dispose());
    textureCache.clear();
}
