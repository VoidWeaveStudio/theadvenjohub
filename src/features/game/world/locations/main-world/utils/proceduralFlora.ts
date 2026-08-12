// src/features/game/world/locations/main-world/utils/proceduralFlora.ts
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createRandom } from "./worldNoise";

function paint(geometry: THREE.BufferGeometry, base: THREE.Color, tip: THREE.Color, spanY: number, offsetY: number) {
    const position = geometry.getAttribute("position");
    const colors = new Float32Array(position.count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < position.count; i++) {
        const t = THREE.MathUtils.clamp((position.getY(i) - offsetY) / spanY, 0, 1);
        color.copy(base).lerp(tip, t);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
}

function combine(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const flattened = parts.map((part) => (part.getIndex() ? part.toNonIndexed() : part));
    parts.forEach((part, index) => {
        if (flattened[index] !== part) part.dispose();
    });

    const merged = mergeGeometries(flattened, false);
    flattened.forEach((part) => part.dispose());

    if (!merged) throw new Error("flora merge failed");
    merged.computeVertexNormals();
    merged.computeBoundingSphere();
    return merged;
}

export function createTreeGeometry(variant: number): THREE.BufferGeometry {
    const random = createRandom(9001 + variant * 733);
    const parts: THREE.BufferGeometry[] = [];

    const trunkHeight = 4.2 + random() * 2.6;
    const trunkTop = new THREE.Color(0x6b5138);
    const trunkBase = new THREE.Color(0x3d2c1d);

    const trunk = new THREE.CylinderGeometry(0.19 + random() * 0.06, 0.42 + random() * 0.1, trunkHeight, 6, 1);
    trunk.translate(0, trunkHeight / 2, 0);
    parts.push(paint(trunk, trunkBase, trunkTop, trunkHeight, 0));

    const leafBase = variant % 2 === 0 ? new THREE.Color(0x1f3d1c) : new THREE.Color(0x24361a);
    const leafTip = variant % 2 === 0 ? new THREE.Color(0x4a7c33) : new THREE.Color(0x5d8a3a);

    const blobCount = 3 + Math.floor(random() * 2);
    for (let i = 0; i < blobCount; i++) {
        const radius = 1.5 + random() * 0.9 - i * 0.18;
        if (radius <= 0.4) continue;

        const blob = new THREE.IcosahedronGeometry(radius, 0);
        const spread = 0.8 + random() * 0.6;
        const height = trunkHeight + 0.3 + i * (0.75 + random() * 0.4);

        blob.scale(1, 0.78 + random() * 0.25, 1);
        blob.translate(
            (random() - 0.5) * spread,
            height,
            (random() - 0.5) * spread
        );
        parts.push(paint(blob, leafBase, leafTip, 3.5, trunkHeight));
    }

    return combine(parts);
}

export function createRockGeometry(variant: number): THREE.BufferGeometry {
    const random = createRandom(4400 + variant * 977);
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const position = geometry.getAttribute("position");

    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const y = position.getY(i);
        const z = position.getZ(i);
        const scale = 0.72 + random() * 0.55;
        position.setXYZ(i, x * scale, y * scale * (0.55 + random() * 0.35), z * scale);
    }

    position.needsUpdate = true;
    geometry.scale(1, 0.82, 1);
    geometry.translate(0, 0.42, 0);

    return combine([paint(geometry, new THREE.Color(0x2f2d2b), new THREE.Color(0x625e57), 1.6, 0)]);
}

export function createGrassBladeGeometry(): THREE.BufferGeometry {
    const height = 0.62;
    const halfWidth = 0.055;

    const positions = new Float32Array([
        -halfWidth, 0, 0,
        halfWidth, 0, 0,
        -halfWidth * 0.6, height * 0.55, 0.04,

        halfWidth, 0, 0,
        halfWidth * 0.6, height * 0.55, 0.04,
        -halfWidth * 0.6, height * 0.55, 0.04,

        -halfWidth * 0.6, height * 0.55, 0.04,
        halfWidth * 0.6, height * 0.55, 0.04,
        0, height, 0.11,
    ]);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
}
