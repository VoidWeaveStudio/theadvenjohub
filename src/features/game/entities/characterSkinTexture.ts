// src/features/game/entities/characterSkinTexture.ts
import * as THREE from "three";
import { CosmeticId } from "../data/cosmetics";
import { BODY_REGIONS, RegionPalette } from "./characterRegions";

const TEXTURE_SIZE = 512;
const SEAM_PADDING = 3;
const SHADE_STEPS = 24;
const SHADE_LOW = 0.72;
const SHADE_HIGH = 1.12;

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
        const jitter = ((a * 7 + b * 13 + c * 29) % 5) * 0.25 - 0.5;
        const color = colorFor(region, shadeStepAt((height - minY) / span, jitter));

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

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
}

const textureCache = new Map<CosmeticId, THREE.CanvasTexture>();

export function getRegionSkinTexture(
    id: CosmeticId,
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
