// src/features/game/world/locations/cave/caveMesh.ts
import * as THREE from "three";
import { fbm, valueNoise3 } from "../main-world/utils/worldNoise";
import { CAVE_FLOOR_Y, sampleCave } from "./caveLayout";

export const CAVE_CELL = 1.7;
export const CAVE_SEED = 771013;
export const WALL_SEGMENTS = 4;
const COLLIDER_DEPTH = 3;

export const CAVE_BOUNDS = {
    minX: -330,
    maxX: 330,
    minZ: -330,
    maxZ: 330,
};

export interface CaveOpenCell {
    x: number;
    z: number;
    edge: boolean;
    secretId: string | null;
    ceiling: number;
    wallX: number;
    wallZ: number;
}

export const CAVE_CHUNK = 48;

export interface CaveChunk {
    x: number;
    z: number;
    radius: number;
    geometry: THREE.BufferGeometry;
}

export interface CaveMeshResult {
    chunks: CaveChunk[];
    colliders: THREE.Box3[];
    cells: CaveOpenCell[];
}

export function caveFloorHeight(x: number, z: number): number {
    const rough = fbm(x * 0.07, z * 0.07, 3, CAVE_SEED) - 0.5;
    const swell = fbm(x * 0.018, z * 0.018, 2, CAVE_SEED + 91) - 0.5;
    return CAVE_FLOOR_Y + rough * 0.5 + swell * 1.1;
}

export function caveCeilingHeight(x: number, z: number): number {
    const headroom = sampleCave(x, z).ceiling;
    const wave = 0.85 + valueNoise3(x * 0.05, 3, z * 0.05, CAVE_SEED + 61) * 0.3;
    return caveFloorHeight(x, z) + headroom * wave;
}

export interface CaveWallPoint {
    x: number;
    y: number;
    z: number;
}

export function caveWallPoint(x: number, z: number, t: number): CaveWallPoint {
    const bottom = caveFloorHeight(x, z);
    const top = caveCeilingHeight(x, z);
    const y = bottom + (top - bottom) * t;

    const taper = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
    if (taper <= 0.0001) return { x, y, z };

    const swell = valueNoise3(x * 0.11, y * 0.09, z * 0.11, CAVE_SEED + 5) - 0.5;
    const shelf = valueNoise3(x * 0.06, y * 0.52, z * 0.06, CAVE_SEED + 407) - 0.5;
    const detail = valueNoise3(x * 0.44, y * 0.4, z * 0.44, CAVE_SEED + 129) - 0.5;
    const grain = valueNoise3(x * 0.9, y * 0.85, z * 0.9, CAVE_SEED + 733) - 0.5;

    const amount = (swell * 0.58 + shelf * 0.34 + detail * 0.2 + grain * 0.09) * taper;
    const lift = (detail * 0.42 + grain * 0.26) * taper;

    const angle = valueNoise3(x * 0.09, y * 0.07, z * 0.09, CAVE_SEED + 913) * Math.PI * 2;

    return {
        x: x + Math.cos(angle) * amount,
        y: y + lift,
        z: z + Math.sin(angle) * amount,
    };
}

export function isCaveOpen(x: number, z: number): boolean {
    return sampleCave(x, z).distance < 0;
}

