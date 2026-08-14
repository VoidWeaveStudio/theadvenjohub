// src/features/game/world/locations/main-world/utils/leafTexture.ts
import * as THREE from "three";
import { createRandom } from "./worldNoise";

const SIZE = 256;

interface LeafPlacement {
    x: number;
    y: number;
    length: number;
    width: number;
    angle: number;
    shade: number;
}

function drawLeaf(context: CanvasRenderingContext2D, leaf: LeafPlacement) {
    const half = leaf.length * 0.5;

    context.save();
    context.translate(leaf.x, leaf.y);
    context.rotate(leaf.angle);

    context.beginPath();
    context.moveTo(0, -half);
    context.quadraticCurveTo(leaf.width * 0.5, -leaf.length * 0.08, 0, half);
    context.quadraticCurveTo(-leaf.width * 0.5, -leaf.length * 0.08, 0, -half);
    context.closePath();

    const gradient = context.createLinearGradient(0, -half, 0, half);
    const tip = Math.round(leaf.shade * 255);
    const root = Math.round(leaf.shade * 178);
    gradient.addColorStop(0, `rgb(${root}, ${root}, ${root})`);
    gradient.addColorStop(0.55, `rgb(${tip}, ${tip}, ${tip})`);
    gradient.addColorStop(1, `rgb(${root}, ${root}, ${root})`);

    context.fillStyle = gradient;
    context.fill();

    context.beginPath();
    context.moveTo(0, -half * 0.92);
    context.lineTo(0, half * 0.92);
    context.strokeStyle = `rgba(${root}, ${root}, ${root}, 0.65)`;
    context.lineWidth = Math.max(1, leaf.width * 0.06);
    context.stroke();

    context.restore();
}

export function createLeafTexture(seed: number): THREE.Texture | null {
    if (typeof document === "undefined") return null;

    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.clearRect(0, 0, SIZE, SIZE);

    const random = createRandom(seed);
    const center = SIZE * 0.5;
    const leaves: LeafPlacement[] = [];

    for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * Math.PI * 2 + (random() - 0.5) * 0.5;
        const distance = SIZE * (0.17 + random() * 0.15);

        leaves.push({
            x: center + Math.cos(angle) * distance,
            y: center + Math.sin(angle) * distance,
            length: SIZE * (0.3 + random() * 0.16),
            width: SIZE * (0.11 + random() * 0.06),
            angle: angle + Math.PI * 0.5 + (random() - 0.5) * 0.7,
            shade: 0.72 + random() * 0.28,
        });
    }

    for (let i = 0; i < 6; i++) {
        const angle = random() * Math.PI * 2;
        const distance = SIZE * random() * 0.12;

        leaves.push({
            x: center + Math.cos(angle) * distance,
            y: center + Math.sin(angle) * distance,
            length: SIZE * (0.22 + random() * 0.12),
            width: SIZE * (0.09 + random() * 0.05),
            angle: random() * Math.PI * 2,
            shade: 0.6 + random() * 0.24,
        });
    }

    for (const leaf of leaves) drawLeaf(context, leaf);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    return texture;
}
