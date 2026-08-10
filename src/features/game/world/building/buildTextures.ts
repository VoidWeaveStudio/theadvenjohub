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
    | "clay"
    | "thatch"
    | "glass"
    | "fabric"
    | "canvas"
    | "grass"
    | "asphalt"
    | "roadline"
    | "concrete"
    | "gravel"
    | "soil"
    | "bark"
    | "leaf"
    | "leafPine"
    | "leafAutumn"
    | "hedge"
    | "petalRose"
    | "petalGold"
    | "petalViolet"
    | "petalWhite"
    | "water"
    | "glow";

type Random = () => number;

interface NoiseFields {
    coarse: Float32Array;
}

interface SurfaceSpec {
    base: string;
    accent: string;
    shade: string;
    roughness: number;
    metalness: number;
    relief: number;
    uvScale: number;
    emissive?: number;
    emissiveIntensity?: number;
    paint: (ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) => void;
}

const SIZE = 512;
const NORMAL_BLUR_PASSES = 2;
const NORMAL_STRENGTH = 0.55;

const materialCache = new Map<SurfaceId, THREE.MeshStandardMaterial>();
const textureCache = new Map<string, THREE.Texture>();

function mulberry32(seed: number): Random {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function latticeValue(x: number, y: number, seed: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
}

function fade(t: number): number {
    return t * t * (3 - 2 * t);
}

function tileableNoise(size: number, cells: number, octaves: number, seed: number): Float32Array {
    const data = new Float32Array(size * size);
    let amplitude = 1;
    let total = 0;

    for (let octave = 0; octave < octaves; octave++) {
        const period = cells * (1 << octave);
        const scale = period / size;

        for (let y = 0; y < size; y++) {
            const fy = y * scale;
            const y0 = Math.floor(fy);
            const ty = fade(fy - y0);
            const ay = y0 % period;
            const by = (y0 + 1) % period;

            for (let x = 0; x < size; x++) {
                const fx = x * scale;
                const x0 = Math.floor(fx);
                const tx = fade(fx - x0);
                const ax = x0 % period;
                const bx = (x0 + 1) % period;

                const v00 = latticeValue(ax, ay, seed + octave);
                const v10 = latticeValue(bx, ay, seed + octave);
                const v01 = latticeValue(ax, by, seed + octave);
                const v11 = latticeValue(bx, by, seed + octave);

                const top = v00 + (v10 - v00) * tx;
                const bottom = v01 + (v11 - v01) * tx;
                data[y * size + x] += amplitude * (top + (bottom - top) * ty);
            }
        }

        total += amplitude;
        amplitude *= 0.5;
    }

    for (let i = 0; i < data.length; i++) data[i] /= total;
    return data;
}

function modulate(ctx: CanvasRenderingContext2D, size: number, field: Float32Array, strength: number) {
    const image = ctx.getImageData(0, 0, size, size);
    const data = image.data;

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const factor = 1 + (field[p] - 0.5) * strength;
        data[i] = Math.max(0, Math.min(255, data[i] * factor));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * factor));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * factor));
    }

    ctx.putImageData(image, 0, 0);
}

function wrapped(ctx: CanvasRenderingContext2D, size: number, draw: () => void) {
    for (const dx of [-size, 0, size]) {
        for (const dy of [-size, 0, size]) {
            if (dx !== 0 && dy !== 0) continue;
            ctx.save();
            ctx.translate(dx, dy);
            draw();
            ctx.restore();
        }
    }
}

function fill(ctx: CanvasRenderingContext2D, size: number, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
}

