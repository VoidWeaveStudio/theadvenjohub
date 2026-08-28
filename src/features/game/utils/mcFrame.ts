// src/features/game/utils/mcFrame.ts
import * as THREE from "three";

export { mcFrameTier, MC_FRAME_THRESHOLDS } from "@/core/lib/mcTier";

export const MC_FRAME_TIERS = [
    { colour: 0x000000, ring: false, spin: 0, glow: 0 },
    { colour: 0xb87333, ring: true, spin: 0.15, glow: 0.25 },
    { colour: 0xc0c8d0, ring: true, spin: 0.22, glow: 0.4 },
    { colour: 0xffd166, ring: true, spin: 0.3, glow: 0.6 },
    { colour: 0xffe9a8, ring: true, spin: 0.42, glow: 0.9 },
    { colour: 0xc79bff, ring: true, spin: 0.6, glow: 1.3 },
];

export function mcFrameSpec(tier: number) {
    return MC_FRAME_TIERS[Math.max(0, Math.min(MC_FRAME_TIERS.length - 1, Math.round(tier)))];
}

export function mcRingTexture(colour: number, glow: number): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d")!;
    const css = "#" + colour.toString(16).padStart(6, "0");
    const centre = size / 2;
    const radius = size * 0.42;

    ctx.strokeStyle = css;
    ctx.lineWidth = size * 0.05;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(centre, centre, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = css;

    const pips = 4;
    for (let i = 0; i < pips; i++) {
        const angle = (i / pips) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(
            centre + Math.cos(angle) * radius,
            centre + Math.sin(angle) * radius,
            size * (0.03 + glow * 0.014),
            0,
            Math.PI * 2
        );
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export function buildMcFrame(tier: number, scale: number): THREE.Sprite | null {
    const spec = mcFrameSpec(tier);
    if (!spec.ring) return null;

    const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: mcRingTexture(spec.colour, spec.glow),
            transparent: true,
            opacity: 0.55 + spec.glow * 0.3,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false,
            toneMapped: false,
        })
    );

    sprite.scale.setScalar(scale);
    sprite.renderOrder = 4;
    sprite.userData.spin = spec.spin;
    return sprite;
}

export function disposeMcFrame(sprite: THREE.Sprite | null) {
    if (!sprite) return;

    sprite.removeFromParent();
    const material = sprite.material as THREE.SpriteMaterial;
    material.map?.dispose();
    material.dispose();
}
