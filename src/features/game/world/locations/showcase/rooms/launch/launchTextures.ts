// src/features/game/world/locations/showcase/rooms/launch/launchTextures.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";

type Ctx = CanvasRenderingContext2D;

const LAUNCH_ROOT = "/models/textures/launch";
const GARDEN_ROOT = "/models/textures/garden";

export interface LaunchSurfaceSet {
    map: THREE.Texture;
    normal: THREE.Texture;
}

export interface LaunchSurfaceTextures {
    concrete: LaunchSurfaceSet;
    asphalt: LaunchSurfaceSet;
    grass: LaunchSurfaceSet;
}

function canvasOf(width: number, height: number, draw: (ctx: Ctx, width: number, height: number) => void): HTMLCanvasElement {
    const element = document.createElement("canvas");
    element.width = width;
    element.height = height;
    draw(element.getContext("2d") as Ctx, width, height);
    return element;
}

function configure(texture: THREE.Texture, srgb: boolean, anisotropy: number): THREE.Texture {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = anisotropy;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export function loadLaunchSurfaces(anisotropy: number): LaunchSurfaceTextures {
    const loader = new THREE.TextureLoader();
    const set = (root: string, name: string): LaunchSurfaceSet => ({
        map: configure(loader.load(`${root}/${name}_diff_1k.webp`), true, anisotropy),
        normal: configure(loader.load(`${root}/${name}_nor_1k.webp`), false, anisotropy),
    });

    return {
        concrete: set(LAUNCH_ROOT, "concrete"),
        asphalt: set(LAUNCH_ROOT, "asphalt"),
        grass: set(GARDEN_ROOT, "leafy_grass"),
    };
}

export function disposeLaunchSurfaces(textures: LaunchSurfaceTextures) {
    for (const key of ["concrete", "asphalt", "grass"] as const) {
        textures[key].map.dispose();
        textures[key].normal.dispose();
    }
}

export function nightSkyTexture(bin: AssetBin, random: () => number): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(512, 512, (ctx, width, height) => {
        const sky = ctx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, "#04060f");
        sky.addColorStop(0.42, "#0a1428");
        sky.addColorStop(0.72, "#16304d");
        sky.addColorStop(0.9, "#2a4c66");
        sky.addColorStop(1, "#3d5d72");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);

        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 220; i++) {
            const y = height * Math.pow(random(), 1.6) * 0.86;
            const x = random() * width;
            const size = 0.6 + random() * 1.5;
            ctx.fillStyle = `rgba(210, 226, 255, ${0.18 + random() * 0.5})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        for (let i = 0; i < 26; i++) {
            const x = random() * width;
            const y = height * (0.32 + random() * 0.5);
            const w = 90 + random() * 220;
            const h = 12 + random() * 26;
            const cloud = ctx.createRadialGradient(x, y, 0, x, y, w / 2);
            const tone = 0.05 + random() * 0.08;
            cloud.addColorStop(0, `rgba(150, 178, 210, ${tone})`);
            cloud.addColorStop(1, "rgba(150, 178, 210, 0)");
            ctx.fillStyle = cloud;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(1, h / (w / 2));
            ctx.beginPath();
            ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.globalCompositeOperation = "source-over";
    })));

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
}

export function moonDiscTexture(bin: AssetBin, random: () => number): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(512, 512, (ctx, size) => {
        ctx.clearRect(0, 0, size, size);
        const half = size / 2;
        const radius = half * 0.86;

        ctx.save();
        ctx.beginPath();
        ctx.arc(half, half, radius, 0, Math.PI * 2);
        ctx.clip();

        ctx.fillStyle = "#e9e6dd";
        ctx.fillRect(0, 0, size, size);

        for (let i = 0; i < 9; i++) {
            const x = half + (random() - 0.5) * radius * 1.1;
            const y = half + (random() - 0.5) * radius * 1.1;
            const r = radius * (0.12 + random() * 0.24);
            const mare = ctx.createRadialGradient(x, y, 0, x, y, r);
            mare.addColorStop(0, "rgba(150, 152, 156, 0.72)");
            mare.addColorStop(0.7, "rgba(170, 170, 172, 0.38)");
            mare.addColorStop(1, "rgba(180, 180, 182, 0)");
            ctx.fillStyle = mare;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        for (let i = 0; i < 90; i++) {
            const x = half + (random() - 0.5) * radius * 1.8;
            const y = half + (random() - 0.5) * radius * 1.8;
            const r = radius * (0.01 + random() * 0.05);
            ctx.strokeStyle = `rgba(120, 120, 124, ${0.1 + random() * 0.3})`;
            ctx.lineWidth = Math.max(1, r * 0.4);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = `rgba(245, 243, 236, ${0.06 + random() * 0.16})`;
            ctx.beginPath();
            ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.7, 0, Math.PI * 2);
            ctx.fill();
        }

        const limb = ctx.createRadialGradient(half, half, radius * 0.6, half, half, radius);
        limb.addColorStop(0, "rgba(0, 0, 0, 0)");
        limb.addColorStop(1, "rgba(26, 28, 34, 0.5)");
        ctx.fillStyle = limb;
        ctx.fillRect(0, 0, size, size);
        ctx.restore();

        const halo = ctx.createRadialGradient(half, half, radius * 0.94, half, half, half);
        halo.addColorStop(0, "rgba(226, 236, 255, 0.5)");
        halo.addColorStop(0.5, "rgba(190, 212, 255, 0.12)");
        halo.addColorStop(1, "rgba(160, 190, 255, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, size, size);
    })));

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

export function glowSprite(bin: AssetBin, color: number): THREE.CanvasTexture {
    const red = (color >> 16) & 255;
    const green = (color >> 8) & 255;
    const blue = color & 255;

    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(128, 128, (ctx, size) => {
        const half = size / 2;
        const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
        gradient.addColorStop(0, `rgba(${red}, ${green}, ${blue}, 0.95)`);
        gradient.addColorStop(0.22, `rgba(${red}, ${green}, ${blue}, 0.34)`);
        gradient.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
    })));

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

export function steamSprite(bin: AssetBin, random: () => number): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(128, 128, (ctx, size) => {
        const half = size / 2;
        for (let i = 0; i < 26; i++) {
            const x = half + (random() - 0.5) * size * 0.5;
            const y = half + (random() - 0.5) * size * 0.5;
            const r = size * (0.08 + random() * 0.22);
            const puff = ctx.createRadialGradient(x, y, 0, x, y, r);
            puff.addColorStop(0, `rgba(255, 255, 255, ${0.12 + random() * 0.16})`);
            puff.addColorStop(1, "rgba(255, 255, 255, 0)");
            ctx.fillStyle = puff;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        const fade = ctx.createRadialGradient(half, half, 0, half, half, half);
        fade.addColorStop(0, "rgba(255, 255, 255, 0.5)");
        fade.addColorStop(0.55, "rgba(255, 255, 255, 0.14)");
        fade.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.globalCompositeOperation = "destination-in";
        ctx.fillStyle = fade;
        ctx.fillRect(0, 0, size, size);
        ctx.globalCompositeOperation = "source-over";
    })));

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
}

export function plumeNoiseTexture(bin: AssetBin, random: () => number): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvasOf(256, 256, (ctx, size) => {
        const image = ctx.createImageData(size, size);
        const field = new Float32Array(size * size);

        for (let octave = 0; octave < 4; octave++) {
            const cells = 4 << octave;
            const step = size / cells;
            const grid = new Float32Array((cells + 1) * (cells + 1));
            for (let i = 0; i < grid.length; i++) grid[i] = random();

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const gx = x / step;
                    const gy = y / step;
                    const x0 = Math.floor(gx);
                    const y0 = Math.floor(gy);
                    const fx = gx - x0;
                    const fy = gy - y0;
                    const sx = fx * fx * (3 - 2 * fx);
                    const sy = fy * fy * (3 - 2 * fy);

                    const a = grid[y0 * (cells + 1) + x0];
                    const b = grid[y0 * (cells + 1) + x0 + 1];
                    const c = grid[(y0 + 1) * (cells + 1) + x0];
                    const d = grid[(y0 + 1) * (cells + 1) + x0 + 1];

                    const top = a + (b - a) * sx;
                    const bottom = c + (d - c) * sx;
                    field[y * size + x] += (top + (bottom - top) * sy) / (1 << octave);
                }
            }
        }

        for (let i = 0; i < field.length; i++) {
            const value = Math.min(255, Math.max(0, Math.round(field[i] * 150)));
            image.data[i * 4] = value;
            image.data[i * 4 + 1] = value;
            image.data[i * 4 + 2] = value;
            image.data[i * 4 + 3] = 255;
        }

        ctx.putImageData(image, 0, 0);
    })));

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
}

export type ChartMood = "chop" | "dump" | "pump";

const CHART_CANDLES = 34;

export class ChartTape {
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: Ctx;
    private readonly candles: Array<{ open: number; close: number; high: number; low: number }> = [];
    private readonly texture: THREE.CanvasTexture;
    private seed: number;
    private price = 0.5;
    private timer = 0;
    private mood: ChartMood = "chop";

    constructor(bin: AssetBin, private readonly label: string, seed = 20260922) {
        this.seed = seed >>> 0;
        this.canvas = canvasOf(256, 160, () => { });
        this.ctx = this.canvas.getContext("2d") as Ctx;

        for (let i = 0; i < CHART_CANDLES; i++) this.push();

        this.texture = bin.texture(new THREE.CanvasTexture(this.canvas));
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.draw();
    }

    public get map(): THREE.CanvasTexture {
        return this.texture;
    }

    public setMood(mood: ChartMood) {
        this.mood = mood;
    }

    private random(): number {
        this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
        return this.seed / 4294967296;
    }

    private push() {
        const drift = this.mood === "pump" ? 0.045 : this.mood === "dump" ? -0.05 : 0;
        const swing = this.mood === "chop" ? 0.05 : 0.075;

        const open = this.price;
        let close = open + drift + (this.random() - 0.5) * swing;
        if (close < 0.06) close = 0.06 + this.random() * 0.05;
        if (close > 0.94) close = 0.94 - this.random() * 0.05;

        const high = Math.max(open, close) + this.random() * 0.035;
        const low = Math.min(open, close) - this.random() * 0.035;

        this.price = close;
        this.candles.push({ open, close, high, low });
        if (this.candles.length > CHART_CANDLES) this.candles.shift();
    }

    public update(delta: number) {
        this.timer += delta;
        if (this.timer < 0.34) return;
        this.timer = 0;
        this.push();
        this.draw();
    }

    private draw() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const top = 26;
        const bottom = height - 12;
        const span = bottom - top;

        ctx.fillStyle = "#070b12";
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "rgba(90, 130, 170, 0.22)";
        ctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) {
            const y = top + (span * i) / 5;
            ctx.beginPath();
            ctx.moveTo(6, y);
            ctx.lineTo(width - 6, y);
            ctx.stroke();
        }

        const step = (width - 16) / CHART_CANDLES;
        const last = this.candles[this.candles.length - 1];

        for (let i = 0; i < this.candles.length; i++) {
            const candle = this.candles[i];
            const x = 8 + i * step + step / 2;
            const up = candle.close >= candle.open;
            const color = up ? "#3ddc84" : "#ff5a4a";

            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, bottom - candle.high * span);
            ctx.lineTo(x, bottom - candle.low * span);
            ctx.stroke();

            const y = bottom - Math.max(candle.open, candle.close) * span;
            const tall = Math.max(1.4, Math.abs(candle.close - candle.open) * span);
            ctx.fillStyle = color;
            ctx.fillRect(x - step * 0.34, y, step * 0.68, tall);
        }

        const level = bottom - (last?.close ?? 0.5) * span;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "rgba(255, 209, 102, 0.7)";
        ctx.beginPath();
        ctx.moveTo(6, level);
        ctx.lineTo(width - 6, level);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#bfe6ff";
        ctx.font = "bold 15px monospace";
        ctx.textAlign = "left";
        ctx.fillText(this.label, 8, 18);

        const change = this.mood === "dump" ? "-42.0%" : this.mood === "pump" ? "+318%" : "+0.4%";
        ctx.fillStyle = this.mood === "dump" ? "#ff5a4a" : "#3ddc84";
        ctx.textAlign = "right";
        ctx.fillText(change, width - 8, 18);

        this.texture.needsUpdate = true;
    }
}
