// src/features/game/world/locations/cave/caveMesh.ts
import * as THREE from "three";
import { fbm, valueNoise3 } from "../main-world/utils/worldNoise";
import { CAVE_FLOOR_Y, sampleCave } from "./caveLayout";

export const CAVE_CELL = 1.7;
export const CAVE_SEED = 771013;

export const CAVE_BOUNDS = {
    minX: -112,
    maxX: 112,
    minZ: -198,
    maxZ: 30,
};

export interface CaveOpenCell {
    x: number;
    z: number;
    edge: boolean;
    secretId: string | null;
    ceiling: number;
}

export interface CaveMeshResult {
    floor: THREE.BufferGeometry;
    ceiling: THREE.BufferGeometry;
    walls: THREE.BufferGeometry;
    colliders: THREE.Box3[];
    cells: CaveOpenCell[];
}

export function caveFloorHeight(x: number, z: number): number {
    const rough = fbm(x * 0.07, z * 0.07, 3, CAVE_SEED) - 0.5;
    const swell = fbm(x * 0.018, z * 0.018, 2, CAVE_SEED + 91) - 0.5;
    return CAVE_FLOOR_Y + rough * 0.5 + swell * 1.1;
}

export function isCaveOpen(x: number, z: number): boolean {
    return sampleCave(x, z).distance < 0;
}

function rockColor(target: number[], x: number, y: number, z: number, wet: number) {
    const grain = valueNoise3(x * 0.35, y * 0.35, z * 0.35, CAVE_SEED + 17);
    const vein = valueNoise3(x * 0.08, y * 0.12, z * 0.08, CAVE_SEED + 233);

    const base = 0.07 + grain * 0.09 + vein * 0.05;
    const damp = wet * 0.05;

    target.push(base * 0.92 + damp * 0.3, base * 0.95 + damp * 0.6, base + damp);
}

