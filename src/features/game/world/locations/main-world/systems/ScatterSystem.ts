// src/features/game/world/locations/main-world/systems/ScatterSystem.ts
import * as THREE from "three";
import { createRandom } from "../utils/worldNoise";
import { createRockGeometry, createTreeGeometry } from "../utils/proceduralFlora";
import type { TerrainSystem } from "./TerrainSystem";
import {
    CAVE_PORTAL_X,
    CAVE_PORTAL_Z,
    CHUNKS_PER_SIDE,
    CHUNK_SIZE,
    SAFE_ZONE_RADIUS,
    TOWER_FLAT_RADIUS,
    TOWER_X,
    TOWER_Z,
    VIEW_CHUNK_RADIUS,
    WORLD_HALF,
    WORLD_SEED,
} from "../worldConfig";

const TREE_VARIANTS = 2;
const ROCK_VARIANTS = 2;
const TREE_CANDIDATES_PER_CHUNK = 90;
const ROCK_CANDIDATES_PER_CHUNK = 70;
const MAX_TREE_INSTANCES = 1500;
const MAX_ROCK_INSTANCES = 1100;

interface PropInstance {
    x: number;
    y: number;
    z: number;
    scale: number;
    rotation: number;
    variant: number;
}

interface ChunkProps {
    trees: PropInstance[];
    rocks: PropInstance[];
}

export class ScatterSystem {
    private readonly chunkCache = new Map<string, ChunkProps>();
    private readonly treeMeshes: THREE.InstancedMesh[] = [];
    private readonly rockMeshes: THREE.InstancedMesh[] = [];
    private readonly matrix = new THREE.Matrix4();
    private readonly quaternion = new THREE.Quaternion();
    private readonly position = new THREE.Vector3();
    private readonly scale = new THREE.Vector3();
    private readonly euler = new THREE.Euler();

    private colliders: THREE.Box3[] = [];
    private lastChunkX = Number.NaN;
    private lastChunkZ = Number.NaN;