function paintPlanks(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.base);

    const rows = 5;
    const height = size / rows;

    for (let r = 0; r < rows; r++) {
        const y = r * height;
        const tone = rng();
        ctx.fillStyle = tone > 0.66 ? spec.accent : tone > 0.33 ? spec.base : spec.shade;
        ctx.fillRect(0, y, size, height);

        ctx.globalAlpha = 0.06;
        ctx.strokeStyle = spec.shade;
        for (let g = 0; g < 5; g++) {
            const gy = y + height * ((g + 0.3 + rng() * 0.4) / 5);
            ctx.lineWidth = 1.4 + rng() * 2.4;
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.bezierCurveTo(size * 0.3, gy + (rng() - 0.5) * 4, size * 0.7, gy + (rng() - 0.5) * 4, size, gy);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        ctx.globalAlpha = 0.5;
        ctx.fillStyle = spec.shade;
        ctx.fillRect(0, y + height - 2, size, 2);
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, y, size, 1.5);
        ctx.globalAlpha = 1;
    }

    modulate(ctx, size, noise.coarse, 0.1);
}

function paintParquet(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.shade);

    const block = size / 4;
    const strips = 4;

    for (let bx = 0; bx < 4; bx++) {
        for (let bz = 0; bz < 4; bz++) {
            const horizontal = (bx + bz) % 2 === 0;
            for (let s = 0; s < strips; s++) {
                const tone = rng();
                ctx.fillStyle = tone > 0.62 ? spec.accent : spec.base;
                if (horizontal) {
                    ctx.fillRect(bx * block + 1.5, bz * block + s * (block / strips) + 1.5, block - 3, block / strips - 3);
                } else {
                    ctx.fillRect(bx * block + s * (block / strips) + 1.5, bz * block + 1.5, block / strips - 3, block - 3);
                }
            }
        }
    }

    modulate(ctx, size, noise.coarse, 0.08);
}

function paintStone(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.shade);

    const rows = 4;
    const height = size / rows;

    for (let r = 0; r < rows; r++) {
        const columns = 3 + (r % 2);
        const width = size / columns;
        const offset = (r % 2) * (width / 2);

        for (let c = -1; c <= columns; c++) {
            const x = c * width + offset;
            const tone = rng();
            ctx.fillStyle = tone > 0.66 ? spec.accent : tone > 0.2 ? spec.base : spec.shade;
            ctx.beginPath();
            ctx.roundRect(x + 4, r * height + 4, width - 8, height - 8, 6);
            ctx.fill();

            ctx.globalAlpha = 0.14;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x + 7, r * height + 5.5, width - 14, 2);
            ctx.globalAlpha = 0.1;
            ctx.fillStyle = "#000000";
            ctx.fillRect(x + 7, r * height + height - 8, width - 14, 2.5);
            ctx.globalAlpha = 1;
        }
    }

    modulate(ctx, size, noise.coarse, 0.12);
}

function paintCobble(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.shade);

    const across = 6;
    const step = size / across;

    for (let row = 0; row < across; row++) {
        for (let col = 0; col < across; col++) {
            const cx = (col + 0.5) * step + (rng() - 0.5) * step * 0.2;
            const cy = (row + 0.5) * step + (rng() - 0.5) * step * 0.2;
            const rx = step * (0.42 + rng() * 0.1);
            const ry = step * (0.38 + rng() * 0.12);
            const angle = rng() * Math.PI;
            const tone = rng();

            wrapped(ctx, size, () => {
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx, ry, angle, 0, Math.PI * 2);
                ctx.fillStyle = tone > 0.62 ? spec.accent : tone > 0.2 ? spec.base : spec.shade;
                ctx.fill();
            });
        }
    }

    modulate(ctx, size, noise.coarse, 0.12);
}

function paintPlaster(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, _rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.base);
    modulate(ctx, size, noise.coarse, 0.05);
}

function paintBrick(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.shade);

    const rows = 7;
    const columns = 4;
    const height = size / rows;
    const width = size / columns;

    for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (width / 2);
        for (let c = -1; c <= columns; c++) {
            const x = c * width + offset;
            const tone = rng();
            ctx.fillStyle = tone > 0.76 ? spec.accent : tone < 0.18 ? spec.shade : spec.base;
            ctx.fillRect(x + 3, r * height + 3, width - 6, height - 6);

            ctx.globalAlpha = 0.1;
            ctx.fillStyle = "#000000";
            ctx.fillRect(x + 3, r * height + height - 7, width - 6, 3);
            ctx.globalAlpha = 1;
        }
    }

    modulate(ctx, size, noise.coarse, 0.08);
}

