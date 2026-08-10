// src/features/game/world/building/buildTextures.ts
import * as THREE from "three";

export type SurfaceId =
    | "plank"
    | "parquet"
    | "stone"
    | "cobble"
    | "plaster"
    | "brick"
    | "marble"
    | "metal"
    | "shingle"
    | "thatch"
    | "glass"
    | "fabric"
    | "canvas"
    | "grass";

interface SurfaceSpec {
    base: string;
    accent: string;
    shade: string;
    roughness: number;
    metalness: number;
    paint: (ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) => void;
}

const SIZE = 256;

const materialCache = new Map<string, THREE.MeshStandardMaterial>();
const textureCache = new Map<string, THREE.CanvasTexture>();

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    return { canvas, ctx: canvas.getContext("2d")! };
}

function noiseOverlay(ctx: CanvasRenderingContext2D, size: number, amount: number, alpha: number) {
    const image = ctx.getImageData(0, 0, size, size);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
        const n = (Math.random() - 0.5) * amount;
        data[i] = Math.max(0, Math.min(255, data[i] + n));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(image, 0, 0);
    if (alpha > 0) {
        ctx.fillStyle = `rgba(0,0,0,${alpha})`;
        ctx.fillRect(0, 0, size, size);
    }
}

function paintPlanks(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) {
    ctx.fillStyle = spec.base;
    ctx.fillRect(0, 0, size, size);

    const rows = 6;
    const height = size / rows;
    for (let r = 0; r < rows; r++) {
        const y = r * height;
        ctx.fillStyle = r % 2 === 0 ? spec.base : spec.accent;
        ctx.fillRect(0, y, size, height - 1);

        ctx.strokeStyle = spec.shade;
        ctx.lineWidth = 1.5;
        for (let g = 0; g < 14; g++) {
            const gy = y + Math.random() * height;
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.bezierCurveTo(size * 0.3, gy + (Math.random() - 0.5) * 4, size * 0.7, gy + (Math.random() - 0.5) * 4, size, gy);
            ctx.globalAlpha = 0.16;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        ctx.fillStyle = spec.shade;
        ctx.fillRect(0, y + height - 2, size, 2);
    }
    noiseOverlay(ctx, size, 14, 0);
}

function paintParquet(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) {
    ctx.fillStyle = spec.base;
    ctx.fillRect(0, 0, size, size);

    const block = size / 4;
    for (let bx = 0; bx < 4; bx++) {
        for (let bz = 0; bz < 4; bz++) {
            const horizontal = (bx + bz) % 2 === 0;
            for (let s = 0; s < 4; s++) {
                ctx.fillStyle = s % 2 === 0 ? spec.base : spec.accent;
                if (horizontal) {
                    ctx.fillRect(bx * block, bz * block + s * (block / 4), block - 1, block / 4 - 1);
                } else {
                    ctx.fillRect(bx * block + s * (block / 4), bz * block, block / 4 - 1, block - 1);
                }
            }
            ctx.strokeStyle = spec.shade;
            ctx.globalAlpha = 0.5;
            ctx.strokeRect(bx * block, bz * block, block, block);
            ctx.globalAlpha = 1;
        }
    }
    noiseOverlay(ctx, size, 10, 0);
}

function paintStone(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) {
    ctx.fillStyle = spec.shade;
    ctx.fillRect(0, 0, size, size);

    const rows = 5;
    const height = size / rows;
    for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (size / 8);
        let x = -offset;
        while (x < size) {
            const width = size / 4 + Math.random() * (size / 10);
            ctx.fillStyle = Math.random() > 0.5 ? spec.base : spec.accent;
            ctx.fillRect(x + 2, r * height + 2, width - 4, height - 4);
            x += width;
        }
    }
    noiseOverlay(ctx, size, 22, 0);
}

function paintCobble(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) {
    ctx.fillStyle = spec.shade;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 90; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = size * (0.035 + Math.random() * 0.035);
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.7 + Math.random() * 0.5), Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fillStyle = Math.random() > 0.5 ? spec.base : spec.accent;
        ctx.fill();
        ctx.strokeStyle = spec.shade;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    noiseOverlay(ctx, size, 18, 0);
}

