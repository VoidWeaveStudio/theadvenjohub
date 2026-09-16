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

function finish(bin: AssetBin, canvas: HTMLCanvasElement, repeat: number, srgb = true): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.anisotropy = 4;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export function groundTexture(bin: AssetBin, random: () => number, repeat: number): THREE.CanvasTexture {
    const size = 512;
    const { canvas, ctx } = makeCanvas(size);

    ctx.fillStyle = hex(0x4a4034);
    ctx.fillRect(0, 0, size, size);

    noise(ctx, size, random, 220, 0x36301f, 0.5, 6, 34);
    noise(ctx, size, random, 160, 0x5c5140, 0.4, 4, 26);
    noise(ctx, size, random, 90, 0x2a2419, 0.55, 3, 14);
    cracks(ctx, size, random, 26, 0x241f16, 0.5);

    for (let i = 0; i < 40; i++) {
        ctx.fillStyle = rgba(0x6b6152, 0.5);
        const x = random() * size;
        const y = random() * size;
        ctx.fillRect(x, y, 2 + random() * 5, 2 + random() * 5);
    }

    return finish(bin, canvas, repeat);
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

    noise(ctx, size, random, 200, 0x4a453e, 0.45, 6, 40);
    noise(ctx, size, random, 120, 0x676156, 0.35, 5, 24);

    ctx.strokeStyle = rgba(0x3a352f, 0.7);
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (i * size) / 4);
        ctx.lineTo(size, (i * size) / 4);
        ctx.stroke();
    }

    cracks(ctx, size, random, 18, 0x2d2924, 0.55);

    for (let i = 0; i < 26; i++) {
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

    noise(ctx, size, random, 140, 0x7a4a26, 0.55, 4, 22);
    noise(ctx, size, random, 90, 0x2e2b27, 0.5, 3, 16);
    noise(ctx, size, random, 60, 0x96602c, 0.4, 2, 10);

    return finish(bin, canvas, repeat);
}

export function sandbagTexture(bin: AssetBin, random: () => number, repeat: number): THREE.CanvasTexture {
    const size = 256;
    const { canvas, ctx } = makeCanvas(size);

    ctx.fillStyle = hex(0x6b6047);
    ctx.fillRect(0, 0, size, size);

    noise(ctx, size, random, 150, 0x5a5039, 0.5, 4, 18);
    noise(ctx, size, random, 110, 0x7e7355, 0.4, 3, 12);

    ctx.strokeStyle = rgba(0x4a4232, 0.5);
    ctx.lineWidth = 2;
    for (let i = 0; i < size; i += 12) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(size, i + 6);
        ctx.stroke();
    }

    return finish(bin, canvas, repeat);
}

export function flameTexture(bin: AssetBin): THREE.CanvasTexture {
    const size = 128;
    const { canvas, ctx } = makeCanvas(size);

    const gradient = ctx.createRadialGradient(size / 2, size * 0.62, 2, size / 2, size * 0.62, size * 0.5);
    gradient.addColorStop(0, "rgba(255,244,200,1)");
    gradient.addColorStop(0.25, "rgba(255,190,70,0.95)");
    gradient.addColorStop(0.55, "rgba(240,110,30,0.7)");
    gradient.addColorStop(0.8, "rgba(150,40,10,0.25)");
    gradient.addColorStop(1, "rgba(60,10,0,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export function smokeTexture(bin: AssetBin): THREE.CanvasTexture {
    const size = 128;
    const { canvas, ctx } = makeCanvas(size);

    const gradient = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size * 0.5);
    gradient.addColorStop(0, "rgba(190,190,190,0.85)");
    gradient.addColorStop(0.5, "rgba(120,120,120,0.45)");
    gradient.addColorStop(1, "rgba(60,60,60,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

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
