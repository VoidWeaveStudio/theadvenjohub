// src/features/game/world/locations/main-world/systems/UndergrowthSystem.ts
import * as THREE from "three";
import { loadPropSet, type PropModel } from "../utils/propModels";
import { createRandom, fbm, smoothstep } from "../utils/worldNoise";
import type { TerrainSystem } from "./TerrainSystem";
import {
    CAVE_PORTAL_X,
    CAVE_PORTAL_Z,
    CHUNKS_PER_SIDE,
    CHUNK_SIZE,
    SAFE_ZONE_RADIUS,
    SEA_LEVEL,
    insideTowerPlaza,
    TOWER_FLAT_RADIUS,
    TOWER_X,
    TOWER_Z,
    WORLD_HALF,
    WORLD_SEED,
} from "../worldConfig";

const VIEW_CHUNK_RADIUS = 2;

const ROCK_SOURCES = [
    { url: "/models/world/rock_07.glb" },
    { url: "/models/world/rock_09.glb" },
    { url: "/models/world/stone_01.glb" },
    { url: "/models/world/rock_moss_set_01.glb" },
];

const PLANT_SOURCES = [
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

const ROCK_CANDIDATES = 46;
const PLANT_CANDIDATES = 160;
const MAX_ROCKS = 700;
const MAX_PLANTS = 1100;

const ROCK_MIN_SIZE = 0.7;
const ROCK_SIZE_SPREAD = 1.9;
const ROCK_SINK = 0.24;
const PLANT_MIN_SIZE = 0.55;
const PLANT_SIZE_SPREAD = 0.85;
const PLANT_SINK = 0.12;
const WATER_MARGIN = 5;
const SHORE_CLEARANCE = 0.6;

interface PropInstance {
    x: number;
    y: number;
    z: number;
    scale: number;
    rotation: number;
    pick: number;
    tiltX: number;
    tiltZ: number;
    tint: number;
}

interface ChunkProps {
    rocks: PropInstance[];
    plants: PropInstance[];
}

export class UndergrowthSystem {
    private readonly chunkCache = new Map<string, ChunkProps>();
    private readonly rockGroups: THREE.InstancedMesh[][] = [];
    private readonly plantGroups: THREE.InstancedMesh[][] = [];

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
    private readyPromise: Promise<void> = Promise.resolve();

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

    public getColliders(): THREE.Box3[] {
        return this.colliders;
    }

    private async loadModels() {
        const [rocks, plants] = await Promise.all([
            loadPropSet(ROCK_SOURCES),
            loadPropSet(PLANT_SOURCES),
        ]);

        rocks.forEach((model, index) => {
            this.rockGroups.push(this.buildGroup(model, `rocks-${index}`, this.capacity(MAX_ROCKS)));
        });

        plants.forEach((model, index) => {
            this.plantGroups.push(this.buildGroup(model, `plants-${index}`, this.capacity(MAX_PLANTS)));
        });

        if (this.rockGroups.length === 0 && this.plantGroups.length === 0) return;

        this.lastChunkX = Number.NaN;
        this.lastChunkZ = Number.NaN;
        if (Number.isFinite(this.pendingX)) this.update(this.pendingX, this.pendingZ);
    }

    private capacity(base: number): number {
        return this.lowEnd ? Math.floor(base * 0.5) : base;
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

    public update(playerX: number, playerZ: number) {
        this.pendingX = playerX;
        this.pendingZ = playerZ;
        if (this.rockGroups.length === 0 && this.plantGroups.length === 0) return;

        const chunkX = Math.floor((playerX + WORLD_HALF) / CHUNK_SIZE);
        const chunkZ = Math.floor((playerZ + WORLD_HALF) / CHUNK_SIZE);
        if (chunkX === this.lastChunkX && chunkZ === this.lastChunkZ) return;

        this.lastChunkX = chunkX;
        this.lastChunkZ = chunkZ;
        this.rebuild(chunkX, chunkZ);
    }

    private rebuild(centerChunkX: number, centerChunkZ: number) {
        const rocks: PropInstance[][] = this.rockGroups.map(() => []);
        const plants: PropInstance[][] = this.plantGroups.map(() => []);
        this.colliders = [];

        for (let cx = centerChunkX - VIEW_CHUNK_RADIUS; cx <= centerChunkX + VIEW_CHUNK_RADIUS; cx++) {
            for (let cz = centerChunkZ - VIEW_CHUNK_RADIUS; cz <= centerChunkZ + VIEW_CHUNK_RADIUS; cz++) {
                if (cx < 0 || cz < 0 || cx >= CHUNKS_PER_SIDE || cz >= CHUNKS_PER_SIDE) continue;

                const props = this.getChunkProps(cx, cz);

                for (const rock of props.rocks) {
                    if (this.rockGroups.length === 0) break;
                    const index = Math.floor(rock.pick * this.rockGroups.length) % this.rockGroups.length;
                    const bucket = rocks[index];
                    if (bucket.length >= this.capacity(MAX_ROCKS)) continue;
                    bucket.push(rock);
                    if (rock.scale > 1.4) {
                        this.colliders.push(this.makeCollider(rock, rock.scale * 0.42, rock.scale * 0.7));
                    }
                }

                for (const plant of props.plants) {
                    if (this.plantGroups.length === 0) break;
                    const index = Math.floor(plant.pick * this.plantGroups.length) % this.plantGroups.length;
                    const bucket = plants[index];
                    if (bucket.length >= this.capacity(MAX_PLANTS)) continue;
                    bucket.push(plant);
                }
            }
        }

        this.rockGroups.forEach((group, index) => this.applyInstances(group, rocks[index]));
        this.plantGroups.forEach((group, index) => this.applyInstances(group, plants[index]));

        this.onCollidersChanged?.();
    }

    private submerged(x: number, z: number): boolean {
        const height = this.terrain.getHeightAt(x, z);
        if (height < SEA_LEVEL + SHORE_CLEARANCE) return true;

        for (const lake of this.terrain.lakes) {
            const dx = x - lake.x;
            const dz = z - lake.z;
            if (dx * dx + dz * dz < lake.radius * lake.radius && height < lake.level + SHORE_CLEARANCE) return true;
        }

        return false;
    }

    private nearWater(x: number, z: number, margin: number): boolean {
        if (this.submerged(x, z)) return true;

        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            if (this.submerged(x + Math.cos(angle) * margin, z + Math.sin(angle) * margin)) return true;
        }

        return false;
    }

    private makeCollider(prop: PropInstance, radius: number, height: number): THREE.Box3 {
        return new THREE.Box3(
            new THREE.Vector3(prop.x - radius, prop.y, prop.z - radius),
            new THREE.Vector3(prop.x + radius, prop.y + height, prop.z + radius)
        );
    }

    private applyInstances(group: THREE.InstancedMesh[], instances: PropInstance[]) {
        for (let i = 0; i < instances.length; i++) {
            const instance = instances[i];
            this.position.set(instance.x, instance.y, instance.z);
            this.euler.set(instance.tiltX, instance.rotation, instance.tiltZ);
            this.quaternion.setFromEuler(this.euler);
            this.scale.setScalar(instance.scale);
            this.matrix.compose(this.position, this.quaternion, this.scale);

            this.color.setRGB(0.9 + instance.tint * 0.16, 0.92 + instance.tint * 0.12, 0.88 + instance.tint * 0.18);

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

    private plantable(x: number, z: number, maxSlope: number): boolean {
        const height = this.terrain.getHeightAt(x, z);
        if (height < 1.2 || height > 42) return false;
        if (this.terrain.getSlopeAt(x, z) > maxSlope) return false;

        if (Math.hypot(x, z) < SAFE_ZONE_RADIUS + 5) return false;
        if (Math.hypot(x - TOWER_X, z - TOWER_Z) < TOWER_FLAT_RADIUS * 0.8) return false;
        if (insideTowerPlaza(x, z)) return false;
        if (Math.hypot(x - CAVE_PORTAL_X, z - CAVE_PORTAL_Z) < 16) return false;

        return !this.nearWater(x, z, WATER_MARGIN);
    }

    private getChunkProps(chunkX: number, chunkZ: number): ChunkProps {
        const key = `${chunkX},${chunkZ}`;
        const cached = this.chunkCache.get(key);
        if (cached) return cached;

        const random = createRandom(WORLD_SEED + chunkX * 51287 + chunkZ * 92821);
        const originX = -WORLD_HALF + chunkX * CHUNK_SIZE;
        const originZ = -WORLD_HALF + chunkZ * CHUNK_SIZE;

        const props: ChunkProps = { rocks: [], plants: [] };

        const rockCount = this.lowEnd ? ROCK_CANDIDATES / 2 : ROCK_CANDIDATES;
        for (let i = 0; i < rockCount; i++) {
            const x = originX + random() * CHUNK_SIZE;
            const z = originZ + random() * CHUNK_SIZE;
            if (!this.plantable(x, z, 0.62)) continue;

            const size = ROCK_MIN_SIZE + random() * ROCK_SIZE_SPREAD;
            props.rocks.push({
                x,
                y: this.terrain.getHeightAt(x, z) - size * ROCK_SINK,
                z,
                scale: size,
                rotation: random() * Math.PI * 2,
                pick: random(),
                tiltX: (random() - 0.5) * 0.14,
                tiltZ: (random() - 0.5) * 0.14,
                tint: random(),
            });
        }

        const plantCount = this.lowEnd ? PLANT_CANDIDATES / 2 : PLANT_CANDIDATES;
        for (let i = 0; i < plantCount; i++) {
            const x = originX + random() * CHUNK_SIZE;
            const z = originZ + random() * CHUNK_SIZE;
            if (!this.plantable(x, z, 0.42)) continue;

            const glade = fbm(x * 0.0136, z * 0.0136, 3, WORLD_SEED + 8123);
            if (random() > smoothstep(0.28, 0.66, glade)) continue;

            const size = PLANT_MIN_SIZE + random() * PLANT_SIZE_SPREAD;
            props.plants.push({
                x,
                y: this.terrain.getHeightAt(x, z) - size * PLANT_SINK,
                z,
                scale: size,
                rotation: random() * Math.PI * 2,
                pick: random(),
                tiltX: (random() - 0.5) * 0.12,
                tiltZ: (random() - 0.5) * 0.12,
                tint: random(),
            });
        }

        this.chunkCache.set(key, props);
        return props;
    }

    public dispose() {
        const materials = new Set<THREE.Material>();

        for (const group of [...this.rockGroups, ...this.plantGroups]) {
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
            material.dispose();
        });

        this.rockGroups.length = 0;
        this.plantGroups.length = 0;
        this.chunkCache.clear();
        this.colliders = [];
    }
}