function paintPlaster(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) {
    ctx.fillStyle = spec.base;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 200; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 2 + Math.random() * 10;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = Math.random() > 0.5 ? spec.accent : spec.shade;
        ctx.globalAlpha = 0.12;
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    noiseOverlay(ctx, size, 16, 0);
}

function paintBrick(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) {
    ctx.fillStyle = spec.shade;
    ctx.fillRect(0, 0, size, size);

    const rows = 8;
    const height = size / rows;
    for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (size / 8);
        for (let c = -1; c < 4; c++) {
            const x = c * (size / 4) + offset;
            ctx.fillStyle = Math.random() > 0.7 ? spec.accent : spec.base;
            ctx.fillRect(x + 2, r * height + 2, size / 4 - 4, height - 4);
        }
    }
    noiseOverlay(ctx, size, 18, 0);
}

function paintMarble(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) {
    ctx.fillStyle = spec.base;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = i % 3 === 0 ? spec.accent : spec.shade;
        ctx.lineWidth = 1 + Math.random() * 3;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        const y = Math.random() * size;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(size * 0.3, y + (Math.random() - 0.5) * 90, size * 0.6, y + (Math.random() - 0.5) * 90, size, y + (Math.random() - 0.5) * 50);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
    noiseOverlay(ctx, size, 8, 0);
}

function paintMetal(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) {
    ctx.fillStyle = spec.base;
    ctx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y += 2) {
        ctx.strokeStyle = y % 8 === 0 ? spec.shade : spec.accent;
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    ctx.fillStyle = spec.shade;
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            ctx.beginPath();
            ctx.arc(12 + i * (size / 4), 12 + j * (size / 4), 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    noiseOverlay(ctx, size, 10, 0);
}

function paintShingle(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) {
    ctx.fillStyle = spec.shade;
    ctx.fillRect(0, 0, size, size);

    const rows = 7;
    const height = size / rows;
    for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (size / 12);
        for (let c = -1; c < 7; c++) {
            const x = c * (size / 6) + offset;
            ctx.beginPath();
            ctx.moveTo(x, r * height);
            ctx.lineTo(x + size / 6, r * height);
            ctx.lineTo(x + size / 6, r * height + height * 0.7);
            ctx.quadraticCurveTo(x + size / 12, r * height + height * 1.05, x, r * height + height * 0.7);
            ctx.closePath();
            ctx.fillStyle = Math.random() > 0.6 ? spec.accent : spec.base;
            ctx.fill();
            ctx.strokeStyle = spec.shade;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }
    noiseOverlay(ctx, size, 16, 0);
}

function paintThatch(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) {
    ctx.fillStyle = spec.base;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 700; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const len = 8 + Math.random() * 22;
        ctx.strokeStyle = Math.random() > 0.5 ? spec.accent : spec.shade;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1 + Math.random();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 6, y + len);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
    noiseOverlay(ctx, size, 12, 0);
}

function paintGlass(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) {
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, spec.base);
    gradient.addColorStop(0.45, spec.accent);
    gradient.addColorStop(1, spec.shade);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 6;
    for (let i = -2; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 70, 0);
        ctx.lineTo(i * 70 + size, size);
        ctx.stroke();
    }
}

function paintFabric(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) {
    ctx.fillStyle = spec.base;
    ctx.fillRect(0, 0, size, size);

    ctx.globalAlpha = 0.2;
    for (let i = 0; i < size; i += 3) {
        ctx.strokeStyle = i % 6 === 0 ? spec.accent : spec.shade;
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    noiseOverlay(ctx, size, 12, 0);
}

function paintCanvasBoard(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) {
    ctx.fillStyle = spec.base;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = spec.shade;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, size - 10, size - 10);
    ctx.fillStyle = spec.accent;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(24, 24, size - 48, size - 48);
    ctx.globalAlpha = 1;
    noiseOverlay(ctx, size, 8, 0);
}

