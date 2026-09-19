// src/features/game/world/locations/showcase/rooms/war/warTextures.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";

function makeCanvas(size: number) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    return { canvas, ctx: canvas.getContext("2d") as CanvasRenderingContext2D };
}

function rgba(color: number, alpha: number): string {
    return `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;
}

function hex(color: number): string {
    return `#${color.toString(16).padStart(6, "0")}`;
}

function noise(ctx: CanvasRenderingContext2D, size: number, random: () => number, count: number, color: number, alpha: number, min: number, max: number) {
    for (let i = 0; i < count; i++) {
        ctx.fillStyle = rgba(color, alpha * (0.4 + random() * 0.6));
        const r = min + random() * (max - min);
        ctx.beginPath();
        ctx.arc(random() * size, random() * size, r, 0, Math.PI * 2);
        ctx.fill();
    }
}

function cracks(ctx: CanvasRenderingContext2D, size: number, random: () => number, count: number, color: number, alpha: number) {
    ctx.strokeStyle = rgba(color, alpha);
    for (let i = 0; i < count; i++) {
        ctx.lineWidth = 1 + random() * 3;
        ctx.beginPath();
        let x = random() * size;
        let y = random() * size;
        ctx.moveTo(x, y);
        for (let j = 0; j < 5; j++) {
            x += (random() - 0.5) * size * 0.35;
            y += (random() - 0.5) * size * 0.35;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

// Vertical staining (rust runs, water/soot damp) as soft gradient streaks dropping from
// a random top point — one flat noise pass reads as dirty paint, this reads as weathering.
function streaks(ctx: CanvasRenderingContext2D, size: number, random: () => number, count: number, color: number, alpha: number) {
    for (let i = 0; i < count; i++) {
        const x = random() * size;
        const top = random() * size * 0.6;
        const width = size * (0.015 + random() * 0.05);
        const gradient = ctx.createLinearGradient(0, top, 0, size);
        gradient.addColorStop(0, rgba(color, alpha * (0.5 + random() * 0.5)));
        gradient.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(x - width / 2, top);
        for (let y = top; y <= size; y += size / 14) {
            ctx.lineTo(x + Math.sin(y * 0.04 + i) * width * 0.4 - width / 2, y);
        }
        for (let y = size; y >= top; y -= size / 14) {
            ctx.lineTo(x + Math.sin(y * 0.04 + i) * width * 0.4 + width / 2, y);
        }
        ctx.closePath();
        ctx.fill();
    }
}

function finish(bin: AssetBin, canvas: HTMLCanvasElement, repeat: number, srgb = true): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.anisotropy = 4;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export function roadTexture(bin: AssetBin, random: () => number, repeat: number): THREE.CanvasTexture {
    const size = 512;
    const { canvas, ctx } = makeCanvas(size);

    ctx.fillStyle = hex(0x2f3034);
    ctx.fillRect(0, 0, size, size);

    noise(ctx, size, random, 180, 0x25262a, 0.55, 5, 30);
    noise(ctx, size, random, 120, 0x3a3c42, 0.35, 4, 18);
    cracks(ctx, size, random, 34, 0x17181b, 0.75);

    ctx.fillStyle = rgba(0xd8c86a, 0.75);
    for (let i = 0; i < 4; i++) {
        ctx.fillRect(size * 0.48, i * (size / 4) + 20, size * 0.04, size / 8);
    }

    return finish(bin, canvas, repeat);
}

export function concreteTexture(bin: AssetBin, random: () => number, repeat: number): THREE.CanvasTexture {
    const size = 512;
    const { canvas, ctx } = makeCanvas(size);

    ctx.fillStyle = hex(0x59544c);
    ctx.fillRect(0, 0, size, size);

    // Large soft patches read as different pours/repair sections before the fine grain
    // goes on top, so the wall doesn't look like one uniform slab.
    for (let i = 0; i < 8; i++) {
        ctx.fillStyle = rgba(random() < 0.5 ? 0x413d36 : 0x6b655a, 0.12 + random() * 0.1);
        const x = random() * size;
        const y = random() * size;
        ctx.beginPath();
        ctx.ellipse(x, y, size * (0.14 + random() * 0.16), size * (0.1 + random() * 0.14), random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    noise(ctx, size, random, 260, 0x4a453e, 0.4, 5, 34);
    noise(ctx, size, random, 200, 0x676156, 0.3, 4, 20);
    noise(ctx, size, random, 340, 0x35312b, 0.32, 1.5, 7);

    ctx.strokeStyle = rgba(0x3a352f, 0.7);
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (i * size) / 4);
        ctx.lineTo(size, (i * size) / 4);
        ctx.stroke();
    }

    cracks(ctx, size, random, 22, 0x2d2924, 0.55);
    streaks(ctx, size, random, 5, 0x1c1a16, 0.4);
    streaks(ctx, size, random, 4, 0x4a4e3a, 0.22);

    for (let i = 0; i < 34; i++) {
        ctx.fillStyle = rgba(0x1d1a16, 0.5);
        const x = random() * size;
        const y = random() * size;
        ctx.beginPath();
        ctx.ellipse(x, y, 3 + random() * 9, 3 + random() * 6, random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    return finish(bin, canvas, repeat);
}

export function rustTexture(bin: AssetBin, random: () => number, repeat: number): THREE.CanvasTexture {
    const size = 256;
    const { canvas, ctx } = makeCanvas(size);

    ctx.fillStyle = hex(0x4d4a46);
    ctx.fillRect(0, 0, size, size);

    noise(ctx, size, random, 90, 0x3a3733, 0.4, 10, 30);
    noise(ctx, size, random, 160, 0x7a4a26, 0.55, 3, 18);
    noise(ctx, size, random, 100, 0x2e2b27, 0.5, 3, 14);
    noise(ctx, size, random, 70, 0x96602c, 0.42, 2, 9);
    noise(ctx, size, random, 220, 0x5c3618, 0.3, 1, 4);
    streaks(ctx, size, random, 6, 0x6b3c1a, 0.5);
    streaks(ctx, size, random, 3, 0x241f1a, 0.35);

    return finish(bin, canvas, repeat);
}

export function sandbagTexture(bin: AssetBin, random: () => number, repeat: number): THREE.CanvasTexture {
    const size = 256;
    const { canvas, ctx } = makeCanvas(size);

    ctx.fillStyle = hex(0x6b6047);
    ctx.fillRect(0, 0, size, size);

    noise(ctx, size, random, 90, 0x4a4230, 0.3, 8, 20);
    noise(ctx, size, random, 170, 0x5a5039, 0.45, 3, 14);
    noise(ctx, size, random, 130, 0x7e7355, 0.4, 3, 10);
    noise(ctx, size, random, 260, 0x38321f, 0.28, 1, 4);

    // Burlap crosshatch weave instead of one parallel-line pass.
    ctx.strokeStyle = rgba(0x413a29, 0.45);
    ctx.lineWidth = 1.6;
    for (let i = -size; i < size * 2; i += 11) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + size, size);
        ctx.stroke();
    }
    ctx.strokeStyle = rgba(0x8a7d5c, 0.28);
    for (let i = -size; i < size * 2; i += 11) {
        ctx.beginPath();
        ctx.moveTo(i, size);
        ctx.lineTo(i + size, 0);
        ctx.stroke();
    }

    // A few bag seams sagging across the tile.
    ctx.strokeStyle = rgba(0x2e2818, 0.4);
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
        const y = size * (0.2 + i * 0.32) + (random() - 0.5) * 10;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(size * 0.5, y + 8 + random() * 6, size, y);
        ctx.stroke();
    }

    return finish(bin, canvas, repeat);
}

// A soft radial scorch mark — used as an alpha decal over the ground so a crater reads
// as burnt earth blending into the terrain, instead of a hard-edged disc with a bright
// rim sitting visibly on top of it.
export function scorchTexture(bin: AssetBin, random: () => number): THREE.CanvasTexture {
    const size = 256;
    const { canvas, ctx } = makeCanvas(size);
    const cx = size / 2;
    const cy = size / 2;

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.5);
    gradient.addColorStop(0, "rgba(8,6,5,0.92)");
    gradient.addColorStop(0.45, "rgba(18,14,11,0.75)");
    gradient.addColorStop(0.75, "rgba(30,24,18,0.35)");
    gradient.addColorStop(1, "rgba(40,32,24,0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(6,4,3,0.5)";
    for (let i = 0; i < 10; i++) {
        const angle = random() * Math.PI * 2;
        const inner = size * (0.1 + random() * 0.15);
        const outer = size * (0.28 + random() * 0.2);
        ctx.lineWidth = 2 + random() * 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
        ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
        ctx.stroke();
    }

    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

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

export interface SurfaceStop {
    at: number;
    color: number;
}

export interface SurfaceSpec {
    key: string;
    size?: number;
    repeat: number;
    seed: number;
    baseFreq: number;
    octaves: number;
    warp?: number;
    contrast?: number;
    grain?: number;
    normalStrength?: number;
    stops: SurfaceStop[];
}

function rampAt(stops: SurfaceStop[], t: number): [number, number, number] {
    let lower = stops[0];
    let upper = stops[stops.length - 1];

    for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i].at && t <= stops[i + 1].at) {
            lower = stops[i];
            upper = stops[i + 1];
            break;
        }
    }

    const span = Math.max(1e-5, upper.at - lower.at);
    const k = Math.min(1, Math.max(0, (t - lower.at) / span));

    const lr = (lower.color >> 16) & 255;
    const lg = (lower.color >> 8) & 255;
    const lb = lower.color & 255;
    const ur = (upper.color >> 16) & 255;
    const ug = (upper.color >> 8) & 255;
    const ub = upper.color & 255;

    return [lr + (ur - lr) * k, lg + (ug - lg) * k, lb + (ub - lb) * k];
}