function rockColor(target: number[], x: number, y: number, z: number, wet: number, shade = 1) {
    const grain = valueNoise3(x * 0.35, y * 0.35, z * 0.35, CAVE_SEED + 17);
    const vein = valueNoise3(x * 0.08, y * 0.12, z * 0.08, CAVE_SEED + 233);
    const crack = valueNoise3(x * 1.6, y * 1.4, z * 1.6, CAVE_SEED + 881);

    const base = (0.07 + grain * 0.09 + vein * 0.05) * shade * (0.82 + crack * 0.36);
    const damp = wet * 0.05 * shade;

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

    interface ChunkBuild {
        ix: number;
        iz: number;
        positions: number[];
        colors: number[];
    }

    const chunkBuilds = new Map<number, ChunkBuild>();

    const chunkAt = (x: number, z: number): ChunkBuild => {
        const cix = Math.floor(x / CAVE_CHUNK);
        const ciz = Math.floor(z / CAVE_CHUNK);
        const key = (cix << 12) ^ (ciz & 0xfff);

        let build = chunkBuilds.get(key);
        if (!build) {
            build = { ix: cix, iz: ciz, positions: [], colors: [] };
            chunkBuilds.set(key, build);
        }
        return build;
    };

    const colliders: THREE.Box3[] = [];
    const cells: CaveOpenCell[] = [];

    const half = CAVE_CELL / 2;

    const pushTriangle = (
        positions: number[],
        colors: number[],
        ax: number, ay: number, az: number,
        bx: number, by: number, bz: number,
        cx: number, cy: number, cz: number,
        wet: number,
        shade = 1
    ) => {
        positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
        rockColor(colors, ax, ay, az, wet, shade);
        rockColor(colors, bx, by, bz, wet, shade);
        rockColor(colors, cx, cy, cz, wet, shade);
    };

    const wallPush = (target: ChunkBuild, ax: number, az: number, bx: number, bz: number) => {
        const wallPositions = target.positions;
        const wallColors = target.colors;

        for (let s = 0; s < WALL_SEGMENTS; s++) {
            const t0 = s / WALL_SEGMENTS;
            const t1 = (s + 1) / WALL_SEGMENTS;

            const a0 = caveWallPoint(ax, az, t0);
            const a1 = caveWallPoint(ax, az, t1);
            const b0 = caveWallPoint(bx, bz, t0);
            const b1 = caveWallPoint(bx, bz, t1);

            const mid = (t0 + t1) * 0.5;
            const wet = 0.95 - mid * 0.75;
            const shade = 0.5 + Math.sin(mid * Math.PI) * 0.62;

            pushTriangle(wallPositions, wallColors,
                a0.x, a0.y, a0.z,
                a1.x, a1.y, a1.z,
                b0.x, b0.y, b0.z, wet, shade);
            pushTriangle(wallPositions, wallColors,
                a1.x, a1.y, a1.z,
                b1.x, b1.y, b1.z,
                b0.x, b0.y, b0.z, wet, shade);
        }
    };

    for (let iz = 0; iz < rows; iz++) {
        for (let ix = 0; ix < cols; ix++) {
            const slot = index(ix, iz);
            const cx = worldX(ix);
            const cz = worldZ(iz);

            if (!open[slot]) {
                let neighbourOpen = false;

                for (let dz = -COLLIDER_DEPTH; dz <= COLLIDER_DEPTH && !neighbourOpen; dz++) {
                    for (let dx = -COLLIDER_DEPTH; dx <= COLLIDER_DEPTH; dx++) {
                        const nx = ix + dx;
                        const nz = iz + dz;
                        if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
                        if (!open[index(nx, nz)]) continue;
                        neighbourOpen = true;
                        break;
                    }
                }

                if (neighbourOpen) {
                    const floorY = caveFloorHeight(cx, cz);
                    colliders.push(new THREE.Box3(
                        new THREE.Vector3(cx - half, floorY - 5, cz - half),
                        new THREE.Vector3(cx + half, floorY + 16, cz + half)
                    ));
                }
                continue;
            }

            const x0 = cx - half;
            const x1 = cx + half;
            const z0 = cz - half;
            const z1 = cz + half;

            const chunk = chunkAt(cx, cz);
            const chunkPositions = chunk.positions;
            const chunkColors = chunk.colors;

            const h00 = caveFloorHeight(x0, z0);
            const h10 = caveFloorHeight(x1, z0);
            const h01 = caveFloorHeight(x0, z1);
            const h11 = caveFloorHeight(x1, z1);

            pushTriangle(chunkPositions, chunkColors, x0, h00, z0, x0, h01, z1, x1, h10, z0, 0.35);
            pushTriangle(chunkPositions, chunkColors, x1, h10, z0, x0, h01, z1, x1, h11, z1, 0.35);

            const ceiling = ceilings[slot];
            const c00 = caveCeilingHeight(x0, z0);
            const c10 = caveCeilingHeight(x1, z0);
            const c01 = caveCeilingHeight(x0, z1);
            const c11 = caveCeilingHeight(x1, z1);

            pushTriangle(chunkPositions, chunkColors, x0, c00, z0, x1, c10, z0, x0, c01, z1, 0);
            pushTriangle(chunkPositions, chunkColors, x1, c10, z0, x1, c11, z1, x0, c01, z1, 0);

            let edge = false;
            let wallX = 0;
            let wallZ = 0;

            if (ix > 0 && !open[index(ix - 1, iz)]) {
                wallPush(chunk, x0, z0, x0, z1);
                edge = true;
                wallX = -1;
            }
            if (ix < cols - 1 && !open[index(ix + 1, iz)]) {
                wallPush(chunk, x1, z1, x1, z0);
                edge = true;
                wallX = 1;
            }
            if (iz > 0 && !open[index(ix, iz - 1)]) {
                wallPush(chunk, x1, z0, x0, z0);
                edge = true;
                wallZ = -1;
            }
            if (iz < rows - 1 && !open[index(ix, iz + 1)]) {
                wallPush(chunk, x0, z1, x1, z1);
                edge = true;
                wallZ = 1;
            }

            cells.push({ x: cx, z: cz, edge, secretId: secrets[slot], ceiling, wallX, wallZ });
        }
    }

    const chunks: CaveChunk[] = [];

    for (const build of chunkBuilds.values()) {
        if (build.positions.length === 0) continue;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(build.positions, 3));
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(build.colors, 3));
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();

        const sphere = geometry.boundingSphere;
        chunks.push({
            x: build.ix * CAVE_CHUNK + CAVE_CHUNK / 2,
            z: build.iz * CAVE_CHUNK + CAVE_CHUNK / 2,
            radius: sphere ? sphere.radius : CAVE_CHUNK,
            geometry,
        });
    }

    return { chunks, colliders, cells };
}
