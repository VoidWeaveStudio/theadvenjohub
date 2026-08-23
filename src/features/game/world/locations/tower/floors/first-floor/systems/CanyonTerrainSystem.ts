// src/features/game/world/locations/tower/floors/first-floor/systems/CanyonTerrainSystem.ts
import * as THREE from "three";
import { CanyonBiome } from "../utils/canyonBiomes";
import {
    acquireCanyonTextures,
    createCanyonTerrainMaterial,
    releaseCanyonTextures,
    type CanyonTerrainTextures,
} from "../utils/canyonRockMaterial";
import {
    canyonHeight,
    terrainCenterX,
    wallCrestHeight,
    wallFootDistance,
    WALL_OUTER_RUN,
} from "../utils/canyonTerrain";

const WALL_OFFSETS_HQ = [0.8, 1.8, 3, 4.5, 6.2, 8.2, 10.6, 13.4, 16.8, 21, 26, 32, 40, 50, WALL_OUTER_RUN];
const WALL_OFFSETS_LQ = [2.2, 5, 9, 14.5, 22, 32, 46, WALL_OUTER_RUN];

const CORRIDOR_COLUMNS_HQ = 25;
const CORRIDOR_COLUMNS_LQ = 11;

const ROW_STEP_HQ = 2.6;
const ROW_STEP_LQ = 6.4;

const COLLIDER_SLICE = 10;
const COLLIDER_FLOOR_Y = -6;

export interface CanyonStrip {
    mesh: THREE.Mesh;
    colliders: THREE.Box3[];
}

interface Column {
    side: -1 | 0 | 1;
    t: number;
    offset: number;
}

function buildColumns(highQuality: boolean): Column[] {
    const offsets = highQuality ? WALL_OFFSETS_HQ : WALL_OFFSETS_LQ;
    const corridor = highQuality ? CORRIDOR_COLUMNS_HQ : CORRIDOR_COLUMNS_LQ;
    const columns: Column[] = [];

    for (let i = offsets.length - 1; i >= 0; i--) {
        columns.push({ side: -1, t: 0, offset: offsets[i] });
    }

    for (let i = 0; i < corridor; i++) {
        columns.push({ side: 0, t: (i / (corridor - 1)) * 2 - 1, offset: 0 });
    }

    for (const offset of offsets) {
        columns.push({ side: 1, t: 0, offset });
    }

    return columns;
}

export class CanyonTerrainSystem {
    private readonly columns: Column[];
    private readonly rowStep: number;
    private readonly textures: CanyonTerrainTextures;
    private readonly materials = new Map<string, THREE.MeshStandardMaterial>();
    private readonly instancedMaterials = new Map<string, THREE.MeshStandardMaterial>();

    constructor(private readonly highQuality: boolean) {
        this.columns = buildColumns(highQuality);
        this.rowStep = highQuality ? ROW_STEP_HQ : ROW_STEP_LQ;
        this.textures = acquireCanyonTextures();
    }

    public getMaterial(biome: CanyonBiome): THREE.MeshStandardMaterial {
        const cached = this.materials.get(biome.key);
        if (cached) return cached;

        const material = createCanyonTerrainMaterial(biome, this.textures, this.highQuality);
        this.materials.set(biome.key, material);
        return material;
    }

    public getInstancedMaterial(biome: CanyonBiome): THREE.MeshStandardMaterial {
        const cached = this.instancedMaterials.get(biome.key);
        if (cached) return cached;

        const material = createCanyonTerrainMaterial(biome, this.textures, this.highQuality, 0);
        this.instancedMaterials.set(biome.key, material);
        return material;
    }

    public getUniform(biome: CanyonBiome, name: string): number | null {
        const uniforms = this.getMaterial(biome).userData.canyonUniforms as Record<string, THREE.IUniform> | undefined;
        const uniform = uniforms?.[name];
        return typeof uniform?.value === "number" ? uniform.value : null;
    }

