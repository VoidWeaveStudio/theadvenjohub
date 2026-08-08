// src/features/game/entities/characterSkinTexture.ts
import * as THREE from "three";
import { CosmeticId } from "../data/cosmetics";
import { BODY_REGIONS, RegionPalette } from "./characterRegions";

const TEXTURE_SIZE = 512;
const SEAM_PADDING = 3;

function bakeRegionSkinTexture(
    geometry: THREE.BufferGeometry,
    regionIndex: Uint8Array,
    palette: RegionPalette
): THREE.CanvasTexture | null {
    const uv = geometry.getAttribute("uv");
    const index = geometry.getIndex();
    if (!uv || !index) return null;

    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = `#${new THREE.Color(palette.torso).getHexString()}`;
    ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

    const regionColor = BODY_REGIONS.map(
        (region) => `#${new THREE.Color(palette[region]).getHexString()}`
    );

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

        const color = regionColor[region] ?? regionColor[0];
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
