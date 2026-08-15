// src/features/game/world/locations/main-world/systems/TreeScatterSystem.ts
import * as THREE from "three";
import { createRandom, fbm, smoothstep } from "../utils/worldNoise";
import { createTree, TREE_LODS, TREE_SPECIES, TreeSpecies } from "../utils/proceduralTree";
import { createLeafTexture } from "../utils/leafTexture";
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

const VIEW_CHUNK_RADIUS = 3;
const REBUILD_MOVE_DISTANCE = 24;
const LOD_BANDS = [90, 190, 320];
const CAPACITY = [300, 700, 1250];
const VARIANTS_PER_SPECIES = 3;
const SHRUB_SPECIES = 2;
const TREE_WATER_MARGIN = 9;
const SHRUB_WATER_MARGIN = 5;
const SHORE_CLEARANCE = 0.6;

interface TreeInstance {
    x: number;
    y: number;
    z: number;
    scale: number;
    rotation: number;
    tiltX: number;
    tiltZ: number;
    tint: number;
    species: number;
    variant: number;
}

interface SpeciesSlot {
    species: TreeSpecies;
    bark: THREE.InstancedMesh[][];
    canopy: THREE.InstancedMesh[][];
}

export class TreeScatterSystem {
    private readonly chunkCache = new Map<string, TreeInstance[]>();
    private readonly slots: SpeciesSlot[] = [];

    private barkMaterial!: THREE.MeshStandardMaterial;
    private canopyMaterial!: THREE.MeshStandardMaterial;
    private leafTexture: THREE.Texture | null = null;
    private readonly windUniforms = {
        uTime: { value: 0 },
        uWindDir: { value: new THREE.Vector2(0.72, 0.69) },
        uWindStrength: { value: 0.35 },
    };

    private readonly matrix = new THREE.Matrix4();
    private readonly quaternion = new THREE.Quaternion();
    private readonly position = new THREE.Vector3();
    private readonly scale = new THREE.Vector3();
    private readonly euler = new THREE.Euler();
    private readonly color = new THREE.Color();

    private colliders: THREE.Box3[] = [];
    private lastChunkX = Number.NaN;
    private lastChunkZ = Number.NaN;
    private lastRebuildX = Number.NaN;
    private lastRebuildZ = Number.NaN;