export function buildCaveMesh(): CaveMeshResult {
    const cols = Math.ceil((CAVE_BOUNDS.maxX - CAVE_BOUNDS.minX) / CAVE_CELL);
    const rows = Math.ceil((CAVE_BOUNDS.maxZ - CAVE_BOUNDS.minZ) / CAVE_CELL);

    const open = new Uint8Array(cols * rows);
    const ceilings = new Float32Array(cols * rows);
    const secrets: (string | null)[] = new Array(cols * rows).fill(null);

    const worldX = (ix: number) => CAVE_BOUNDS.minX + ix * CAVE_CELL;
    const worldZ = (iz: number) => CAVE_BOUNDS.minZ + iz * CAVE_CELL;
    const index = (ix: number, iz: number) => iz * cols + ix;

    for (let iz = 0; iz < rows; iz++) {
        for (let ix = 0; ix < cols; ix++) {
            const sample = sampleCave(worldX(ix), worldZ(iz));
            const slot = index(ix, iz);
            if (sample.distance < 0) open[slot] = 1;
            ceilings[slot] = sample.ceiling;
            secrets[slot] = sample.secretId;
        }
    }

    const floorPositions: number[] = [];
    const floorColors: number[] = [];
    const ceilingPositions: number[] = [];
    const ceilingColors: number[] = [];
    const wallPositions: number[] = [];
    const wallColors: number[] = [];

    const colliders: THREE.Box3[] = [];
    const cells: CaveOpenCell[] = [];

    const half = CAVE_CELL / 2;

    const pushTriangle = (
        positions: number[],
        colors: number[],
        ax: number, ay: number, az: number,
        bx: number, by: number, bz: number,
        cx: number, cy: number, cz: number,
        wet: number
    ) => {
        positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
        rockColor(colors, ax, ay, az, wet);
        rockColor(colors, bx, by, bz, wet);
        rockColor(colors, cx, cy, cz, wet);
    };

    const wallPush = (
        ax: number, az: number, bx: number, bz: number,
        outX: number, outZ: number, ceiling: number
    ) => {
        const bulgeA = valueNoise3(ax * 0.12, 0, az * 0.12, CAVE_SEED + 5) * 0.55;
        const bulgeB = valueNoise3(bx * 0.12, 0, bz * 0.12, CAVE_SEED + 5) * 0.55;

        const a0x = ax + outX * bulgeA;
        const a0z = az + outZ * bulgeA;
        const b0x = bx + outX * bulgeB;
        const b0z = bz + outZ * bulgeB;

        const topA = caveFloorHeight(ax, az) + ceiling * (0.85 + valueNoise3(ax * 0.05, 3, az * 0.05, CAVE_SEED + 61) * 0.3);
        const topB = caveFloorHeight(bx, bz) + ceiling * (0.85 + valueNoise3(bx * 0.05, 3, bz * 0.05, CAVE_SEED + 61) * 0.3);
        const bottomA = caveFloorHeight(ax, az) - 1.6;
        const bottomB = caveFloorHeight(bx, bz) - 1.6;

        pushTriangle(wallPositions, wallColors,
            a0x, bottomA, a0z,
            b0x, bottomB, b0z,
            a0x, topA, a0z, 0.9);
        pushTriangle(wallPositions, wallColors,
            b0x, bottomB, b0z,
            b0x, topB, b0z,
            a0x, topA, a0z, 0.6);
    };

    for (let iz = 0; iz < rows; iz++) {
        for (let ix = 0; ix < cols; ix++) {
            const slot = index(ix, iz);
            const cx = worldX(ix);
            const cz = worldZ(iz);

            if (!open[slot]) {
                const neighbourOpen =
                    (ix > 0 && open[index(ix - 1, iz)]) ||
                    (ix < cols - 1 && open[index(ix + 1, iz)]) ||
                    (iz > 0 && open[index(ix, iz - 1)]) ||
                    (iz < rows - 1 && open[index(ix, iz + 1)]);

                if (neighbourOpen) {
                    const floorY = caveFloorHeight(cx, cz);
                    colliders.push(new THREE.Box3(
                        new THREE.Vector3(cx - half, floorY - 4, cz - half),
                        new THREE.Vector3(cx + half, floorY + ceilings[slot] + 6, cz + half)
                    ));
                }
                continue;
            }

            const x0 = cx - half;
            const x1 = cx + half;
            const z0 = cz - half;
            const z1 = cz + half;

            const h00 = caveFloorHeight(x0, z0);
            const h10 = caveFloorHeight(x1, z0);
            const h01 = caveFloorHeight(x0, z1);
            const h11 = caveFloorHeight(x1, z1);

            pushTriangle(floorPositions, floorColors, x0, h00, z0, x0, h01, z1, x1, h10, z0, 0.35);
            pushTriangle(floorPositions, floorColors, x1, h10, z0, x0, h01, z1, x1, h11, z1, 0.35);

            const ceiling = ceilings[slot];
            const c00 = h00 + ceiling * (0.85 + valueNoise3(x0 * 0.05, 3, z0 * 0.05, CAVE_SEED + 61) * 0.3);
            const c10 = h10 + ceiling * (0.85 + valueNoise3(x1 * 0.05, 3, z0 * 0.05, CAVE_SEED + 61) * 0.3);
            const c01 = h01 + ceiling * (0.85 + valueNoise3(x0 * 0.05, 3, z1 * 0.05, CAVE_SEED + 61) * 0.3);
            const c11 = h11 + ceiling * (0.85 + valueNoise3(x1 * 0.05, 3, z1 * 0.05, CAVE_SEED + 61) * 0.3);

            pushTriangle(ceilingPositions, ceilingColors, x0, c00, z0, x1, c10, z0, x0, c01, z1, 0);
            pushTriangle(ceilingPositions, ceilingColors, x1, c10, z0, x1, c11, z1, x0, c01, z1, 0);

            let edge = false;
            if (ix > 0 && !open[index(ix - 1, iz)]) {
                wallPush(x0, z0, x0, z1, -1, 0, ceiling);
                edge = true;
            }
            if (ix < cols - 1 && !open[index(ix + 1, iz)]) {
                wallPush(x1, z1, x1, z0, 1, 0, ceiling);
                edge = true;
            }
            if (iz > 0 && !open[index(ix, iz - 1)]) {
                wallPush(x1, z0, x0, z0, 0, -1, ceiling);
                edge = true;
            }
            if (iz < rows - 1 && !open[index(ix, iz + 1)]) {
                wallPush(x0, z1, x1, z1, 0, 1, ceiling);
                edge = true;
            }

            cells.push({ x: cx, z: cz, edge, secretId: secrets[slot], ceiling });
        }
    }

    const make = (positions: number[], colors: number[]) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        return geometry;
    };

    return {
        floor: make(floorPositions, floorColors),
        ceiling: make(ceilingPositions, ceilingColors),
        walls: make(wallPositions, wallColors),
        colliders,
        cells,
    };
}
