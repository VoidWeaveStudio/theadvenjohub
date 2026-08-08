// src/features/game/world/locations/tower/floors/mainHallSigns.ts
import * as THREE from "three";

export type NpcRoleIcon = "merchant" | "quests" | "style" | "factions";

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawMerchant(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    for (let i = 0; i < 3; i++) {
        const y = cy + s * 0.42 - i * s * 0.34;
        ctx.beginPath();
        ctx.ellipse(cx, y, s * 0.62, s * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.62, cy + s * 0.42);
    ctx.lineTo(cx - s * 0.62, cy - s * 0.26);
    ctx.moveTo(cx + s * 0.62, cy + s * 0.42);
    ctx.lineTo(cx + s * 0.62, cy - s * 0.26);
    ctx.stroke();
}

function drawQuests(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.85);
    ctx.lineTo(cx + s * 0.72, cy);
    ctx.lineTo(cx, cy + s * 0.85);
    ctx.lineTo(cx - s * 0.72, cy);
    ctx.closePath();
    ctx.stroke();

    ctx.lineWidth = ctx.lineWidth * 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.42);
    ctx.lineTo(cx, cy + s * 0.14);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.42, s * 0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = ctx.lineWidth / 1.6;
}

function drawStyle(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.82, s * 0.68, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.34, cy + s * 0.22, s * 0.2, s * 0.14, 0, 0, Math.PI * 2);
    ctx.stroke();

    const dots: [number, number][] = [[-0.38, -0.22], [-0.06, -0.38], [0.28, -0.26], [-0.34, 0.2]];
    for (const [dx, dy] of dots) {
        ctx.beginPath();
        ctx.arc(cx + dx * s, cy + dy * s, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawFactions(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.52, cy - s * 0.85);
    ctx.lineTo(cx - s * 0.52, cy + s * 0.85);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - s * 0.52, cy - s * 0.78);
    ctx.lineTo(cx + s * 0.72, cy - s * 0.5);
    ctx.lineTo(cx + s * 0.36, cy - s * 0.1);
    ctx.lineTo(cx + s * 0.72, cy + s * 0.28);
    ctx.lineTo(cx - s * 0.52, cy + s * 0.06);
    ctx.closePath();
    ctx.stroke();
}

const ICON_PAINTERS: Record<NpcRoleIcon, (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) => void> = {
    merchant: drawMerchant,
    quests: drawQuests,
    style: drawStyle,
    factions: drawFactions,
};

export function createNpcSignBoard(name: string, role: string, icon: NpcRoleIcon, accentColor: string): THREE.Mesh {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 320;
    const ctx = canvas.getContext("2d")!;

    roundedRectPath(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 28);
    ctx.fillStyle = "rgba(6,10,16,0.88)";
    ctx.fill();

    ctx.save();
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 26;
    ctx.lineWidth = 5;
    ctx.strokeStyle = accentColor;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = accentColor;
    ctx.fillStyle = accentColor;
    ctx.lineWidth = 7;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 22;
    ICON_PAINTERS[icon](ctx, 140, 160, 78);
    ctx.restore();

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 84px Arial";
    ctx.fillText(name, 262, 128);
    ctx.shadowBlur = 8;
    ctx.fillStyle = accentColor;
    ctx.font = "bold 44px Arial";
    ctx.fillText(role.toUpperCase(), 264, 212);
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: THREE.DoubleSide,
    });

    return new THREE.Mesh(new THREE.PlaneGeometry(12, 5), material);
}