function paintMarble(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.base);

    ctx.lineCap = "round";
    for (let i = 0; i < 11; i++) {
        ctx.strokeStyle = i % 3 === 0 ? spec.accent : spec.shade;
        ctx.lineWidth = 1.2 + rng() * 3;
        ctx.globalAlpha = 0.1 + rng() * 0.1;

        const y = rng() * size;
        wrapped(ctx, size, () => {
            ctx.beginPath();
            ctx.moveTo(-10, y);
            ctx.bezierCurveTo(size * 0.3, y + (rng() - 0.5) * 60, size * 0.6, y + (rng() - 0.5) * 60, size + 10, y + (rng() - 0.5) * 24);
            ctx.stroke();
        });
    }
    ctx.globalAlpha = 1;

    modulate(ctx, size, noise.coarse, 0.04);
}

function paintMetal(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, _rng: Random, noise: NoiseFields) {
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, spec.accent);
    gradient.addColorStop(0.5, spec.base);
    gradient.addColorStop(1, spec.shade);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = spec.shade;
    ctx.lineWidth = 1;
    for (let y = 0; y < size; y += 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    modulate(ctx, size, noise.coarse, 0.04);
}

function paintShingle(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.shade);

    const rows = 5;
    const columns = 4;
    const height = size / rows;
    const width = size / columns;

    for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (width / 2);
        for (let c = -1; c <= columns; c++) {
            const x = c * width + offset;
            const y = r * height;

            ctx.beginPath();
            ctx.moveTo(x + 2, y);
            ctx.lineTo(x + width - 2, y);
            ctx.lineTo(x + width - 2, y + height * 0.74);
            ctx.quadraticCurveTo(x + width / 2, y + height * 1.0, x + 2, y + height * 0.74);
            ctx.closePath();
            ctx.fillStyle = rng() > 0.6 ? spec.accent : spec.base;
            ctx.fill();

            ctx.globalAlpha = 0.2;
            ctx.fillStyle = "#000000";
            ctx.fillRect(x + 2, y, width - 4, 3);
            ctx.globalAlpha = 1;
        }
    }

    modulate(ctx, size, noise.coarse, 0.1);
}

function paintClay(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.shade);

    const rows = 4;
    const columns = 5;
    const height = size / rows;
    const width = size / columns;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            const x = c * width;
            const y = r * height;
            const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
            const tone = rng() > 0.6 ? spec.accent : spec.base;
            gradient.addColorStop(0, spec.shade);
            gradient.addColorStop(0.3, tone);
            gradient.addColorStop(0.72, tone);
            gradient.addColorStop(1, spec.shade);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x + 1.5, y + 1.5, width - 3, height * 1.1, [0, 0, width * 0.4, width * 0.4]);
            ctx.fill();
        }
    }

    modulate(ctx, size, noise.coarse, 0.08);
}

function paintThatch(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.base);

    const rows = 4;
    const height = size / rows;

    for (let r = 0; r < rows; r++) {
        const y = r * height;
        ctx.globalAlpha = 0.16;
        for (let i = 0; i < 90; i++) {
            const x = rng() * size;
            ctx.strokeStyle = rng() > 0.5 ? spec.accent : spec.shade;
            ctx.lineWidth = 1.6 + rng() * 1.6;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (rng() - 0.5) * 7, y + height * 0.95);
            ctx.stroke();
        }
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = spec.shade;
        ctx.fillRect(0, y + height - 5, size, 5);
        ctx.globalAlpha = 1;
    }

    modulate(ctx, size, noise.coarse, 0.1);
}

function paintGlass(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) {
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, spec.accent);
    gradient.addColorStop(0.5, spec.base);
    gradient.addColorStop(1, spec.shade);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 30;
    for (let i = -1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * size * 0.6, 0);
        ctx.lineTo(i * size * 0.6 + size, size);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

