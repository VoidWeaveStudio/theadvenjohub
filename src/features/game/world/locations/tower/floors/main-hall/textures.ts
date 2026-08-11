// src/features/game/world/locations/tower/floors/main-hall/textures.ts
import * as THREE from "three";
import type { AssetBin } from "./utils/assetBin";

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext("2d")! };
}

function toTexture(bin: AssetBin, canvas: HTMLCanvasElement, repeatX: number, repeatY: number): THREE.CanvasTexture {
    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.anisotropy = 8;
    return texture;
}

export function createMarbleMaterial(bin: AssetBin, random: () => number): THREE.MeshStandardMaterial {
    const { canvas, ctx } = makeCanvas(512, 512);

    ctx.fillStyle = "#cfc9bd";
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 120; i++) {
        const x = random() * 512;
        const y = random() * 512;
        const r = 20 + random() * 90;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, random() < 0.5 ? "rgba(255,252,246,0.5)" : "rgba(150,143,131,0.28)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = "rgba(120,112,100,0.35)";
    for (let i = 0; i < 26; i++) {
        ctx.lineWidth = 0.6 + random() * 1.6;
        ctx.beginPath();
        let x = random() * 512;
        let y = random() * 512;
        ctx.moveTo(x, y);
        for (let step = 0; step < 7; step++) {
            x += (random() - 0.5) * 160;
            y += (random() - 0.5) * 160;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    return bin.material(new THREE.MeshStandardMaterial({
        map: toTexture(bin, canvas, 8, 8),
        roughness: 0.42,
        metalness: 0.1,
    }));
}

export function createStoneMaterial(bin: AssetBin, random: () => number): THREE.MeshStandardMaterial {
    const { canvas, ctx } = makeCanvas(256, 256);

    ctx.fillStyle = "#bdb7ab";
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 700; i++) {
        ctx.globalAlpha = 0.05 + random() * 0.12;
        ctx.fillStyle = random() < 0.5 ? "#ffffff" : "#8f8a7f";
        ctx.fillRect(random() * 256, random() * 256, 2, 2);
    }
    ctx.globalAlpha = 1;

    return bin.material(new THREE.MeshStandardMaterial({
        map: toTexture(bin, canvas, 2, 4),
        roughness: 0.72,
        metalness: 0.05,
    }));
}

export function createSteelMaterial(bin: AssetBin, random: () => number): THREE.MeshStandardMaterial {
    const { canvas, ctx } = makeCanvas(256, 256);

    ctx.fillStyle = "#2b2f36";
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 200; i++) {
        ctx.globalAlpha = 0.04 + random() * 0.1;
        ctx.fillStyle = "#8d97a6";
        ctx.fillRect(0, random() * 256, 256, 1);
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(12,14,18,0.85)";
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
        const p = (i / 4) * 256;
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, 256);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(256, p);
        ctx.stroke();
    }

    return bin.material(new THREE.MeshStandardMaterial({
        map: toTexture(bin, canvas, 3, 3),
        roughness: 0.55,
        metalness: 0.72,
    }));
}

export function createBrassMaterial(bin: AssetBin): THREE.MeshStandardMaterial {
    return bin.material(new THREE.MeshStandardMaterial({
        color: 0xc79a4b,
        roughness: 0.3,
        metalness: 0.92,
    }));
}

export function createDarkTrimMaterial(bin: AssetBin): THREE.MeshStandardMaterial {
    return bin.material(new THREE.MeshStandardMaterial({
        color: 0x1b1f26,
        roughness: 0.45,
        metalness: 0.6,
    }));
}

export function createGlassMaterial(bin: AssetBin): THREE.MeshStandardMaterial {
    return bin.material(new THREE.MeshStandardMaterial({
        color: 0xb9d4e6,
        roughness: 0.16,
        metalness: 0.1,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
    }));
}

export function createSkylightMaterial(bin: AssetBin): THREE.MeshBasicMaterial {
    const { canvas, ctx } = makeCanvas(8, 128);
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, "#f4f8ff");
    grad.addColorStop(0.55, "#cfe0f4");
    grad.addColorStop(1, "#9fb6d6");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 8, 128);

    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;

    return bin.material(new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false }));
}

export function createTickerTexture(bin: AssetBin, text: string): THREE.CanvasTexture {
    const { canvas, ctx } = makeCanvas(1024, 64);

    ctx.fillStyle = "#0b0d12";
    ctx.fillRect(0, 0, 1024, 64);

    ctx.font = "bold 40px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const width = ctx.measureText(text).width || 1;
    ctx.setTransform(1024 / width, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#f0b95c";
    ctx.fillText(text, 0, 34);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const texture = bin.texture(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 8;
    return texture;
}

export function createEmissiveBoardMaterial(bin: AssetBin, texture: THREE.Texture): THREE.MeshStandardMaterial {
    return bin.material(new THREE.MeshStandardMaterial({
        map: texture,
        emissiveMap: texture,
        emissive: 0xffffff,
        emissiveIntensity: 0.9,
        roughness: 0.25,
        metalness: 0.1,
    }));
}