function paintGrass(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) {
    ctx.fillStyle = spec.base;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 60; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = size * (0.05 + Math.random() * 0.12);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = Math.random() > 0.5 ? spec.accent : spec.shade;
        ctx.globalAlpha = 0.18;
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    for (let i = 0; i < 900; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        ctx.strokeStyle = Math.random() > 0.5 ? spec.accent : spec.shade;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 4, y - 3 - Math.random() * 5);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
    noiseOverlay(ctx, size, 12, 0);
}

const SURFACES: Record<SurfaceId, SurfaceSpec> = {
    plank: { base: "#8a5a33", accent: "#9c6a3d", shade: "#5a3a20", roughness: 0.82, metalness: 0.02, paint: paintPlanks },
    parquet: { base: "#a9743f", accent: "#c08b52", shade: "#6b4523", roughness: 0.6, metalness: 0.04, paint: paintParquet },
    stone: { base: "#8d8f92", accent: "#a2a4a8", shade: "#5c5e62", roughness: 0.93, metalness: 0.03, paint: paintStone },
    cobble: { base: "#7c7f84", accent: "#93969b", shade: "#4d5054", roughness: 0.96, metalness: 0.02, paint: paintCobble },
    plaster: { base: "#d8d2c4", accent: "#e6e1d5", shade: "#b5aE9d", roughness: 0.9, metalness: 0.01, paint: paintPlaster },
    brick: { base: "#9c4a37", accent: "#b25a44", shade: "#6d3226", roughness: 0.9, metalness: 0.02, paint: paintBrick },
    marble: { base: "#e9e7e2", accent: "#c9c6bf", shade: "#9d9a93", roughness: 0.28, metalness: 0.06, paint: paintMarble },
    metal: { base: "#7f8894", accent: "#98a2ae", shade: "#4d545e", roughness: 0.38, metalness: 0.85, paint: paintMetal },
    shingle: { base: "#5d4a44", accent: "#6f5a52", shade: "#3a2d29", roughness: 0.88, metalness: 0.03, paint: paintShingle },
    thatch: { base: "#b79154", accent: "#cda868", shade: "#7d6035", roughness: 0.95, metalness: 0.0, paint: paintThatch },
    glass: { base: "#a9d8ef", accent: "#cfeaf8", shade: "#7fb6d4", roughness: 0.06, metalness: 0.0, paint: paintGlass },
    fabric: { base: "#5a6d92", accent: "#6f83aa", shade: "#3d4a66", roughness: 0.95, metalness: 0.0, paint: paintFabric },
    canvas: { base: "#efe6d2", accent: "#d9c9a6", shade: "#8d7a55", roughness: 0.85, metalness: 0.0, paint: paintCanvasBoard },
    grass: { base: "#4f7a3a", accent: "#639349", shade: "#3a5c2b", roughness: 0.98, metalness: 0.0, paint: paintGrass },
};

function getTexture(id: SurfaceId): THREE.CanvasTexture {
    const cached = textureCache.get(id);
    if (cached) return cached;

    const spec = SURFACES[id];
    const { canvas, ctx } = makeCanvas();
    spec.paint(ctx, SIZE, spec);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    textureCache.set(id, texture);
    return texture;
}

export function getSurfaceMaterial(id: SurfaceId): THREE.MeshStandardMaterial {
    const cached = materialCache.get(id);
    if (cached) return cached;

    const spec = SURFACES[id];
    const map = getTexture(id);

    const material = new THREE.MeshStandardMaterial({
        map,
        roughness: spec.roughness,
        metalness: spec.metalness,
    });

    if (id === "glass") {
        material.transparent = true;
        material.opacity = 0.36;
        material.side = THREE.DoubleSide;
        material.depthWrite = false;
    }

    materialCache.set(id, material);
    return material;
}

export function getSurfaceColor(id: SurfaceId): string {
    return SURFACES[id].base;
}

export function disposeBuildSurfaces() {
    materialCache.forEach((material) => material.dispose());
    materialCache.clear();
    textureCache.forEach((texture) => texture.dispose());
    textureCache.clear();
}
