// src/features/game/world/locations/main-world/systems/ScatterSystem.ts
import * as THREE from "three";
import { createRandom, fbm, smoothstep } from "../utils/worldNoise";
import { loadPropSet, type PropModel } from "../utils/propModels";
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

const TREE_CANDIDATES_PER_CHUNK = 100;
const FOREST_NOISE_SCALE = 0.0085;
const ROCK_CANDIDATES_PER_CHUNK = 70;
const MAX_TREE_INSTANCES = 1500;
const MAX_ROCK_INSTANCES = 1100;

const BROADLEAF_SOURCES = [
    { url: "/models/world/tree_pack_01.glb", split: true },
    { url: "/models/world/tree_02.glb" },
];

const CONIFER_SOURCES = [
    { url: "/models/world/fir_sapling.glb" },
];

const ROCK_SOURCES = [
    { url: "/models/world/rock_07.glb" },
    { url: "/models/world/rock_09.glb" },
    { url: "/models/world/stone_01.glb" },
    { url: "/models/world/rock_moss_set_01.glb" },
];

const UNDERGROWTH_SOURCES = [
    { url: "/models/world/shrub_02.glb" },
    { url: "/models/world/shrub_03.glb" },
    { url: "/models/world/shrub_04.glb" },
    { url: "/models/world/fern_02.glb" },
    { url: "/models/world/celandine_01.glb" },
    { url: "/models/world/dandelion_01.glb" },
    { url: "/models/world/grass_medium_01.glb" },
    { url: "/models/world/grass_medium_02.glb" },
    { url: "/models/world/grass_bermuda_01.glb" },
    { url: "/models/world/tree_stump_01.glb" },
];

const UNDERGROWTH_CANDIDATES_PER_CHUNK = 150;
const MAX_UNDERGROWTH_INSTANCES = 900;
const UNDERGROWTH_MIN_SIZE = 0.55;
const UNDERGROWTH_SIZE_SPREAD = 0.85;

const TREE_MIN_HEIGHT = 7;
const TREE_HEIGHT_SPREAD = 5.5;
const ROCK_MIN_SIZE = 0.7;
const ROCK_SIZE_SPREAD = 1.9;
const ROCK_SINK = 0.24;
const UNDERGROWTH_SINK = 0.12;

interface PropInstance {
    x: number;
    y: number;
    z: number;
    scale: number;
    rotation: number;
    pick: number;
    conifer: boolean;
    tiltX: number;
    tiltZ: number;
    tint: number;
}

interface ChunkProps {
    trees: PropInstance[];
    rocks: PropInstance[];
    undergrowth: PropInstance[];
}

export class ScatterSystem {
    private readonly chunkCache = new Map<string, ChunkProps>();
    private readonly treeGroups: THREE.InstancedMesh[][] = [];
    private readonly rockGroups: THREE.InstancedMesh[][] = [];
    private readonly undergrowthGroups: THREE.InstancedMesh[][] = [];
    private readonly treeUnitScale: number[] = [];
    private coniferStart = 0;
    private readyPromise: Promise<void> = Promise.resolve();
    private readonly matrix = new THREE.Matrix4();
    private readonly quaternion = new THREE.Quaternion();
    private readonly position = new THREE.Vector3();
    private readonly scale = new THREE.Vector3();
    private readonly euler = new THREE.Euler();
    private readonly color = new THREE.Color();

    private colliders: THREE.Box3[] = [];
    private lastChunkX = Number.NaN;
    private lastChunkZ = Number.NaN;
    private pendingX = Number.NaN;
    private pendingZ = Number.NaN;