// Surfaces built by splatting translucent circles read as blotches no matter how many
// passes go on top. This builds an actual height field instead — domain-warped fbm,
// which is what gives stone and dirt their broken-up structure — then colours it through
// a ramp and derives a matching normal map from the same field, so the relief and the
// shading agree and the material catches the firelight.
export function proceduralSurface(bin: AssetBin, spec: SurfaceSpec): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
    const size = spec.size ?? 512;
    const warp = spec.warp ?? 0.35;
    const contrast = spec.contrast ?? 1;
    const grain = spec.grain ?? 0.05;
    const strength = spec.normalStrength ?? 2.4;

    const height = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const u = x / size;
            const v = y / size;

            const wx = warp > 0 ? (tileableFbm(u, v, 2, 3, spec.seed + 811) - 0.5) * warp : 0;
            const wy = warp > 0 ? (tileableFbm(u, v, 2, 3, spec.seed + 977) - 0.5) * warp : 0;

            let h = tileableFbm(u + wx, v + wy, spec.baseFreq, spec.octaves, spec.seed);
            h = Math.min(1, Math.max(0, (h - 0.5) * contrast + 0.5));
            height[y * size + x] = h;
        }
    }

    const { canvas, ctx } = makeCanvas(size);
    const colour = ctx.createImageData(size, size);

    const normalCanvas = makeCanvas(size);
    const normal = normalCanvas.ctx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const index = y * size + x;
            const h = height[index];

            const jitter = (((x * 7 + y * 13) % 17) / 17 - 0.5) * grain;
            const [r, g, b] = rampAt(spec.stops, Math.min(1, Math.max(0, h + jitter)));

            const i = index * 4;
            colour.data[i] = r;
            colour.data[i + 1] = g;
            colour.data[i + 2] = b;
            colour.data[i + 3] = 255;

            const left = height[y * size + ((x - 1 + size) % size)];
            const right = height[y * size + ((x + 1) % size)];
            const up = height[((y - 1 + size) % size) * size + x];
            const down = height[((y + 1) % size) * size + x];

            const nx = (left - right) * strength;
            const ny = (up - down) * strength;
            const nz = 1;
            const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);

            normal.data[i] = (nx * inv * 0.5 + 0.5) * 255;
            normal.data[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
            normal.data[i + 2] = (nz * inv * 0.5 + 0.5) * 255;
            normal.data[i + 3] = 255;
        }
    }

    ctx.putImageData(colour, 0, 0);
    normalCanvas.ctx.putImageData(normal, 0, 0);

    return {
        map: finish(bin, canvas, spec.repeat),
        normalMap: finish(bin, normalCanvas.canvas, spec.repeat, false),
    };
}

