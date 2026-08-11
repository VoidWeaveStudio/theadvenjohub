// src/features/game/world/locations/tower/floors/main-hall/utils/geometryBatch.ts
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3(1, 1, 1);
const _tempScale = new THREE.Vector3(1, 1, 1);

export interface BatchOptions {
    castShadow?: boolean;
    receiveShadow?: boolean;
    renderOrder?: number;
}

export interface UvRegion {
    scaleU: number;
    scaleV: number;
    offsetU: number;
    offsetV: number;
}

function scaleUv(geometry: THREE.BufferGeometry, u: number, v: number, offsetU = 0, offsetV = 0) {
    const uv = geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
    if (!uv) return;

    for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, uv.getX(i) * u + offsetU, uv.getY(i) * v + offsetV);
    }
    uv.needsUpdate = true;
}

export function atlasRow(rows: number, index: number): UvRegion {
    return { scaleU: 1, scaleV: 1 / rows, offsetU: 0, offsetV: (rows - 1 - index) / rows };
}

export function atlasColumn(columns: number, index: number): UvRegion {
    return { scaleU: 1 / columns, scaleV: 1, offsetU: index / columns, offsetV: 0 };
}

export class GeometryBatch {
    private parts: THREE.BufferGeometry[] = [];

    get size(): number {
        return this.parts.length;
    }

    addMatrix(source: THREE.BufferGeometry, matrix: THREE.Matrix4, uvScaleU = 1, uvScaleV = 1) {
        const geometry = source.clone();
        if (uvScaleU !== 1 || uvScaleV !== 1) scaleUv(geometry, uvScaleU, uvScaleV);
        geometry.applyMatrix4(matrix);
        this.parts.push(geometry);
    }

    addPanel(
        source: THREE.BufferGeometry,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
        rotationY: number,
        region: UvRegion
    ) {
        const geometry = source.clone();
        scaleUv(geometry, region.scaleU, region.scaleV, region.offsetU, region.offsetV);

        _euler.set(0, rotationY, 0);
        _quaternion.setFromEuler(_euler);
        _position.set(x, y, z);
        _matrix.compose(_position, _quaternion, _tempScale.set(width, height, 1));
        geometry.applyMatrix4(_matrix);
        this.parts.push(geometry);
    }

    add(source: THREE.BufferGeometry, x: number, y: number, z: number, rotationY = 0, uvScaleU = 1, uvScaleV = 1) {
        _euler.set(0, rotationY, 0);
        _quaternion.setFromEuler(_euler);
        _position.set(x, y, z);
        _matrix.compose(_position, _quaternion, _scale);
        this.addMatrix(source, _matrix, uvScaleU, uvScaleV);
    }

    addScaled(
        source: THREE.BufferGeometry,
        x: number,
        y: number,
        z: number,
        scaleX: number,
        scaleY: number,
        scaleZ: number,
        rotationY = 0,
        uvScaleU = 1,
        uvScaleV = 1
    ) {
        _euler.set(0, rotationY, 0);
        _quaternion.setFromEuler(_euler);
        _position.set(x, y, z);
        _matrix.compose(_position, _quaternion, _tempScale.set(scaleX, scaleY, scaleZ));
        this.addMatrix(source, _matrix, uvScaleU, uvScaleV);
    }

    addRotated(
        source: THREE.BufferGeometry,
        x: number,
        y: number,
        z: number,
        rotationX: number,
        rotationY = 0,
        rotationZ = 0
    ) {
        _euler.set(rotationX, rotationY, rotationZ);
        _quaternion.setFromEuler(_euler);
        _position.set(x, y, z);
        _matrix.compose(_position, _quaternion, _scale);
        this.addMatrix(source, _matrix);
    }

    build(material: THREE.Material, options: BatchOptions = {}): THREE.Mesh | null {
        if (this.parts.length === 0) return null;

        const merged = mergeGeometries(this.parts, false);
        for (const part of this.parts) part.dispose();
        this.parts = [];
        if (!merged) return null;

        const mesh = new THREE.Mesh(merged, material);
        mesh.castShadow = options.castShadow ?? false;
        mesh.receiveShadow = options.receiveShadow ?? false;
        if (options.renderOrder !== undefined) mesh.renderOrder = options.renderOrder;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        return mesh;
    }
}

export function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}