function paintFabric(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, _rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.base);

    ctx.globalAlpha = 0.08;
    for (let i = 0; i < size; i += 6) {
        ctx.strokeStyle = (i / 6) % 2 === 0 ? spec.accent : spec.shade;
        ctx.lineWidth = 3;
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

    modulate(ctx, size, noise.coarse, 0.07);
}

function paintCanvasBoard(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, _rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.base);
    modulate(ctx, size, noise.coarse, 0.04);
}

function paintGrass(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.base);

    const patches = ctx.createLinearGradient(0, 0, size, size);
    patches.addColorStop(0, spec.shade);
    patches.addColorStop(0.5, spec.base);
    patches.addColorStop(1, spec.accent);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = patches;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.16;
    ctx.lineCap = "round";
    for (let i = 0; i < 700; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const tone = rng();
        ctx.strokeStyle = tone > 0.6 ? spec.accent : spec.shade;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rng() - 0.5) * 5, y - 5 - rng() * 6);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    modulate(ctx, size, noise.coarse, 0.12);
}

function paintAsphalt(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.base);

    for (let i = 0; i < 900; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const r = 1.6 + rng() * 3.4;
        ctx.globalAlpha = 0.05 + rng() * 0.07;
        ctx.fillStyle = rng() > 0.5 ? spec.accent : spec.shade;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    modulate(ctx, size, noise.coarse, 0.07);
}

function paintRoadLine(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, _rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.base);
    modulate(ctx, size, noise.coarse, 0.05);
}

function paintConcrete(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.base);

    for (let i = 0; i < 380; i++) {
        const x = rng() * size;
        const y = rng() * size;
        ctx.globalAlpha = 0.05 + rng() * 0.05;
        ctx.fillStyle = rng() > 0.5 ? spec.accent : spec.shade;
        ctx.beginPath();
        ctx.arc(x, y, 2 + rng() * 4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    modulate(ctx, size, noise.coarse, 0.06);
}

function paintGravel(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.shade);

    for (let i = 0; i < 620; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const r = 4 + rng() * 7;
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = rng() > 0.5 ? spec.base : spec.accent;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.7 + rng() * 0.4), rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    modulate(ctx, size, noise.coarse, 0.1);
}