    public setUniform(biome: CanyonBiome, name: string, value: number) {
        for (const material of [this.getMaterial(biome), this.getInstancedMaterial(biome)]) {
            const uniforms = material.userData.canyonUniforms as Record<string, THREE.IUniform> | undefined;
            const uniform = uniforms?.[name];
            if (uniform) uniform.value = value;
        }
    }

    public isOwnedMaterial(material: THREE.Material): boolean {
        for (const cached of this.materials.values()) if (cached === material) return true;
        for (const cached of this.instancedMaterials.values()) if (cached === material) return true;
        return false;
    }

    public build(startZ: number, endZ: number, biome: CanyonBiome): CanyonStrip {
        const length = endZ - startZ;
        const rows = Math.max(2, Math.round(length / this.rowStep) + 1);
        const columnCount = this.columns.length;

        const positions = new Float32Array(rows * columnCount * 3);
        const indices = new Uint32Array((rows - 1) * (columnCount - 1) * 6);

        let vertex = 0;
        for (let r = 0; r < rows; r++) {
            const z = startZ + (length * r) / (rows - 1);
            const centerX = terrainCenterX(z);
            const footLeft = wallFootDistance(z, -1);
            const footRight = wallFootDistance(z, 1);

            for (let c = 0; c < columnCount; c++) {
                const column = this.columns[c];
                let x: number;

                if (column.side === 0) {
                    x = centerX + column.t * (column.t < 0 ? footLeft : footRight);
                } else {
                    const foot = column.side < 0 ? footLeft : footRight;
                    x = centerX + column.side * (foot + column.offset);
                }

                positions[vertex] = x;
                positions[vertex + 1] = canyonHeight(x, z);
                positions[vertex + 2] = z;
                vertex += 3;
            }
        }

        let index = 0;
        for (let r = 0; r < rows - 1; r++) {
            for (let c = 0; c < columnCount - 1; c++) {
                const a = r * columnCount + c;
                const b = a + 1;
                const d = a + columnCount;
                const e = d + 1;

                indices[index] = a;
                indices[index + 1] = d;
                indices[index + 2] = b;
                indices[index + 3] = b;
                indices[index + 4] = d;
                indices[index + 5] = e;
                index += 6;
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();

        const mesh = new THREE.Mesh(geometry, this.getMaterial(biome));
        mesh.castShadow = this.highQuality;
        mesh.receiveShadow = true;
        mesh.name = `canyon-terrain-${Math.round(startZ)}`;

        return { mesh, colliders: this.buildWallColliders(startZ, endZ) };
    }

    private buildWallColliders(startZ: number, endZ: number): THREE.Box3[] {
        const colliders: THREE.Box3[] = [];
        const slices = Math.max(1, Math.round((endZ - startZ) / COLLIDER_SLICE));
        const sliceDepth = (endZ - startZ) / slices;

        for (let i = 0; i < slices; i++) {
            const sliceStart = startZ + i * sliceDepth;
            const sliceEnd = sliceStart + sliceDepth;

            for (const side of [-1, 1] as const) {
                let innerX = side < 0 ? -Infinity : Infinity;
                let crest = 0;

                for (let s = 0; s <= 4; s++) {
                    const z = sliceStart + (sliceDepth * s) / 4;
                    const face = terrainCenterX(z) + side * wallFootDistance(z, side);
                    innerX = side < 0 ? Math.max(innerX, face) : Math.min(innerX, face);
                    crest = Math.max(crest, wallCrestHeight(z, side));
                }

                const outerX = innerX + side * (WALL_OUTER_RUN + 20);

                colliders.push(new THREE.Box3(
                    new THREE.Vector3(Math.min(innerX, outerX), COLLIDER_FLOOR_Y, sliceStart),
                    new THREE.Vector3(Math.max(innerX, outerX), crest + 12, sliceEnd)
                ));
            }
        }

        return colliders;
    }

    public dispose() {
        for (const material of this.materials.values()) material.dispose();
        for (const material of this.instancedMaterials.values()) material.dispose();
        this.materials.clear();
        this.instancedMaterials.clear();
        releaseCanyonTextures();
    }
}
