// src/features/game/world/locations/main-world/utils/proceduralFlora.ts
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createRandom, valueNoise3 } from "./worldNoise";

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

interface RockShape {
    lumpScale: number;
    lumpAmount: number;
    detailScale: number;
    detailAmount: number;
    squash: number;
    stretch: number;
    bury: number;
}

const ROCK_SHAPES: RockShape[] = [
    { lumpScale: 1.5, lumpAmount: 0.34, detailScale: 4.1, detailAmount: 0.11, squash: 0.74, stretch: 1.0, bury: 0.22 },
    { lumpScale: 1.1, lumpAmount: 0.28, detailScale: 5.6, detailAmount: 0.08, squash: 0.44, stretch: 1.25, bury: 0.3 },
    { lumpScale: 2.2, lumpAmount: 0.4, detailScale: 3.4, detailAmount: 0.14, squash: 0.92, stretch: 0.86, bury: 0.16 },
    { lumpScale: 1.7, lumpAmount: 0.24, detailScale: 6.8, detailAmount: 0.06, squash: 0.6, stretch: 1.05, bury: 0.26 },
];

export function createRockGeometry(variant: number): THREE.BufferGeometry {
    const shape = ROCK_SHAPES[variant % ROCK_SHAPES.length];
    const seed = 4400 + variant * 977;
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    const position = geometry.getAttribute("position");

    const vertex = new THREE.Vector3();

    for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i).normalize();

        const lump = valueNoise3(
            vertex.x * shape.lumpScale + 8,
            vertex.y * shape.lumpScale + 8,
            vertex.z * shape.lumpScale + 8,
            seed
        ) - 0.5;

        const detail = valueNoise3(
            vertex.x * shape.detailScale + 40,
            vertex.y * shape.detailScale + 40,
            vertex.z * shape.detailScale + 40,
            seed + 313
        ) - 0.5;

        const radius = 1 + lump * shape.lumpAmount * 2 + detail * shape.detailAmount * 2;

        let x = vertex.x * radius * shape.stretch;
        let y = vertex.y * radius * shape.squash;
        let z = vertex.z * radius;

        const floor = -0.5 + shape.bury;
        if (y < floor) y = floor + (y - floor) * 0.18;

        position.setXYZ(i, x, y, z);
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.translate(0, 0.5 * shape.squash - shape.bury * 0.5, 0);

    return combine([paint(geometry, new THREE.Color(0x3b3833), new THREE.Color(0x8a8478), 1.4, -0.2)]);
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