function paintSoil(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.base);

    for (let i = 0; i < 520; i++) {
        const x = rng() * size;
        const y = rng() * size;
        ctx.globalAlpha = 0.12 + rng() * 0.16;
        ctx.fillStyle = rng() > 0.5 ? spec.accent : spec.shade;
        ctx.beginPath();
        ctx.ellipse(x, y, 4 + rng() * 7, 3 + rng() * 5, rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    modulate(ctx, size, noise.coarse, 0.12);
}

function paintBark(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.base);

    ctx.lineCap = "round";
    for (let i = 0; i < 46; i++) {
        const x = rng() * size;
        ctx.strokeStyle = rng() > 0.5 ? spec.shade : spec.accent;
        ctx.globalAlpha = 0.16 + rng() * 0.18;
        ctx.lineWidth = 4 + rng() * 9;
        ctx.beginPath();
        ctx.moveTo(x, -10);
        ctx.bezierCurveTo(x + (rng() - 0.5) * 20, size * 0.35, x + (rng() - 0.5) * 20, size * 0.7, x, size + 10);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    modulate(ctx, size, noise.coarse, 0.1);
}

function paintLeaf(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.base);

    for (let i = 0; i < 260; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const r = 12 + rng() * 22;
        ctx.globalAlpha = 0.18 + rng() * 0.22;
        ctx.fillStyle = rng() > 0.5 ? spec.accent : spec.shade;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.55, rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    modulate(ctx, size, noise.coarse, 0.14);
}

function paintPetals(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.base);

    for (let i = 0; i < 90; i++) {
        const x = rng() * size;
        const y = rng() * size;
        ctx.globalAlpha = 0.16 + rng() * 0.2;
        ctx.fillStyle = rng() > 0.45 ? spec.accent : spec.shade;
        ctx.beginPath();
        ctx.ellipse(x, y, 14 + rng() * 22, 8 + rng() * 14, rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    modulate(ctx, size, noise.coarse, 0.07);
}

function paintWater(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec, _rng: Random, noise: NoiseFields) {
    fill(ctx, size, spec.base);

    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = spec.accent;
    ctx.lineWidth = 4;
    for (let i = 0; i < 16; i++) {
        const y = (i / 16) * size;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(size * 0.25, y + 10, size * 0.75, y - 10, size, y);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    modulate(ctx, size, noise.coarse, 0.07);
}

function paintGlow(ctx: CanvasRenderingContext2D, size: number, spec: SurfaceSpec) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.7);
    gradient.addColorStop(0, spec.accent);
    gradient.addColorStop(0.55, spec.base);
    gradient.addColorStop(1, spec.shade);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
}

const SURFACES: Record<SurfaceId, SurfaceSpec> = {
    plank: { base: "#8a5a33", accent: "#96633c", shade: "#6a4527", roughness: 0.72, metalness: 0.02, relief: 0.3, uvScale: 0.5, paint: paintPlanks },
    parquet: { base: "#a9743f", accent: "#b9834e", shade: "#78502a", roughness: 0.45, metalness: 0.04, relief: 0.16, uvScale: 0.5, paint: paintParquet },
    stone: { base: "#8d8f92", accent: "#9a9da1", shade: "#6d7074", roughness: 0.88, metalness: 0.03, relief: 0.5, uvScale: 0.5, paint: paintStone },
    cobble: { base: "#7c7f84", accent: "#8a8d93", shade: "#5c5f64", roughness: 0.92, metalness: 0.02, relief: 0.55, uvScale: 0.6, paint: paintCobble },
    plaster: { base: "#ddd7ca", accent: "#e5e0d5", shade: "#cbc4b6", roughness: 0.88, metalness: 0.01, relief: 0.1, uvScale: 0.5, paint: paintPlaster },
    brick: { base: "#9c4a37", accent: "#a85541", shade: "#7a3e2e", roughness: 0.85, metalness: 0.02, relief: 0.45, uvScale: 0.6, paint: paintBrick },
    marble: { base: "#eae8e3", accent: "#d2cfc9", shade: "#b3b0a9", roughness: 0.2, metalness: 0.06, relief: 0.08, uvScale: 0.5, paint: paintMarble },
    metal: { base: "#7f8894", accent: "#949eaa", shade: "#5b636d", roughness: 0.35, metalness: 0.82, relief: 0.1, uvScale: 1, paint: paintMetal },
    shingle: { base: "#5d4a44", accent: "#68534c", shade: "#463734", roughness: 0.84, metalness: 0.03, relief: 0.4, uvScale: 0.6, paint: paintShingle },
    clay: { base: "#a0512f", accent: "#b25c38", shade: "#7b3d25", roughness: 0.76, metalness: 0.02, relief: 0.42, uvScale: 0.6, paint: paintClay },
    thatch: { base: "#b79154", accent: "#c39c60", shade: "#907043", roughness: 0.92, metalness: 0.0, relief: 0.34, uvScale: 0.6, paint: paintThatch },
    glass: { base: "#a9d8ef", accent: "#d3ebf9", shade: "#83b9d6", roughness: 0.05, metalness: 0.0, relief: 0, uvScale: 0.5, paint: paintGlass },
    fabric: { base: "#5a6d92", accent: "#67799c", shade: "#4b5a7c", roughness: 0.92, metalness: 0.0, relief: 0.18, uvScale: 1.2, paint: paintFabric },
    canvas: { base: "#efe6d2", accent: "#e2d8c2", shade: "#c2b69a", roughness: 0.82, metalness: 0.0, relief: 0.08, uvScale: 1, paint: paintCanvasBoard },
    grass: { base: "#4f7a3a", accent: "#5c8b42", shade: "#436a31", roughness: 0.95, metalness: 0.0, relief: 0.16, uvScale: 0.45, paint: paintGrass },
    asphalt: { base: "#3c3f44", accent: "#474b51", shade: "#32353a", roughness: 0.93, metalness: 0.02, relief: 0.18, uvScale: 0.35, paint: paintAsphalt },
    roadline: { base: "#e8dcc0", accent: "#f0e6cd", shade: "#cfc3a6", roughness: 0.82, metalness: 0.0, relief: 0.05, uvScale: 0.5, paint: paintRoadLine },
    concrete: { base: "#b3b1a9", accent: "#bcbab2", shade: "#a2a099", roughness: 0.9, metalness: 0.01, relief: 0.14, uvScale: 0.5, paint: paintConcrete },
    gravel: { base: "#9b9388", accent: "#a79f93", shade: "#7b746a", roughness: 0.95, metalness: 0.0, relief: 0.5, uvScale: 0.9, paint: paintGravel },
    soil: { base: "#5b4028", accent: "#674930", shade: "#4a341f", roughness: 0.96, metalness: 0.0, relief: 0.4, uvScale: 0.7, paint: paintSoil },
    bark: { base: "#584331", accent: "#634d3a", shade: "#453325", roughness: 0.93, metalness: 0.0, relief: 0.6, uvScale: 1.1, paint: paintBark },
    leaf: { base: "#3f6b2e", accent: "#4d8036", shade: "#345a26", roughness: 0.88, metalness: 0.0, relief: 0.28, uvScale: 0.7, paint: paintLeaf },
    leafPine: { base: "#2f5b34", accent: "#3a6f3f", shade: "#264a2b", roughness: 0.9, metalness: 0.0, relief: 0.28, uvScale: 0.8, paint: paintLeaf },
    leafAutumn: { base: "#b45a22", accent: "#cc7429", shade: "#8e421a", roughness: 0.88, metalness: 0.0, relief: 0.28, uvScale: 0.7, paint: paintLeaf },
    hedge: { base: "#33582a", accent: "#3d6832", shade: "#2a4a23", roughness: 0.93, metalness: 0.0, relief: 0.34, uvScale: 1.1, paint: paintLeaf },
    petalRose: { base: "#c8465f", accent: "#d75c73", shade: "#a53a50", roughness: 0.76, metalness: 0.0, relief: 0.12, uvScale: 1.3, paint: paintPetals },
    petalGold: { base: "#e0a52c", accent: "#eab644", shade: "#bd8a21", roughness: 0.76, metalness: 0.0, relief: 0.12, uvScale: 1.3, paint: paintPetals },
    petalViolet: { base: "#8f5cc4", accent: "#a071d1", shade: "#7748a8", roughness: 0.76, metalness: 0.0, relief: 0.12, uvScale: 1.3, paint: paintPetals },
    petalWhite: { base: "#eee9e2", accent: "#ffffff", shade: "#d3cbbf", roughness: 0.78, metalness: 0.0, relief: 0.12, uvScale: 1.3, paint: paintPetals },
    water: { base: "#2f6f8f", accent: "#4c99b6", shade: "#255c78", roughness: 0.1, metalness: 0.15, relief: 0.1, uvScale: 0.4, paint: paintWater },
    glow: { base: "#ffd9a0", accent: "#fff6e2", shade: "#f0b268", roughness: 0.4, metalness: 0.0, relief: 0, uvScale: 1, emissive: 0xffd9a0, emissiveIntensity: 2.4, paint: paintGlow },
};

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    return { canvas, ctx: canvas.getContext("2d", { willReadFrequently: true })! };
}

