// src/features/game/world/locations/events/roomTextures.ts
import * as THREE from "three";
import { AssetBin } from "../../AssetBin";
import type { EventRoomTheme, GroundPattern } from "./roomThemes";

function makeCanvas(size: number) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    return { canvas, ctx: canvas.getContext("2d")! };
}

function hex(value: number): string {
    return `#${value.toString(16).padStart(6, "0")}`;
}

function rgba(value: number, alpha: number): string {
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r},${g},${b},${alpha})`;
}

function paintSlab(ctx: CanvasRenderingContext2D, size: number, theme: EventRoomTheme, random: () => number) {
    const tiles = 5;
    const step = size / tiles;
    ctx.strokeStyle = rgba(theme.groundAccent, 0.85);
    ctx.lineWidth = 5;
    for (let i = 0; i <= tiles; i++) {
        ctx.beginPath();
        ctx.moveTo(i * step, 0);
        ctx.lineTo(i * step, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * step);
        ctx.lineTo(size, i * step);
        ctx.stroke();
    }
    ctx.strokeStyle = rgba(theme.wallAccent, 0.22);
    ctx.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
        ctx.beginPath();
        const x = random() * size;
        const y = random() * size;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (random() - 0.5) * 90, y + (random() - 0.5) * 90);
        ctx.stroke();
    }
}

function paintCracked(ctx: CanvasRenderingContext2D, size: number, theme: EventRoomTheme, random: () => number) {
    ctx.strokeStyle = rgba(theme.groundAccent, 0.95);
    for (let i = 0; i < 44; i++) {
        ctx.lineWidth = 1 + random() * 5;
        ctx.beginPath();
        let x = random() * size;
        let y = random() * size;
        ctx.moveTo(x, y);
        for (let j = 0; j < 6; j++) {
            x += (random() - 0.5) * 130;
            y += (random() - 0.5) * 130;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.fillStyle = rgba(theme.accent, 0.1);
    for (let i = 0; i < 30; i++) {
        ctx.beginPath();
        ctx.arc(random() * size, random() * size, 3 + random() * 16, 0, Math.PI * 2);
        ctx.fill();
    }
}

function paintTerrace(ctx: CanvasRenderingContext2D, size: number, theme: EventRoomTheme, random: () => number) {
    const bands = 12;
    for (let i = 0; i < bands; i++) {
        ctx.fillStyle = i % 2 === 0 ? rgba(theme.groundAccent, 0.45) : rgba(theme.wallAccent, 0.22);
        ctx.fillRect(0, (i / bands) * size, size, size / bands - 2);
    }
    ctx.fillStyle = rgba(theme.accent, 0.16);
    for (let i = 0; i < 40; i++) {
        const w = 12 + random() * 60;
        ctx.fillRect(random() * size, random() * size, w, 6 + random() * 20);
    }
}

function paintSand(ctx: CanvasRenderingContext2D, size: number, theme: EventRoomTheme, random: () => number) {
    for (let i = 0; i < 90; i++) {
        ctx.strokeStyle = rgba(theme.groundAccent, 0.16 + random() * 0.2);
        ctx.lineWidth = 2 + random() * 7;
        ctx.beginPath();
        const y = random() * size;
        ctx.moveTo(0, y);
        for (let x = 0; x <= size; x += 40) {
            ctx.lineTo(x, y + Math.sin((x / size) * Math.PI * (2 + random() * 3)) * (6 + random() * 22));
        }
        ctx.stroke();
    }
    ctx.fillStyle = rgba(theme.wallAccent, 0.2);
    for (let i = 0; i < 500; i++) {
        ctx.fillRect(random() * size, random() * size, 2, 2);
    }
}

function paintGrid(ctx: CanvasRenderingContext2D, size: number, theme: EventRoomTheme, random: () => number) {
    const cells = 16;
    const step = size / cells;
    ctx.strokeStyle = rgba(theme.accent, 0.4);
    ctx.lineWidth = 2;
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
    ctx.fillStyle = rgba(theme.accent, 0.16);
    for (let i = 0; i < 34; i++) {
        ctx.fillRect(Math.floor(random() * cells) * step, Math.floor(random() * cells) * step, step, step);
    }
}

function paintAsh(ctx: CanvasRenderingContext2D, size: number, theme: EventRoomTheme, random: () => number) {
    for (let i = 0; i < 900; i++) {
        ctx.fillStyle = rgba(random() > 0.7 ? theme.accent : theme.groundAccent, 0.08 + random() * 0.24);
        ctx.beginPath();
        ctx.arc(random() * size, random() * size, 2 + random() * 13, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.strokeStyle = rgba(theme.accent, 0.3);
    for (let i = 0; i < 26; i++) {
        ctx.lineWidth = 1 + random() * 3;
        ctx.beginPath();
        let x = random() * size;
        let y = random() * size;
        ctx.moveTo(x, y);
        for (let j = 0; j < 4; j++) {
            x += (random() - 0.5) * 120;
            y += (random() - 0.5) * 120;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

function paintIce(ctx: CanvasRenderingContext2D, size: number, theme: EventRoomTheme, random: () => number) {
    for (let i = 0; i < 60; i++) {
        ctx.strokeStyle = rgba(theme.trim, 0.1 + random() * 0.22);
        ctx.lineWidth = 1 + random() * 3;
        ctx.beginPath();
        const cx = random() * size;
        const cy = random() * size;
        ctx.moveTo(cx, cy);
        for (let j = 0; j < 5; j++) {
            const a = random() * Math.PI * 2;
            const r = 20 + random() * 90;
            ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            ctx.moveTo(cx, cy);
        }
        ctx.stroke();
    }
    ctx.fillStyle = rgba(theme.accent, 0.12);
    for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.arc(random() * size, random() * size, 6 + random() * 26, 0, Math.PI * 2);
        ctx.fill();
    }
}

function paintPlate(ctx: CanvasRenderingContext2D, size: number, theme: EventRoomTheme, random: () => number) {
    const cells = 6;
    const step = size / cells;
    for (let x = 0; x < cells; x++) {
        for (let y = 0; y < cells; y++) {
            ctx.fillStyle = rgba(theme.groundAccent, 0.25 + random() * 0.25);
            ctx.fillRect(x * step + 4, y * step + 4, step - 8, step - 8);
            ctx.strokeStyle = rgba(theme.accent, 0.3);
            ctx.lineWidth = 2;
            ctx.strokeRect(x * step + 4, y * step + 4, step - 8, step - 8);
            ctx.fillStyle = rgba(theme.accent, 0.45);
            for (const [dx, dy] of [[10, 10], [step - 14, 10], [10, step - 14], [step - 14, step - 14]]) {
                ctx.beginPath();
                ctx.arc(x * step + dx, y * step + dy, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

const PAINTERS: Record<GroundPattern, (ctx: CanvasRenderingContext2D, size: number, theme: EventRoomTheme, random: () => number) => void> = {
    slab: paintSlab,
    cracked: paintCracked,
    terrace: paintTerrace,
    sand: paintSand,
    grid: paintGrid,
    ash: paintAsh,
    ice: paintIce,
    plate: paintPlate,
};

export function createGroundMaterial(bin: AssetBin, theme: EventRoomTheme, random: () => number): THREE.MeshStandardMaterial {
    const size = 1024;
    const { canvas, ctx } = makeCanvas(size);

    const base = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.72);
    base.addColorStop(0, hex(theme.ground));
    base.addColorStop(1, hex(theme.groundAccent));
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    PAINTERS[theme.groundPattern](ctx, size, theme, random);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    return bin.material(new THREE.MeshStandardMaterial({
        map: bin.texture(texture),
        roughness: theme.groundPattern === "ice" ? 0.28 : 0.92,
        metalness: theme.groundPattern === "plate" ? 0.35 : 0.05,
        envMapIntensity: 0.7,
    }));
}

export function createCliffMaterial(bin: AssetBin, theme: EventRoomTheme, random: () => number): THREE.MeshStandardMaterial {
    const size = 512;
    const { canvas, ctx } = makeCanvas(size);

    ctx.fillStyle = hex(theme.wall);
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 260; i++) {
        ctx.fillStyle = rgba(random() > 0.6 ? theme.wallAccent : theme.groundAccent, 0.1 + random() * 0.3);
        ctx.beginPath();
        ctx.arc(random() * size, random() * size, 4 + random() * 34, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = rgba(theme.groundAccent, 0.5);
    for (let i = 0; i < 48; i++) {
        ctx.lineWidth = 1 + random() * 4;
        ctx.beginPath();
        const x = random() * size;
        ctx.moveTo(x, 0);
        for (let y = 0; y <= size; y += 48) {
            ctx.lineTo(x + Math.sin(y * 0.03 + i) * 12, y);
        }
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(14, 3);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    return bin.material(new THREE.MeshStandardMaterial({
        map: bin.texture(texture),
        roughness: 0.95,
        metalness: 0.03,
        side: THREE.DoubleSide,
    }));
}

export function createParticleTexture(bin: AssetBin, soft: boolean): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(soft ? 0.28 : 0.55, "rgba(255,255,255,0.6)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return bin.texture(texture);
}