// Seamless turbulence for the flame shader to scroll through. Two independent octave
// stacks in R and G so one sheet can drive both the slow body and the fast tips.
export function fireNoiseTexture(bin: AssetBin): THREE.CanvasTexture {
    const size = 256;
    const { canvas, ctx } = makeCanvas(size);
    const image = ctx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const u = x / size;
            const v = y / size;
            const i = (y * size + x) * 4;
            // Low base frequencies with more octaves: fine grain at this scale showed up
            // as boiling static rather than moving flame.
            image.data[i] = tileableFbm(u, v, 3, 5, 17) * 255;
            image.data[i + 1] = tileableFbm(u, v, 5, 4, 613) * 255;
            image.data[i + 2] = tileableFbm(u, v, 2, 5, 1289) * 255;
            image.data[i + 3] = 255;
        }
    }

    ctx.putImageData(image, 0, 0);

    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Overlapping tapering tongues instead of a round blob — a smooth radial gradient reads
// as a glowing disc, not fire; the tongue shape plus a hot-core-to-cool-tip gradient
// along each one reads as an actual flame silhouette.
export function flameTexture(bin: AssetBin): THREE.CanvasTexture {
    const size = 128;
    const { canvas, ctx } = makeCanvas(size);
    const cx = size / 2;

    const tongues: Array<[number, number, number, number]> = [
        [0, 0.66, 1, 0.02],
        [-0.15, 0.42, 0.72, -0.16],
        [0.17, 0.4, 0.78, 0.18],
    ];

    ctx.globalCompositeOperation = "lighter";
    for (const [ox, w, h, lean] of tongues) {
        const baseX = cx + ox * size * 0.5;
        const bottomY = size * 0.99;
        const topY = size * (1 - h);
        const width = size * w;
        const leanPx = lean * size;

        const gradient = ctx.createLinearGradient(baseX, bottomY, baseX, topY);
        gradient.addColorStop(0, "rgba(255,246,205,0.98)");
        gradient.addColorStop(0.32, "rgba(255,176,60,0.92)");
        gradient.addColorStop(0.68, "rgba(230,90,24,0.55)");
        gradient.addColorStop(1, "rgba(120,20,4,0)");
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.moveTo(baseX - width * 0.5, bottomY);
        ctx.bezierCurveTo(
            baseX - width * 0.5 + leanPx * 0.4, bottomY - (bottomY - topY) * 0.6,
            baseX + leanPx * 0.7, topY + (bottomY - topY) * 0.08,
            baseX + leanPx, topY
        );
        ctx.bezierCurveTo(
            baseX + leanPx * 0.7, topY + (bottomY - topY) * 0.08,
            baseX + width * 0.5 + leanPx * 0.4, bottomY - (bottomY - topY) * 0.6,
            baseX + width * 0.5, bottomY
        );
        ctx.closePath();
        ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

// A tight, spiky burst for muzzle flashes / shell flashes — the flame tongue texture
// above reads wrong for these (an instant pop, not a licking flame).
export function flashBurstTexture(bin: AssetBin): THREE.CanvasTexture {
    const size = 128;
    const { canvas, ctx } = makeCanvas(size);
    const cx = size / 2;
    const cy = size / 2;

    ctx.globalCompositeOperation = "lighter";

    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.5);
    core.addColorStop(0, "rgba(255,250,225,1)");
    core.addColorStop(0.3, "rgba(255,205,110,0.9)");
    core.addColorStop(0.6, "rgba(255,140,50,0.45)");
    core.addColorStop(1, "rgba(200,60,10,0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, size, size);

    const spikes = 7;
    ctx.fillStyle = "rgba(255,225,170,0.55)";
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const angle = (i / (spikes * 2)) * Math.PI * 2;
        const radius = i % 2 === 0 ? size * 0.48 : size * 0.16;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";

    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export function smokeTexture(bin: AssetBin, random: () => number): THREE.CanvasTexture {
    const size = 128;
    const { canvas, ctx } = makeCanvas(size);
    const cx = size / 2;
    const cy = size / 2;

    const gradient = ctx.createRadialGradient(cx, cy, 2, cx, cy, size * 0.5);
    gradient.addColorStop(0, "rgba(190,190,190,0.85)");
    gradient.addColorStop(0.5, "rgba(120,120,120,0.45)");
    gradient.addColorStop(1, "rgba(60,60,60,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // A perfectly smooth gradient reads as a flat glowing disc rather than a billowing
    // puff — a handful of overlapping soft blotches inside it break up the silhouette.
    ctx.globalCompositeOperation = "source-atop";
    for (let i = 0; i < 6; i++) {
        const angle = random() * Math.PI * 2;
        const dist = size * random() * 0.28;
        const bx = cx + Math.cos(angle) * dist;
        const by = cy + Math.sin(angle) * dist;
        const r = size * (0.18 + random() * 0.16);

        const blotch = ctx.createRadialGradient(bx, by, 0, bx, by, r);
        const tone = random() < 0.5 ? "60,60,60" : "205,205,205";
        blotch.addColorStop(0, `rgba(${tone},${0.18 + random() * 0.16})`);
        blotch.addColorStop(1, `rgba(${tone},0)`);
        ctx.fillStyle = blotch;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export function sparkTexture(bin: AssetBin): THREE.CanvasTexture {
    const size = 64;
    const { canvas, ctx } = makeCanvas(size);

    const gradient = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,235,1)");
    gradient.addColorStop(0.4, "rgba(255,180,90,0.7)");
    gradient.addColorStop(1, "rgba(255,120,40,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export interface MemecoinBanner {
    ticker: string;
    field: number;
    accent: number;
    emblem: "dog" | "frog" | "rocket" | "moon" | "hat" | "bull";
}

export const MEMECOIN_BANNERS: MemecoinBanner[] = [
    { ticker: "$DOGE", field: 0xc9a227, accent: 0x2b2418, emblem: "dog" },
    { ticker: "$PEPE", field: 0x3f9c4a, accent: 0x10240f, emblem: "frog" },
    { ticker: "$WIF", field: 0xe8a0c0, accent: 0x3a1228, emblem: "hat" },
    { ticker: "$BONK", field: 0xf2913d, accent: 0x2e1606, emblem: "dog" },
    { ticker: "$MOON", field: 0x4f7fd8, accent: 0x0d1730, emblem: "moon" },
    { ticker: "$PUMP", field: 0x2fbf6a, accent: 0x07231a, emblem: "rocket" },
    { ticker: "$BULL", field: 0xd94f4f, accent: 0x2b0b0b, emblem: "bull" },
];

function drawEmblem(ctx: CanvasRenderingContext2D, banner: MemecoinBanner, cx: number, cy: number, r: number) {
    ctx.fillStyle = hex(banner.accent);
    ctx.strokeStyle = hex(banner.accent);
    ctx.lineWidth = r * 0.18;

    switch (banner.emblem) {
        case "dog": {
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx - r * 0.62, cy - r * 0.34);
            ctx.lineTo(cx - r * 0.92, cy - r * 0.96);
            ctx.lineTo(cx - r * 0.2, cy - r * 0.66);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx + r * 0.62, cy - r * 0.34);
            ctx.lineTo(cx + r * 0.92, cy - r * 0.96);
            ctx.lineTo(cx + r * 0.2, cy - r * 0.66);
            ctx.closePath();
            ctx.fill();
            break;
        }
        case "frog": {
            ctx.beginPath();
            ctx.ellipse(cx, cy + r * 0.1, r * 0.74, r * 0.58, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx - r * 0.38, cy - r * 0.44, r * 0.26, 0, Math.PI * 2);
            ctx.arc(cx + r * 0.38, cy - r * 0.44, r * 0.26, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case "rocket": {
            ctx.beginPath();
            ctx.moveTo(cx, cy - r);
            ctx.lineTo(cx + r * 0.34, cy + r * 0.3);
            ctx.lineTo(cx, cy + r * 0.62);
            ctx.lineTo(cx - r * 0.34, cy + r * 0.3);
            ctx.closePath();
            ctx.fill();
            break;
        }
        case "moon": {
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = "destination-out";
            ctx.beginPath();
            ctx.arc(cx + r * 0.34, cy - r * 0.22, r * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = "source-over";
            break;
        }
        case "hat": {
            ctx.beginPath();
            ctx.arc(cx, cy + r * 0.12, r * 0.6, Math.PI, 0);
            ctx.fill();
            ctx.fillRect(cx - r * 0.86, cy + r * 0.12, r * 1.72, r * 0.22);
            break;
        }
        case "bull":
        default: {
            ctx.beginPath();
            ctx.moveTo(cx - r * 0.8, cy + r * 0.5);
            ctx.lineTo(cx, cy - r * 0.7);
            ctx.lineTo(cx + r * 0.8, cy + r * 0.5);
            ctx.closePath();
            ctx.fill();
            break;
        }
    }
}

export function bannerTexture(bin: AssetBin, banner: MemecoinBanner): THREE.CanvasTexture {
    const width = 256;
    const height = 160;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    ctx.fillStyle = hex(banner.field);
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = rgba(banner.accent, 0.18);
    ctx.fillRect(0, height * 0.72, width, height * 0.28);

    drawEmblem(ctx, banner, width * 0.34, height * 0.44, 44);

    ctx.fillStyle = hex(banner.accent);
    ctx.font = "bold 42px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(banner.ticker, width * 0.7, height * 0.44);

    ctx.strokeStyle = rgba(banner.accent, 0.55);
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, width - 8, height - 8);

    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}