    public onCollidersChanged: (() => void) | null = null;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly terrain: TerrainSystem,
        private readonly lowEnd: boolean
    ) { }

    public create() {
        this.leafTexture = createLeafTexture(WORLD_SEED + 7);
        this.barkMaterial = this.createFoliageMaterial(0.92, false);
        this.canopyMaterial = this.createFoliageMaterial(0.86, true);

        TREE_SPECIES.forEach((species, speciesIndex) => {
            const slot: SpeciesSlot = { species, bark: [], canopy: [] };

            TREE_LODS.forEach((lod, lodIndex) => {
                if (this.lowEnd && lodIndex === 0) {
                    slot.bark.push([]);
                    slot.canopy.push([]);
                    return;
                }

                const barkRow: THREE.InstancedMesh[] = [];
                const canopyRow: THREE.InstancedMesh[] = [];
                const capacity = this.scaledCapacity(CAPACITY[lodIndex]);

                for (let variant = 0; variant < VARIANTS_PER_SPECIES; variant++) {
                    const geometry = createTree(species, lod, WORLD_SEED + speciesIndex * 91 + variant * 17);

                    const bark = new THREE.InstancedMesh(geometry.bark, this.barkMaterial, capacity);
                    bark.name = `${species.id}-bark-${lodIndex}-${variant}`;
                    bark.castShadow = lodIndex === 0 && !this.lowEnd;
                    bark.receiveShadow = true;
                    bark.count = 0;
                    bark.frustumCulled = false;
                    bark.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                    this.scene.add(bark);
                    barkRow.push(bark);

                    const canopy = new THREE.InstancedMesh(geometry.canopy, this.canopyMaterial, capacity);
                    canopy.name = `${species.id}-canopy-${lodIndex}-${variant}`;
                    canopy.castShadow = false;
                    canopy.receiveShadow = false;
                    canopy.count = 0;
                    canopy.frustumCulled = false;
                    canopy.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                    this.scene.add(canopy);
                    canopyRow.push(canopy);
                }

                slot.bark.push(barkRow);
                slot.canopy.push(canopyRow);
            });

            this.slots.push(slot);
        });
    }

    private scaledCapacity(capacity: number): number {
        return this.lowEnd ? Math.ceil(capacity * 0.5) : capacity;
    }

    private createFoliageMaterial(roughness: number, isCanopy: boolean): THREE.MeshStandardMaterial {
        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness,
            metalness: 0,
            flatShading: !isCanopy,
            map: isCanopy ? this.leafTexture : null,
            alphaTest: isCanopy && this.leafTexture ? 0.42 : 0,
            side: isCanopy ? THREE.DoubleSide : THREE.FrontSide,
            transparent: false,
            depthWrite: true,
        });

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = this.windUniforms.uTime;
            shader.uniforms.uWindDir = this.windUniforms.uWindDir;
            shader.uniforms.uWindStrength = this.windUniforms.uWindStrength;

            shader.vertexShader = `
                attribute float aFlex;
                uniform float uTime;
                uniform vec2 uWindDir;
                uniform float uWindStrength;
            ` + shader.vertexShader.replace(
                "#include <begin_vertex>",
                `
                #include <begin_vertex>

                vec3 windAnchor = vec3(0.0);
                #ifdef USE_INSTANCING
                windAnchor = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
                #endif

                float windPhase = uTime * 1.1 + windAnchor.x * 0.16 + windAnchor.z * 0.13;
                float gust = sin(windPhase) * 0.65 + sin(windPhase * 2.7 + windAnchor.z * 0.08) * 0.35;
                float sway = gust * uWindStrength * aFlex;

                transformed.x += uWindDir.x * sway;
                transformed.z += uWindDir.y * sway;
                transformed.y -= abs(sway) * 0.12 * aFlex;
                `
            );
        };

        return material;
    }

    public getColliders(): THREE.Box3[] {
        return this.colliders;
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

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            if (this.submerged(x + Math.cos(angle) * margin, z + Math.sin(angle) * margin)) return true;
        }

        return false;
    }

    private chunkTooFar(chunkX: number, chunkZ: number, playerX: number, playerZ: number): boolean {
        const minX = -WORLD_HALF + chunkX * CHUNK_SIZE;
        const minZ = -WORLD_HALF + chunkZ * CHUNK_SIZE;

        const dx = Math.max(minX - playerX, 0, playerX - (minX + CHUNK_SIZE));
        const dz = Math.max(minZ - playerZ, 0, playerZ - (minZ + CHUNK_SIZE));

        return Math.hypot(dx, dz) > LOD_BANDS[LOD_BANDS.length - 1] + REBUILD_MOVE_DISTANCE;
    }

    public setWind(direction: THREE.Vector2, strength: number) {
        this.windUniforms.uWindDir.value.copy(direction);
        this.windUniforms.uWindStrength.value = strength;
    }

    public update(delta: number, playerX: number, playerZ: number) {
        this.windUniforms.uTime.value += delta;

        const chunkX = Math.floor((playerX + WORLD_HALF) / CHUNK_SIZE);
        const chunkZ = Math.floor((playerZ + WORLD_HALF) / CHUNK_SIZE);
        const chunkChanged = chunkX !== this.lastChunkX || chunkZ !== this.lastChunkZ;
        const moved = Math.hypot(playerX - this.lastRebuildX, playerZ - this.lastRebuildZ);

        if (!chunkChanged && Number.isFinite(moved) && moved < REBUILD_MOVE_DISTANCE) return;

        this.lastChunkX = chunkX;
        this.lastChunkZ = chunkZ;
        this.lastRebuildX = playerX;
        this.lastRebuildZ = playerZ;

        this.rebuild(chunkX, chunkZ, playerX, playerZ, chunkChanged);
    }

    private rebuild(centerChunkX: number, centerChunkZ: number, playerX: number, playerZ: number, rebuildColliders: boolean) {
        const buckets: TreeInstance[][][][] = this.slots.map(() =>
            TREE_LODS.map(() => Array.from({ length: VARIANTS_PER_SPECIES }, () => [] as TreeInstance[]))
        );

        if (rebuildColliders) this.colliders = [];

        for (let cx = centerChunkX - VIEW_CHUNK_RADIUS; cx <= centerChunkX + VIEW_CHUNK_RADIUS; cx++) {
            for (let cz = centerChunkZ - VIEW_CHUNK_RADIUS; cz <= centerChunkZ + VIEW_CHUNK_RADIUS; cz++) {
                if (cx < 0 || cz < 0 || cx >= CHUNKS_PER_SIDE || cz >= CHUNKS_PER_SIDE) continue;
                if (this.chunkTooFar(cx, cz, playerX, playerZ)) continue;

                for (const tree of this.getChunkTrees(cx, cz)) {
                    const distance = Math.hypot(tree.x - playerX, tree.z - playerZ);
                    if (distance > LOD_BANDS[LOD_BANDS.length - 1]) continue;

                    let lodIndex = LOD_BANDS.length - 1;
                    for (let i = 0; i < LOD_BANDS.length; i++) {
                        if (distance <= LOD_BANDS[i]) {
                            lodIndex = i;
                            break;
                        }
                    }

                    if (this.lowEnd && lodIndex === 0) lodIndex = 1;

                    buckets[tree.species][lodIndex][tree.variant].push(tree);

                    if (rebuildColliders && tree.species !== SHRUB_SPECIES && distance < LOD_BANDS[0]) {
                        const radius = this.slots[tree.species].species.trunkRadius * tree.scale * 1.6;
                        const height = this.slots[tree.species].species.trunkLength * tree.scale * 0.6;
                        this.colliders.push(new THREE.Box3(
                            new THREE.Vector3(tree.x - radius, tree.y, tree.z - radius),
                            new THREE.Vector3(tree.x + radius, tree.y + height, tree.z + radius)
                        ));
                    }
                }
            }
        }

        this.slots.forEach((slot, speciesIndex) => {
            TREE_LODS.forEach((_, lodIndex) => {
                for (let variant = 0; variant < VARIANTS_PER_SPECIES; variant++) {
                    const instances = buckets[speciesIndex][lodIndex][variant];
                    this.applyInstances(slot.bark[lodIndex]?.[variant], instances);
                    this.applyInstances(slot.canopy[lodIndex]?.[variant], instances);
                }
            });
        });

        if (rebuildColliders) this.onCollidersChanged?.();
    }

    private applyInstances(mesh: THREE.InstancedMesh | undefined, instances: TreeInstance[]) {
        if (!mesh) return;

        const limit = Math.min(instances.length, mesh.instanceMatrix.count);

        for (let i = 0; i < limit; i++) {
            const instance = instances[i];

            this.position.set(instance.x, instance.y, instance.z);
            this.euler.set(instance.tiltX, instance.rotation, instance.tiltZ);
            this.quaternion.setFromEuler(this.euler);
            this.scale.setScalar(instance.scale);
            this.matrix.compose(this.position, this.quaternion, this.scale);
            mesh.setMatrixAt(i, this.matrix);

            this.color.setRGB(
                0.88 + instance.tint * 0.22,
                0.9 + instance.tint * 0.18,
                0.86 + instance.tint * 0.2
            );
            mesh.setColorAt(i, this.color);
        }

        mesh.count = limit;
        mesh.visible = limit > 0;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
    }

    private getChunkTrees(chunkX: number, chunkZ: number): TreeInstance[] {
        const key = `${chunkX},${chunkZ}`;
        const cached = this.chunkCache.get(key);
        if (cached) return cached;

        const random = createRandom(WORLD_SEED + chunkX * 73856093 + chunkZ * 19349663);
        const originX = -WORLD_HALF + chunkX * CHUNK_SIZE;
        const originZ = -WORLD_HALF + chunkZ * CHUNK_SIZE;

        const trees: TreeInstance[] = [];
        const candidates = this.lowEnd ? 90 : 190;

        for (let i = 0; i < candidates; i++) {
            const x = originX + random() * CHUNK_SIZE;
            const z = originZ + random() * CHUNK_SIZE;

            const grove = fbm(x * 0.0085, z * 0.0085, 3, WORLD_SEED + 4477);
            const edge = smoothstep(0.3, 0.5, grove) * (1 - smoothstep(0.7, 0.88, grove));

            const isShrub = random() < 0.38;
            const chance = isShrub ? edge * 0.85 : smoothstep(0.34, 0.6, grove);
            if (random() > chance) continue;

            const height = this.terrain.getHeightAt(x, z);
            if (height < 2.6 || height > 36) continue;
            if (this.terrain.getSlopeAt(x, z) > (isShrub ? 0.45 : 0.3)) continue;

            const spawnDistance = Math.hypot(x, z);
            if (spawnDistance < SAFE_ZONE_RADIUS + 6) continue;
            if (Math.hypot(x - TOWER_X, z - TOWER_Z) < TOWER_FLAT_RADIUS * 0.8) continue;
            if (insideTowerPlaza(x, z)) continue;
            if (Math.hypot(x - CAVE_PORTAL_X, z - CAVE_PORTAL_Z) < 18) continue;

            if (this.nearWater(x, z, isShrub ? SHRUB_WATER_MARGIN : TREE_WATER_MARGIN)) continue;

            const species = isShrub ? 2 : (random() < 0.62 ? 0 : 1);

            trees.push({
                x,
                y: height - 0.15,
                z,
                scale: isShrub ? 0.8 + random() * 0.75 : 0.95 + random() * 0.7,
                rotation: random() * Math.PI * 2,
                tiltX: (random() - 0.5) * 0.05,
                tiltZ: (random() - 0.5) * 0.05,
                tint: random(),
                species,
                variant: Math.floor(random() * VARIANTS_PER_SPECIES) % VARIANTS_PER_SPECIES,
            });
        }

        this.chunkCache.set(key, trees);
        return trees;
    }

    public dispose() {
        for (const slot of this.slots) {
            for (const row of [...slot.bark, ...slot.canopy]) {
                for (const mesh of row) {
                    this.scene.remove(mesh);
                    mesh.geometry.dispose();
                    mesh.dispose();
                }
            }
        }

        this.barkMaterial?.dispose();
        this.canopyMaterial?.dispose();
        this.leafTexture?.dispose();
        this.slots.length = 0;
        this.chunkCache.clear();
        this.colliders = [];
    }
}
