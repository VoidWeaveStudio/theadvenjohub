// src/features/game/world/locations/main-world/utils/proceduralFlora.ts
import * as THREE from "three";

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
