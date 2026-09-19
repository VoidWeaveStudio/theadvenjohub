// src/features/game/world/locations/showcase/actors/mouthTextures.ts
import * as THREE from "three";

export type MouthShapeKind = "ae" | "teeth" | "r" | "bmp" | "th" | "o" | "qw" | "l" | "fv";

const SIZE = 160;
const LIP_COLOR = "#3a0d14";
const CAVITY_COLOR = "#5c1620";
const TEETH_COLOR = "#f4ead9";
const TONGUE_COLOR = "#c25f6d";

const cache = new Map<MouthShapeKind, THREE.CanvasTexture>();

function ellipsePath(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
}

function fillEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
    ellipsePath(ctx, cx, cy, rx, ry);
    ctx.fillStyle = color;
    ctx.fill();
}

function drawTeeth(ctx: CanvasRenderingContext2D, cx: number, topY: number, bottomY: number, width: number) {
    const height = SIZE * 0.09;
    ctx.fillStyle = TEETH_COLOR;
    ctx.fillRect(cx - width / 2, topY, width, height);
    ctx.fillRect(cx - width / 2, bottomY - height, width, height);

    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1.5;
    const gaps = 4;
    for (let i = 1; i < gaps; i++) {
        const x = cx - width / 2 + (width / gaps) * i;
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x, topY + height);
        ctx.moveTo(x, bottomY - height);
        ctx.lineTo(x, bottomY);
        ctx.stroke();
    }
}

function draw(kind: MouthShapeKind, ctx: CanvasRenderingContext2D) {
    const cx = SIZE / 2;
    const cy = SIZE / 2;

    switch (kind) {
        case "bmp": {
            ctx.strokeStyle = LIP_COLOR;
            ctx.lineWidth = SIZE * 0.05;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(cx - SIZE * 0.22, cy);
            ctx.quadraticCurveTo(cx, cy + SIZE * 0.02, cx + SIZE * 0.22, cy);
            ctx.stroke();
            return;
        }
        case "qw": {
            ellipsePath(ctx, cx, cy, SIZE * 0.11, SIZE * 0.09);
            ctx.fillStyle = CAVITY_COLOR;
            ctx.fill();
            ctx.lineWidth = SIZE * 0.025;
            ctx.strokeStyle = LIP_COLOR;
            ctx.stroke();
            return;
        }
        case "fv": {
            const w = SIZE * 0.4, h = SIZE * 0.14;
            fillEllipse(ctx, cx, cy, w / 2, h / 2, CAVITY_COLOR);
            drawTeeth(ctx, cx, cy - h * 0.42, cy + h * 0.1, w * 0.82);
            return;
        }
        case "teeth": {
            const w = SIZE * 0.46, h = SIZE * 0.18;
            fillEllipse(ctx, cx, cy, w / 2, h / 2, CAVITY_COLOR);
            drawTeeth(ctx, cx, cy - h * 0.38, cy + h * 0.38, w * 0.86);
            return;
        }
        case "r": {
            const w = SIZE * 0.3, h = SIZE * 0.26;
            fillEllipse(ctx, cx, cy, w / 2, h / 2, CAVITY_COLOR);
            drawTeeth(ctx, cx, cy - h * 0.36, cy + h * 0.36, w * 0.7);
            return;
        }
        case "th": {
            const w = SIZE * 0.38, h = SIZE * 0.28;
            fillEllipse(ctx, cx, cy, w / 2, h / 2, CAVITY_COLOR);
            drawTeeth(ctx, cx, cy - h * 0.42, cy + h * 0.42, w * 0.8);
            fillEllipse(ctx, cx, cy + h * 0.14, w * 0.24, h * 0.16, TONGUE_COLOR);
            return;
        }
        case "l": {
            const w = SIZE * 0.36, h = SIZE * 0.34;
            fillEllipse(ctx, cx, cy, w / 2, h / 2, CAVITY_COLOR);
            drawTeeth(ctx, cx, cy - h * 0.42, cy + h * 0.42, w * 0.78);
            fillEllipse(ctx, cx, cy - h * 0.06, w * 0.18, h * 0.28, TONGUE_COLOR);
            return;
        }
        case "o": {
            const w = SIZE * 0.32, h = SIZE * 0.4;
            fillEllipse(ctx, cx, cy, w / 2, h / 2, CAVITY_COLOR);
            drawTeeth(ctx, cx, cy - h * 0.4, cy + h * 0.4, w * 0.75);
            fillEllipse(ctx, cx, cy + h * 0.24, w * 0.32, h * 0.18, TONGUE_COLOR);
            return;
        }
        case "ae": {
            const w = SIZE * 0.52, h = SIZE * 0.46;
            fillEllipse(ctx, cx, cy, w / 2, h / 2, CAVITY_COLOR);
            drawTeeth(ctx, cx, cy - h * 0.4, cy + h * 0.4, w * 0.86);
            fillEllipse(ctx, cx, cy + h * 0.28, w * 0.34, h * 0.2, TONGUE_COLOR);
            return;
        }
    }
}

export function getMouthTexture(kind: MouthShapeKind): THREE.CanvasTexture {
    const cached = cache.get(kind);
    if (cached) return cached;

    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, SIZE, SIZE);
    draw(kind, ctx);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    cache.set(kind, texture);
    return texture;
}
