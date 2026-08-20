// src/features/game/entities/npcNameTag.ts
import * as THREE from "three";
import { t, onLanguageChange } from "@/core/i18n";

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function paint(canvas: HTMLCanvasElement, name: string, accentColor: string) {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pad = 14;
    roundedRectPath(ctx, pad, pad, canvas.width - pad * 2, canvas.height - pad * 2, 26);

    ctx.fillStyle = "rgba(9, 9, 13, 0.85)";
    ctx.fill();

    ctx.save();
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 3;
    ctx.strokeStyle = accentColor;
    ctx.stroke();
    ctx.restore();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 50px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, canvas.width / 2, canvas.height / 2 + 2);
}

export function createNpcNameTag(nameKey: string, accentColor: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;

    paint(canvas, t(nameKey), accentColor);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.y = 2.8;
    sprite.scale.set(2, 0.5, 1);

    sprite.userData.stopLanguageWatch = onLanguageChange(() => {
        paint(canvas, t(nameKey), accentColor);
        texture.needsUpdate = true;
    });

    return sprite;
}

export function disposeNpcNameTags(root: THREE.Object3D) {
    root.traverse((child) => {
        const stop = child.userData?.stopLanguageWatch;
        if (typeof stop === "function") {
            stop();
            child.userData.stopLanguageWatch = null;
        }
    });
}
