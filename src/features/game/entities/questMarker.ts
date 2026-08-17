// src/features/game/entities/questMarker.ts
import * as THREE from "three";

export type QuestMarkerKind = "available" | "turnin" | "target";

interface MarkerStyle {
    symbol: string;
    color: string;
}

const STYLES: Record<QuestMarkerKind, MarkerStyle> = {
    available: { symbol: "!", color: "#FFD166" },
    turnin: { symbol: "?", color: "#4ADE80" },
    target: { symbol: "◆", color: "#4FD1FF" },
};

const textureCache = new Map<QuestMarkerKind, THREE.CanvasTexture>();

function markerTexture(kind: QuestMarkerKind): THREE.CanvasTexture {
    const cached = textureCache.get(kind);
    if (cached) return cached;

    const style = STYLES[kind];
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;

    ctx.save();
    ctx.shadowColor = style.color;
    ctx.shadowBlur = 26;
    ctx.fillStyle = style.color;
    ctx.font = "bold 96px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(style.symbol, canvas.width / 2, canvas.height / 2 + 4);
    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.55;
    ctx.font = "bold 96px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(style.symbol, canvas.width / 2, canvas.height / 2 + 4);

    const texture = new THREE.CanvasTexture(canvas);
    textureCache.set(kind, texture);
    return texture;
}

export function createQuestMarker(kind: QuestMarkerKind, height: number): THREE.Sprite {
    const material = new THREE.SpriteMaterial({
        map: markerTexture(kind),
        depthTest: false,
        transparent: true,
    });

    const sprite = new THREE.Sprite(material);
    sprite.position.y = height;
    sprite.scale.set(0.8, 0.8, 1);
    sprite.renderOrder = 12;
    sprite.userData.baseY = height;

    return sprite;
}

export function animateQuestMarker(sprite: THREE.Sprite, elapsed: number) {
    const baseY = sprite.userData.baseY as number;
    sprite.position.y = baseY + Math.sin(elapsed * 2.2) * 0.12;

    const pulse = 0.78 + Math.sin(elapsed * 3.4) * 0.06;
    sprite.scale.set(pulse, pulse, 1);
}

export function disposeQuestMarker(sprite: THREE.Sprite) {
    sprite.parent?.remove(sprite);
    sprite.material.dispose();
}