function blurHeight(height: Float32Array, size: number, passes: number) {
    const temp = new Float32Array(height.length);

    for (let pass = 0; pass < passes; pass++) {
        for (let y = 0; y < size; y++) {
            const row = y * size;
            for (let x = 0; x < size; x++) {
                const left = (x - 1 + size) % size;
                const right = (x + 1) % size;
                temp[row + x] = (height[row + left] + height[row + x] * 2 + height[row + right]) * 0.25;
            }
        }
        for (let y = 0; y < size; y++) {
            const up = ((y - 1 + size) % size) * size;
            const down = ((y + 1) % size) * size;
            const row = y * size;
            for (let x = 0; x < size; x++) {
                height[row + x] = (temp[up + x] + temp[row + x] * 2 + temp[down + x]) * 0.25;
            }
        }
    }
}

function buildNormalMap(source: CanvasRenderingContext2D, size: number, relief: number): HTMLCanvasElement {
    const { canvas, ctx } = makeCanvas(size);
    const pixels = source.getImageData(0, 0, size, size).data;

    const height = new Float32Array(size * size);
    for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
        height[p] = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) / 255;
    }

    blurHeight(height, size, NORMAL_BLUR_PASSES);

    const output = ctx.createImageData(size, size);
    const data = output.data;

    for (let y = 0; y < size; y++) {
        const up = ((y - 2 + size) % size) * size;
        const down = ((y + 2) % size) * size;
        const row = y * size;

        for (let x = 0; x < size; x++) {
            const left = (x - 2 + size) % size;
            const right = (x + 2) % size;

            const dx = (height[row + right] - height[row + left]) * relief * 3;
            const dy = (height[down + x] - height[up + x]) * relief * 3;

            const length = Math.sqrt(dx * dx + dy * dy + 1);
            const index = (row + x) * 4;
            data[index] = ((-dx / length) * 0.5 + 0.5) * 255;
            data[index + 1] = ((-dy / length) * 0.5 + 0.5) * 255;
            data[index + 2] = (1 / length) * 0.5 * 255 + 127.5;
            data[index + 3] = 255;
        }
    }

    ctx.putImageData(output, 0, 0);
    return canvas;
}

