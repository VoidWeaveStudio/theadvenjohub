// src/features/game/world/locations/main-world/systems/TerrainSystem.ts
import * as THREE from "three";
import { fbm, smoothstep } from "../utils/worldNoise";
import {
    CHUNKS_PER_SIDE,
    CHUNK_SEGMENTS,
    CHUNK_SIZE,
    LAKES,
    SAFE_ZONE_RADIUS,
    SEABED_DEPTH,
    SHORE_RADIUS,
    SPAWN_FLAT_RADIUS,
    TOWER_FLAT_RADIUS,
    TOWER_X,
    TOWER_Z,
    VIEW_CHUNK_RADIUS,
    WORLD_HALF,
    WORLD_SEED,
} from "../worldConfig";

const INLAND_FLOOR = 1.6;
const MAX_TERRAIN_HEIGHT = 40;

export interface LakeSurface {
    x: number;
    z: number;
    radius: number;
    level: number;
}

export class TerrainSystem {
    public readonly lakes: LakeSurface[] = [];

    private readonly chunks = new Map<string, THREE.Mesh>();
    private readonly chunkColliders = new Map<string, THREE.Box3[]>();

    public onChunksChanged: (() => void) | null = null;
    private readonly material: THREE.MeshStandardMaterial;
    private lastChunkX = Number.NaN;
    private lastChunkZ = Number.NaN;

    public readonly spawnLevel: number;
    public readonly towerLevel: number;

    constructor(private readonly scene: THREE.Scene) {
        this.material = this.createMaterial();

        this.spawnLevel = this.rawHeight(0, 0);
        this.towerLevel = this.rawHeight(TOWER_X, TOWER_Z);

        for (const lake of LAKES) {
            this.lakes.push({
                x: lake.x,
                z: lake.z,
                radius: lake.radius,
                level: this.shapedHeight(lake.x, lake.z) - 1.2,
            });
        }
    }

    public getHeightAt(x: number, z: number): number {
        let height = this.shapedHeight(x, z);

        for (let i = 0; i < this.lakes.length; i++) {
            const lake = this.lakes[i];
            const dx = x - lake.x;
            const dz = z - lake.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance > lake.radius) continue;

            const basin = lake.level - LAKES[i].depth * (1 - (distance / lake.radius) ** 2);
            const blend = smoothstep(lake.radius, lake.radius * 0.72, distance);
            height = height * (1 - blend) + basin * blend;
        }

        const distanceFromCenter = Math.sqrt(x * x + z * z);
        if (distanceFromCenter > SHORE_RADIUS) {
            const drop = smoothstep(SHORE_RADIUS, SHORE_RADIUS + 46, distanceFromCenter);
            height = height * (1 - drop) + SEABED_DEPTH * drop;
        }

