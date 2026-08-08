// src/features/game/world/locations/tower/floors/mainHallTextures.ts
import * as THREE from "three";

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    return { canvas, ctx: canvas.getContext("2d")! };
}

function toTexture(canvas: HTMLCanvasElement, repeatX: number, repeatY: number, srgb: boolean): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.anisotropy = 4;
    return texture;
}

function paintPanelGrid(ctx: CanvasRenderingContext2D, size: number, base: string, panel: string, cells: number) {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    const step = size / cells;
    for (let x = 0; x < cells; x++) {
        for (let y = 0; y < cells; y++) {
            ctx.globalAlpha = 0.3 + Math.random() * 0.5;
            ctx.fillStyle = panel;
            ctx.fillRect(x * step + 2, y * step + 2, step - 4, step - 4);
        }
    }
    ctx.globalAlpha = 1;
}

function paintSeams(ctx: CanvasRenderingContext2D, size: number, cells: number, color: string, lineWidth: number) {
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = color;
    ctx.shadowBlur = lineWidth * 3;

    const step = size / cells;
    for (let i = 0; i <= cells; i++) {
        ctx.beginPath();
        ctx.moveTo(i * step, 0);
        ctx.lineTo(i * step, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * step);
        ctx.lineTo(size, i * step);
        ctx.stroke();
    }
    ctx.shadowBlur = 0;
}

export function createPlazaFloorMaterial(): THREE.MeshStandardMaterial {
    const albedo = makeCanvas(512);
    paintPanelGrid(albedo.ctx, 512, "#455166", "#586780", 8);
    for (let i = 0; i < 90; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const r = 8 + Math.random() * 40;
        const grad = albedo.ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, "rgba(190,215,240,0.16)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        albedo.ctx.fillStyle = grad;
        albedo.ctx.beginPath();
        albedo.ctx.arc(x, y, r, 0, Math.PI * 2);
        albedo.ctx.fill();
    }

    const seams = makeCanvas(512);
    paintSeams(seams.ctx, 512, 8, "#8ff2ff", 2.2);

    return new THREE.MeshStandardMaterial({
        map: toTexture(albedo.canvas, 10, 10, true),
        emissiveMap: toTexture(seams.canvas, 10, 10, true),
        emissive: 0xffffff,
        emissiveIntensity: 0.45,
        roughness: 0.45,
        metalness: 0.35,
    });
}

export function createHullPanelMaterial(): THREE.MeshStandardMaterial {
    const albedo = makeCanvas(512);
    paintPanelGrid(albedo.ctx, 512, "#3d4c66", "#4e5f7d", 6);

    albedo.ctx.strokeStyle = "rgba(200,225,255,0.16)";
    albedo.ctx.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
        const y = Math.random() * 512;
        albedo.ctx.beginPath();
        albedo.ctx.moveTo(0, y);
        albedo.ctx.lineTo(512, y);
        albedo.ctx.stroke();
    }

    return new THREE.MeshStandardMaterial({
        map: toTexture(albedo.canvas, 14, 4, true),
        roughness: 0.6,
        metalness: 0.5,
        side: THREE.DoubleSide,
    });
}

export function createFacadeMaterial(accent: string): THREE.MeshStandardMaterial {
    const albedo = makeCanvas(512);
    paintPanelGrid(albedo.ctx, 512, "#3a4763", "#4b5a7a", 4);

    const windows = makeCanvas(512);
    windows.ctx.clearRect(0, 0, 512, 512);
    windows.ctx.shadowColor = accent;
    windows.ctx.shadowBlur = 18;
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 8; col++) {
            if (Math.random() < 0.25) continue;
            windows.ctx.globalAlpha = 0.5 + Math.random() * 0.5;
            windows.ctx.fillStyle = accent;
            windows.ctx.fillRect(24 + col * 60, 40 + row * 92, 34, 16);
        }
    }
    windows.ctx.globalAlpha = 1;
    windows.ctx.shadowBlur = 0;

    return new THREE.MeshStandardMaterial({
        map: toTexture(albedo.canvas, 2, 1, true),
        emissiveMap: toTexture(windows.canvas, 2, 1, true),
        emissive: 0xffffff,
        emissiveIntensity: 1.1,
        roughness: 0.55,
        metalness: 0.45,
    });
}

export function createCityBlockMaterial(accent: string): THREE.MeshStandardMaterial {
    const albedo = makeCanvas(512);
    paintPanelGrid(albedo.ctx, 512, "#414e6b", "#525f80", 6);

    const windows = makeCanvas(512);
    windows.ctx.clearRect(0, 0, 512, 512);
    windows.ctx.shadowColor = accent;
    windows.ctx.shadowBlur = 12;
    for (let row = 0; row < 12; row++) {
        for (let col = 0; col < 12; col++) {
            if (Math.random() < 0.3) continue;
            windows.ctx.globalAlpha = 0.35 + Math.random() * 0.65;
            windows.ctx.fillStyle = Math.random() < 0.75 ? accent : "#fff3cf";
            windows.ctx.fillRect(14 + col * 41, 16 + row * 41, 22, 14);
        }
    }
    windows.ctx.globalAlpha = 1;
    windows.ctx.shadowBlur = 0;

    return new THREE.MeshStandardMaterial({
        map: toTexture(albedo.canvas, 2, 2, true),
        emissiveMap: toTexture(windows.canvas, 2, 2, true),
        emissive: 0xffffff,
        emissiveIntensity: 1.25,
        roughness: 0.6,
        metalness: 0.4,
    });
}

export function createSkyDomeMaterial(): THREE.MeshBasicMaterial {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#0e1730");
    grad.addColorStop(0.45, "#2b3f6d");
    grad.addColorStop(0.78, "#5b6ea6");
    grad.addColorStop(1, "#93a6d4");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 8, 256);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 60; i++) {
        ctx.globalAlpha = 0.2 + Math.random() * 0.6;
        ctx.fillRect(Math.random() * 8, Math.random() * 150, 1, 1);
    }
    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    return new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false });
}

export function disposeMaterialMaps(material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | undefined | null) {
    material?.map?.dispose();
    if (material instanceof THREE.MeshStandardMaterial) {
        material.emissiveMap?.dispose();
        material.roughnessMap?.dispose();
    }
}