function configure(texture: THREE.Texture) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 16;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
}

function buildTextures(id: SurfaceId): { map: THREE.Texture; normalMap: THREE.Texture | null } {
    const cachedMap = textureCache.get(id);
    if (cachedMap) {
        return { map: cachedMap, normalMap: textureCache.get(`${id}:n`) ?? null };
    }

    const spec = SURFACES[id];
    const seed = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 17);
    const { canvas, ctx } = makeCanvas(SIZE);

    spec.paint(ctx, SIZE, spec, mulberry32(seed), {
        coarse: tileableNoise(SIZE, 4, 4, seed),
    });

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    configure(map);
    textureCache.set(id, map);

    if (spec.relief <= 0) return { map, normalMap: null };

    const normalMap = new THREE.CanvasTexture(buildNormalMap(ctx, SIZE, spec.relief));
    configure(normalMap);
    textureCache.set(`${id}:n`, normalMap);

    return { map, normalMap };
}

export function getSurfaceMaterial(id: SurfaceId): THREE.MeshStandardMaterial {
    const cached = materialCache.get(id);
    if (cached) return cached;

    const spec = SURFACES[id];
    const { map, normalMap } = buildTextures(id);

    const material = new THREE.MeshStandardMaterial({
        map,
        normalMap,
        roughness: spec.roughness,
        metalness: spec.metalness,
    });

    if (normalMap) {
        const scale = Math.min(0.85, NORMAL_STRENGTH + spec.relief * 0.3);
        material.normalScale.set(scale, scale);
    }

    if (spec.emissive !== undefined) {
        material.emissive = new THREE.Color(spec.emissive);
        material.emissiveMap = map;
        material.emissiveIntensity = spec.emissiveIntensity ?? 1;
    }

    if (id === "glass") {
        material.transparent = true;
        material.opacity = 0.34;
        material.side = THREE.DoubleSide;
        material.depthWrite = false;
    }

    if (id === "water") {
        material.transparent = true;
        material.opacity = 0.84;
    }

    materialCache.set(id, material);
    return material;
}

export function getSurfaceUvScale(id: SurfaceId): number {
    return SURFACES[id].uvScale;
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