        return height;
    }

    public getSlopeAt(x: number, z: number): number {
        const step = 1.4;
        const hx = this.getHeightAt(x + step, z) - this.getHeightAt(x - step, z);
        const hz = this.getHeightAt(x, z + step) - this.getHeightAt(x, z - step);
        return Math.sqrt(hx * hx + hz * hz) / (2 * step);
    }

    private rawHeight(x: number, z: number): number {
        const warpX = x + (fbm(x * 0.0017 + 31.7, z * 0.0017 - 12.3, 2, WORLD_SEED + 71) - 0.5) * 190;
        const warpZ = z + (fbm(x * 0.0017 - 18.1, z * 0.0017 + 24.5, 2, WORLD_SEED + 137) - 0.5) * 190;

        let height = fbm(warpX * 0.0014, warpZ * 0.0014, 4, WORLD_SEED) * 62 - 12;
        height += (fbm(x * 0.0072, z * 0.0072, 3, WORLD_SEED + 401) - 0.5) * 9;

        const ridge = 1 - Math.abs(fbm(x * 0.0029, z * 0.0029, 2, WORLD_SEED + 907) * 2 - 1);
        height += ridge * ridge * 16;

        if (height > 0) height = MAX_TERRAIN_HEIGHT * Math.tanh(height / MAX_TERRAIN_HEIGHT);
        return Math.max(height, INLAND_FLOOR);
    }

    private shapedHeight(x: number, z: number): number {
        let height = this.rawHeight(x, z);

        const spawnBlend = smoothstep(SPAWN_FLAT_RADIUS, SAFE_ZONE_RADIUS, Math.sqrt(x * x + z * z));
        height = height * (1 - spawnBlend) + this.spawnLevel * spawnBlend;

        const towerDistance = Math.sqrt((x - TOWER_X) ** 2 + (z - TOWER_Z) ** 2);
        const towerBlend = smoothstep(TOWER_FLAT_RADIUS, TOWER_FLAT_RADIUS * 0.55, towerDistance);
        height = height * (1 - towerBlend) + this.towerLevel * towerBlend;

        return height;
    }

    public update(playerX: number, playerZ: number) {
        const chunkX = Math.floor((playerX + WORLD_HALF) / CHUNK_SIZE);
        const chunkZ = Math.floor((playerZ + WORLD_HALF) / CHUNK_SIZE);
        if (chunkX === this.lastChunkX && chunkZ === this.lastChunkZ) return;

        this.lastChunkX = chunkX;
        this.lastChunkZ = chunkZ;
        this.stream(chunkX, chunkZ);
    }

    private stream(centerChunkX: number, centerChunkZ: number) {
        const wanted = new Set<string>();

        for (let cx = centerChunkX - VIEW_CHUNK_RADIUS; cx <= centerChunkX + VIEW_CHUNK_RADIUS; cx++) {
            for (let cz = centerChunkZ - VIEW_CHUNK_RADIUS; cz <= centerChunkZ + VIEW_CHUNK_RADIUS; cz++) {
                if (cx < 0 || cz < 0 || cx >= CHUNKS_PER_SIDE || cz >= CHUNKS_PER_SIDE) continue;

                const key = `${cx},${cz}`;
                wanted.add(key);
                if (this.chunks.has(key)) continue;

                this.chunks.set(key, this.createChunk(cx, cz, key));
            }
        }

        for (const [key, mesh] of this.chunks) {
            if (wanted.has(key)) continue;
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            this.chunks.delete(key);
            this.chunkColliders.delete(key);
        }

        this.onChunksChanged?.();
    }

    public getCameraColliders(): THREE.Box3[] {
        const result: THREE.Box3[] = [];
        for (const boxes of this.chunkColliders.values()) {
            result.push(...boxes);
        }
        return result;
    }

    private buildChunkColliders(key: string, positions: Float32Array, side: number) {
        const cells = 4;
        const boxes: THREE.Box3[] = [];

        for (let cz = 0; cz < cells; cz++) {
            for (let cx = 0; cx < cells; cx++) {
                const startX = Math.floor((cx * (side - 1)) / cells);
                const endX = Math.floor(((cx + 1) * (side - 1)) / cells);
                const startZ = Math.floor((cz * (side - 1)) / cells);
                const endZ = Math.floor(((cz + 1) * (side - 1)) / cells);

                let minX = Infinity;
                let minZ = Infinity;
                let maxX = -Infinity;
                let maxZ = -Infinity;
                let maxY = -Infinity;

                for (let iz = startZ; iz <= endZ; iz++) {
                    for (let ix = startX; ix <= endX; ix++) {
                        const offset = (iz * side + ix) * 3;
                        const x = positions[offset];
                        const y = positions[offset + 1];
                        const z = positions[offset + 2];

                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (z < minZ) minZ = z;
                        if (z > maxZ) maxZ = z;
                        if (y > maxY) maxY = y;
                    }
                }

                boxes.push(new THREE.Box3(
                    new THREE.Vector3(minX, maxY - 60, minZ),
                    new THREE.Vector3(maxX, maxY, maxZ)
                ));
            }
        }

        this.chunkColliders.set(key, boxes);
    }

    private createChunk(chunkX: number, chunkZ: number, key: string): THREE.Mesh {
        const originX = -WORLD_HALF + chunkX * CHUNK_SIZE;
        const originZ = -WORLD_HALF + chunkZ * CHUNK_SIZE;
        const step = CHUNK_SIZE / CHUNK_SEGMENTS;
        const side = CHUNK_SEGMENTS + 1;

        const positions = new Float32Array(side * side * 3);
        const indices: number[] = [];

        for (let iz = 0; iz < side; iz++) {
            for (let ix = 0; ix < side; ix++) {
                const worldX = originX + ix * step;
                const worldZ = originZ + iz * step;
                const offset = (iz * side + ix) * 3;

                positions[offset] = worldX;
                positions[offset + 1] = this.getHeightAt(worldX, worldZ);
                positions[offset + 2] = worldZ;
            }
        }

        for (let iz = 0; iz < CHUNK_SEGMENTS; iz++) {
            for (let ix = 0; ix < CHUNK_SEGMENTS; ix++) {
                const a = iz * side + ix;
                const b = a + 1;
                const c = a + side;
                const d = c + 1;
                indices.push(a, c, b, b, c, d);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();

        this.buildChunkColliders(key, positions, side);

        const mesh = new THREE.Mesh(geometry, this.material);
        mesh.name = `terrain-${key}`;
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        this.scene.add(mesh);

        return mesh;
    }

    private createMaterial(): THREE.MeshStandardMaterial {
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.96,
            metalness: 0,
        });

        material.onBeforeCompile = (shader) => {
            shader.vertexShader = `
                varying vec3 vTerrainPos;
                varying vec3 vTerrainNormal;
            ` + shader.vertexShader.replace(
                "#include <begin_vertex>",
                `
                #include <begin_vertex>
                vTerrainPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
                vTerrainNormal = normalize(mat3(modelMatrix) * normal);
                `
            );

            shader.fragmentShader = `
                varying vec3 vTerrainPos;
                varying vec3 vTerrainNormal;

                float terrainHash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }

                float terrainNoise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(
                        mix(terrainHash(i), terrainHash(i + vec2(1.0, 0.0)), u.x),
                        mix(terrainHash(i + vec2(0.0, 1.0)), terrainHash(i + vec2(1.0, 1.0)), u.x),
                        u.y
                    );
                }
            ` + shader.fragmentShader.replace(
                "#include <map_fragment>",
                `
                #include <map_fragment>

                float terrainSlope = 1.0 - clamp(vTerrainNormal.y, 0.0, 1.0);
                float terrainHeight = vTerrainPos.y;
                float grain = terrainNoise(vTerrainPos.xz * 0.09) * 0.6 + terrainNoise(vTerrainPos.xz * 0.017) * 0.4;

                vec3 sand = mix(vec3(0.70, 0.62, 0.44), vec3(0.80, 0.73, 0.55), grain);
                vec3 grass = mix(vec3(0.16, 0.30, 0.13), vec3(0.28, 0.45, 0.19), grain);
                vec3 stone = mix(vec3(0.31, 0.30, 0.29), vec3(0.47, 0.46, 0.43), grain);
                vec3 highland = mix(vec3(0.44, 0.42, 0.33), vec3(0.58, 0.55, 0.45), grain);

                vec3 terrainColor = mix(sand, grass, smoothstep(0.8, 4.2, terrainHeight));
                terrainColor = mix(terrainColor, highland, smoothstep(28.0, 46.0, terrainHeight));
                terrainColor = mix(terrainColor, stone, smoothstep(0.30, 0.58, terrainSlope));

                diffuseColor.rgb *= terrainColor;
                `
            );
        };

        return material;
    }

    public dispose() {
        for (const mesh of this.chunks.values()) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        }
        this.chunks.clear();
        this.chunkColliders.clear();
        this.material.dispose();
    }
}