    public onCollidersChanged: (() => void) | null = null;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly terrain: TerrainSystem,
        private readonly lowEnd: boolean
    ) { }

    public create() {
        const treeMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.88,
            metalness: 0,
            flatShading: true,
        });

        const rockMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.95,
            metalness: 0.02,
            flatShading: true,
        });

        for (let variant = 0; variant < TREE_VARIANTS; variant++) {
            const mesh = new THREE.InstancedMesh(createTreeGeometry(variant), treeMaterial, MAX_TREE_INSTANCES);
            mesh.name = `trees-${variant}`;
            mesh.castShadow = !this.lowEnd;
            mesh.receiveShadow = true;
            mesh.count = 0;
            mesh.frustumCulled = false;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            this.scene.add(mesh);
            this.treeMeshes.push(mesh);
        }

        for (let variant = 0; variant < ROCK_VARIANTS; variant++) {
            const mesh = new THREE.InstancedMesh(createRockGeometry(variant), rockMaterial, MAX_ROCK_INSTANCES);
            mesh.name = `rocks-${variant}`;
            mesh.castShadow = !this.lowEnd;
            mesh.receiveShadow = true;
            mesh.count = 0;
            mesh.frustumCulled = false;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            this.scene.add(mesh);
            this.rockMeshes.push(mesh);
        }
    }

    public getColliders(): THREE.Box3[] {
        return this.colliders;
    }

    public update(playerX: number, playerZ: number) {
        const chunkX = Math.floor((playerX + WORLD_HALF) / CHUNK_SIZE);
        const chunkZ = Math.floor((playerZ + WORLD_HALF) / CHUNK_SIZE);
        if (chunkX === this.lastChunkX && chunkZ === this.lastChunkZ) return;

        this.lastChunkX = chunkX;
        this.lastChunkZ = chunkZ;
        this.rebuild(chunkX, chunkZ);
    }

    private rebuild(centerChunkX: number, centerChunkZ: number) {
        const trees: PropInstance[][] = this.treeMeshes.map(() => []);
        const rocks: PropInstance[][] = this.rockMeshes.map(() => []);
        this.colliders = [];

        for (let cx = centerChunkX - VIEW_CHUNK_RADIUS; cx <= centerChunkX + VIEW_CHUNK_RADIUS; cx++) {
            for (let cz = centerChunkZ - VIEW_CHUNK_RADIUS; cz <= centerChunkZ + VIEW_CHUNK_RADIUS; cz++) {
                if (cx < 0 || cz < 0 || cx >= CHUNKS_PER_SIDE || cz >= CHUNKS_PER_SIDE) continue;

                const props = this.getChunkProps(cx, cz);

                for (const tree of props.trees) {
                    const bucket = trees[tree.variant];
                    if (bucket.length >= MAX_TREE_INSTANCES) continue;
                    bucket.push(tree);
                    this.colliders.push(this.makeCollider(tree, 0.55, 5.5));
                }

                for (const rock of props.rocks) {
                    const bucket = rocks[rock.variant];
                    if (bucket.length >= MAX_ROCK_INSTANCES) continue;
                    bucket.push(rock);
                    if (rock.scale > 1.5) this.colliders.push(this.makeCollider(rock, rock.scale * 0.75, rock.scale * 0.9));
                }
            }
        }

        this.treeMeshes.forEach((mesh, index) => this.applyInstances(mesh, trees[index]));
        this.rockMeshes.forEach((mesh, index) => this.applyInstances(mesh, rocks[index]));

        this.onCollidersChanged?.();
    }

    private makeCollider(prop: PropInstance, radius: number, height: number): THREE.Box3 {
        return new THREE.Box3(
            new THREE.Vector3(prop.x - radius, prop.y, prop.z - radius),
            new THREE.Vector3(prop.x + radius, prop.y + height, prop.z + radius)
        );
    }

    private applyInstances(mesh: THREE.InstancedMesh, instances: PropInstance[]) {
        for (let i = 0; i < instances.length; i++) {
            const instance = instances[i];
            this.position.set(instance.x, instance.y, instance.z);
            this.euler.set(0, instance.rotation, 0);
            this.quaternion.setFromEuler(this.euler);
            this.scale.setScalar(instance.scale);
            this.matrix.compose(this.position, this.quaternion, this.scale);
            mesh.setMatrixAt(i, this.matrix);
        }

        mesh.count = instances.length;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
    }

    private getChunkProps(chunkX: number, chunkZ: number): ChunkProps {
        const key = `${chunkX},${chunkZ}`;
        const cached = this.chunkCache.get(key);
        if (cached) return cached;

        const random = createRandom(WORLD_SEED + chunkX * 73856093 + chunkZ * 19349663);
        const originX = -WORLD_HALF + chunkX * CHUNK_SIZE;
        const originZ = -WORLD_HALF + chunkZ * CHUNK_SIZE;

        const props: ChunkProps = { trees: [], rocks: [] };
        const treeCount = this.lowEnd ? TREE_CANDIDATES_PER_CHUNK / 2 : TREE_CANDIDATES_PER_CHUNK;
        const rockCount = this.lowEnd ? ROCK_CANDIDATES_PER_CHUNK / 2 : ROCK_CANDIDATES_PER_CHUNK;

        for (let i = 0; i < treeCount; i++) {
            const x = originX + random() * CHUNK_SIZE;
            const z = originZ + random() * CHUNK_SIZE;
            if (!this.isPlantable(x, z, 2.6, 34, 0.3)) continue;

            props.trees.push({
                x,
                y: this.terrain.getHeightAt(x, z) - 0.2,
                z,
                scale: 0.75 + random() * 0.75,
                rotation: random() * Math.PI * 2,
                variant: Math.floor(random() * TREE_VARIANTS) % TREE_VARIANTS,
            });
        }

        for (let i = 0; i < rockCount; i++) {
            const x = originX + random() * CHUNK_SIZE;
            const z = originZ + random() * CHUNK_SIZE;
            if (!this.isPlantable(x, z, 0.4, 60, 0.62)) continue;

            props.rocks.push({
                x,
                y: this.terrain.getHeightAt(x, z) - 0.25,
                z,
                scale: 0.6 + random() * 2.1,
                rotation: random() * Math.PI * 2,
                variant: Math.floor(random() * ROCK_VARIANTS) % ROCK_VARIANTS,
            });
        }

        this.chunkCache.set(key, props);
        return props;
    }

    private isPlantable(x: number, z: number, minHeight: number, maxHeight: number, maxSlope: number): boolean {
        const height = this.terrain.getHeightAt(x, z);
        if (height < minHeight || height > maxHeight) return false;
        if (this.terrain.getSlopeAt(x, z) > maxSlope) return false;

        const spawnDistance = Math.sqrt(x * x + z * z);
        if (spawnDistance < SAFE_ZONE_RADIUS + 5) return false;

        const towerDistance = Math.sqrt((x - TOWER_X) ** 2 + (z - TOWER_Z) ** 2);
        if (towerDistance < TOWER_FLAT_RADIUS * 0.8) return false;

        const portalDistance = Math.sqrt((x - CAVE_PORTAL_X) ** 2 + (z - CAVE_PORTAL_Z) ** 2);
        if (portalDistance < 16) return false;

        for (const lake of this.terrain.lakes) {
            const dx = x - lake.x;
            const dz = z - lake.z;
            if (dx * dx + dz * dz < lake.radius * lake.radius && height < lake.level + 0.5) return false;
        }

        return true;
    }

    public dispose() {
        for (const mesh of [...this.treeMeshes, ...this.rockMeshes]) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.dispose();
        }

        const materials = new Set<THREE.Material>();
        this.treeMeshes.forEach((mesh) => materials.add(mesh.material as THREE.Material));
        this.rockMeshes.forEach((mesh) => materials.add(mesh.material as THREE.Material));
        materials.forEach((material) => material.dispose());

        this.treeMeshes.length = 0;
        this.rockMeshes.length = 0;
        this.chunkCache.clear();
        this.colliders = [];
    }
}