    public onCollidersChanged: (() => void) | null = null;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly terrain: TerrainSystem,
        private readonly lowEnd: boolean
    ) { }

    public create() {
        this.readyPromise = this.loadModels();
    }

    public whenReady(): Promise<void> {
        return this.readyPromise;
    }

    private async loadModels() {
        const [broadleaf, conifer, rocks, undergrowth] = await Promise.all([
            loadPropSet(BROADLEAF_SOURCES),
            loadPropSet(CONIFER_SOURCES),
            loadPropSet(ROCK_SOURCES),
            loadPropSet(UNDERGROWTH_SOURCES),
        ]);

        const trees = [...broadleaf, ...conifer];
        this.coniferStart = broadleaf.length;

        trees.forEach((model, index) => {
            this.treeGroups.push(this.buildGroup(model, `trees-${index}`, MAX_TREE_INSTANCES));
            this.treeUnitScale.push(model.height > 0.05 ? 1 / model.height : 1);
        });

        rocks.forEach((model, index) => {
            this.rockGroups.push(this.buildGroup(model, `rocks-${index}`, MAX_ROCK_INSTANCES));
        });

        undergrowth.forEach((model, index) => {
            this.undergrowthGroups.push(this.buildGroup(model, `undergrowth-${index}`, MAX_UNDERGROWTH_INSTANCES));
        });

        if (!this.hasModels()) return;

        this.lastChunkX = Number.NaN;
        this.lastChunkZ = Number.NaN;
        if (Number.isFinite(this.pendingX)) this.update(this.pendingX, this.pendingZ);
    }

    private buildGroup(model: PropModel, name: string, capacity: number): THREE.InstancedMesh[] {
        return model.parts.map((part, index) => {
            const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity);
            mesh.name = `${name}-${index}`;
            mesh.castShadow = !this.lowEnd;
            mesh.receiveShadow = true;
            mesh.count = 0;
            mesh.frustumCulled = false;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            this.scene.add(mesh);
            return mesh;
        });
    }

    public getColliders(): THREE.Box3[] {
        return this.colliders;
    }

    private hasModels(): boolean {
        return this.treeGroups.length > 0 || this.rockGroups.length > 0 || this.undergrowthGroups.length > 0;
    }

    public update(playerX: number, playerZ: number) {
        this.pendingX = playerX;
        this.pendingZ = playerZ;
        if (!this.hasModels()) return;

        const chunkX = Math.floor((playerX + WORLD_HALF) / CHUNK_SIZE);
        const chunkZ = Math.floor((playerZ + WORLD_HALF) / CHUNK_SIZE);
        if (chunkX === this.lastChunkX && chunkZ === this.lastChunkZ) return;

        this.lastChunkX = chunkX;
        this.lastChunkZ = chunkZ;
        this.rebuild(chunkX, chunkZ);
    }

    private treeBucketFor(instance: PropInstance): number {
        const total = this.treeGroups.length;
        if (total === 0) return -1;

        const coniferCount = total - this.coniferStart;
        if (instance.conifer && coniferCount > 0) {
            return this.coniferStart + Math.floor(instance.pick * coniferCount) % coniferCount;
        }

        const broadleafCount = this.coniferStart > 0 ? this.coniferStart : total;
        return Math.floor(instance.pick * broadleafCount) % broadleafCount;
    }

    private rebuild(centerChunkX: number, centerChunkZ: number) {
        const trees: PropInstance[][] = this.treeGroups.map(() => []);
        const rocks: PropInstance[][] = this.rockGroups.map(() => []);
        const undergrowth: PropInstance[][] = this.undergrowthGroups.map(() => []);
        this.colliders = [];

        for (let cx = centerChunkX - VIEW_CHUNK_RADIUS; cx <= centerChunkX + VIEW_CHUNK_RADIUS; cx++) {
            for (let cz = centerChunkZ - VIEW_CHUNK_RADIUS; cz <= centerChunkZ + VIEW_CHUNK_RADIUS; cz++) {
                if (cx < 0 || cz < 0 || cx >= CHUNKS_PER_SIDE || cz >= CHUNKS_PER_SIDE) continue;

                const props = this.getChunkProps(cx, cz);

                for (const tree of props.trees) {
                    const index = this.treeBucketFor(tree);
                    if (index < 0) continue;
                    const bucket = trees[index];
                    if (bucket.length >= MAX_TREE_INSTANCES) continue;
                    bucket.push(tree);
                    this.colliders.push(this.makeCollider(tree, 0.045 * tree.scale, 0.5 * tree.scale));
                }

                for (const rock of props.rocks) {
                    if (this.rockGroups.length === 0) continue;
                    const index = Math.floor(rock.pick * this.rockGroups.length) % this.rockGroups.length;
                    const bucket = rocks[index];
                    if (bucket.length >= MAX_ROCK_INSTANCES) continue;
                    bucket.push(rock);
                    if (rock.scale > 1.4) this.colliders.push(this.makeCollider(rock, rock.scale * 0.42, rock.scale * 0.7));
                }

                for (const plant of props.undergrowth) {
                    if (this.undergrowthGroups.length === 0) continue;
                    const index = Math.floor(plant.pick * this.undergrowthGroups.length) % this.undergrowthGroups.length;
                    const bucket = undergrowth[index];
                    if (bucket.length >= MAX_UNDERGROWTH_INSTANCES) continue;
                    bucket.push(plant);
                }
            }
        }

        this.treeGroups.forEach((group, index) => this.applyInstances(group, trees[index], this.treeUnitScale[index] ?? 1));
        this.rockGroups.forEach((group, index) => this.applyInstances(group, rocks[index]));
        this.undergrowthGroups.forEach((group, index) => this.applyInstances(group, undergrowth[index]));

        this.onCollidersChanged?.();
    }

    private makeCollider(prop: PropInstance, radius: number, height: number): THREE.Box3 {
        return new THREE.Box3(
            new THREE.Vector3(prop.x - radius, prop.y, prop.z - radius),
            new THREE.Vector3(prop.x + radius, prop.y + height, prop.z + radius)
        );
    }

    private applyInstances(group: THREE.InstancedMesh[], instances: PropInstance[], unitScale = 1) {
        for (let i = 0; i < instances.length; i++) {
            const instance = instances[i];
            this.position.set(instance.x, instance.y, instance.z);
            this.euler.set(instance.tiltX, instance.rotation, instance.tiltZ);
            this.quaternion.setFromEuler(this.euler);
            this.scale.setScalar(instance.scale * unitScale);
            this.matrix.compose(this.position, this.quaternion, this.scale);

            const tint = instance.tint;
            this.color.setRGB(0.9 + tint * 0.16, 0.92 + tint * 0.12, 0.88 + tint * 0.18);

            for (const mesh of group) {
                mesh.setMatrixAt(i, this.matrix);
                mesh.setColorAt(i, this.color);
            }
        }

        for (const mesh of group) {
            mesh.count = instances.length;
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            mesh.computeBoundingSphere();
        }
    }

    private getChunkProps(chunkX: number, chunkZ: number): ChunkProps {
        const key = `${chunkX},${chunkZ}`;
        const cached = this.chunkCache.get(key);
        if (cached) return cached;

        const random = createRandom(WORLD_SEED + chunkX * 73856093 + chunkZ * 19349663);
        const originX = -WORLD_HALF + chunkX * CHUNK_SIZE;
        const originZ = -WORLD_HALF + chunkZ * CHUNK_SIZE;

        const props: ChunkProps = { trees: [], rocks: [], undergrowth: [] };
        const treeCount = this.lowEnd ? TREE_CANDIDATES_PER_CHUNK / 2 : TREE_CANDIDATES_PER_CHUNK;
        const rockCount = this.lowEnd ? ROCK_CANDIDATES_PER_CHUNK / 2 : ROCK_CANDIDATES_PER_CHUNK;

        for (let i = 0; i < treeCount; i++) {
            const x = originX + random() * CHUNK_SIZE;
            const z = originZ + random() * CHUNK_SIZE;
            if (!this.isPlantable(x, z, 2.6, 34, 0.3)) continue;

            const grove = fbm(x * FOREST_NOISE_SCALE, z * FOREST_NOISE_SCALE, 3, WORLD_SEED + 4477);
            const density = smoothstep(0.44, 0.7, grove);
            if (random() > density) continue;

            const height = this.terrain.getHeightAt(x, z);

            props.trees.push({
                x,
                y: height - 0.15,
                z,
                scale: TREE_MIN_HEIGHT + random() * TREE_HEIGHT_SPREAD,
                rotation: random() * Math.PI * 2,
                pick: random(),
                conifer: height > 18 || grove > 0.72,
                tiltX: (random() - 0.5) * 0.06,
                tiltZ: (random() - 0.5) * 0.06,
                tint: random(),
            });
        }

        for (let i = 0; i < rockCount; i++) {
            const x = originX + random() * CHUNK_SIZE;
            const z = originZ + random() * CHUNK_SIZE;
            if (!this.isPlantable(x, z, 0.4, 60, 0.62)) continue;

            const rockSize = ROCK_MIN_SIZE + random() * ROCK_SIZE_SPREAD;

            props.rocks.push({
                x,
                y: this.terrain.getHeightAt(x, z) - rockSize * ROCK_SINK,
                z,
                scale: rockSize,
                rotation: random() * Math.PI * 2,
                pick: random(),
                conifer: false,
                tiltX: (random() - 0.5) * 0.14,
                tiltZ: (random() - 0.5) * 0.14,
                tint: random(),
            });
        }

        const plantCount = this.lowEnd ? UNDERGROWTH_CANDIDATES_PER_CHUNK / 2 : UNDERGROWTH_CANDIDATES_PER_CHUNK;

        for (let i = 0; i < plantCount; i++) {
            const x = originX + random() * CHUNK_SIZE;
            const z = originZ + random() * CHUNK_SIZE;
            if (!this.isPlantable(x, z, 1.2, 40, 0.42)) continue;

            const glade = fbm(x * FOREST_NOISE_SCALE * 1.6, z * FOREST_NOISE_SCALE * 1.6, 3, WORLD_SEED + 8123);
            if (random() > smoothstep(0.3, 0.68, glade)) continue;

            const plantSize = UNDERGROWTH_MIN_SIZE + random() * UNDERGROWTH_SIZE_SPREAD;

            props.undergrowth.push({
                x,
                y: this.terrain.getHeightAt(x, z) - plantSize * UNDERGROWTH_SINK,
                z,
                scale: plantSize,
                rotation: random() * Math.PI * 2,
                pick: random(),
                conifer: false,
                tiltX: (random() - 0.5) * 0.12,
                tiltZ: (random() - 0.5) * 0.12,
                tint: random(),
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
        const materials = new Set<THREE.Material>();

        for (const group of [...this.treeGroups, ...this.rockGroups, ...this.undergrowthGroups]) {
            for (const mesh of group) {
                this.scene.remove(mesh);
                materials.add(mesh.material as THREE.Material);
                mesh.geometry.dispose();
                mesh.dispose();
            }
        }

        materials.forEach((material) => {
            const standard = material as THREE.MeshStandardMaterial;
            standard.map?.dispose();
            standard.normalMap?.dispose();
            standard.roughnessMap?.dispose();
            standard.aoMap?.dispose();
            material.dispose();
        });

        this.treeGroups.length = 0;
        this.treeUnitScale.length = 0;
        this.rockGroups.length = 0;
        this.undergrowthGroups.length = 0;
        this.chunkCache.clear();
        this.colliders = [];
    }
}
