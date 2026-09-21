// src/features/game/world/locations/showcase/rooms/garden/GardenFlora.ts
import * as THREE from "three";
import { loadPropSet, type PropModel } from "../../../main-world/utils/propModels";
import type { CollisionGrid } from "../../../../CollisionGrid";
import { GardenSurface, SURFACE_BED, SURFACE_GRASS, SURFACE_STONE } from "./GardenSurface";

const CANOPY_SOURCES = [
    { url: "/models/world/tree_02.glb" },
    { url: "/models/world/tree_pack_01.glb", split: true },
];

const UNDERSTORY_SOURCES = [
    { url: "/models/world/fir_sapling.glb" },
    { url: "/models/world/tree_stump_01.glb" },
];

const BUSH_SOURCES = [
    { url: "/models/world/shrub_02.glb" },
    { url: "/models/world/shrub_03.glb" },
    { url: "/models/world/shrub_04.glb" },
    { url: "/models/world/fern_02.glb" },
];

const BLOOM_SOURCES = [
    { url: "/models/world/celandine_01.glb" },
    { url: "/models/world/dandelion_01.glb" },
];

const TUFT_SOURCES = [
    { url: "/models/world/grass_medium_01.glb" },
    { url: "/models/world/grass_medium_02.glb" },
    { url: "/models/world/grass_bermuda_01.glb" },
];

const ROCK_SOURCES = [
    { url: "/models/world/rock_07.glb" },
    { url: "/models/world/rock_09.glb" },
    { url: "/models/world/stone_01.glb" },
    { url: "/models/world/rock_moss_set_01.glb" },
];

interface Placement {
    x: number;
    z: number;
    scale: number;
    rotation: number;
    tiltX: number;
    tiltZ: number;
    pick: number;
    tint: number;
    sink: number;
}

interface Bucket {
    sources: { url: string; split?: boolean }[];
    placements: Placement[];
    shadows: boolean;
}

export type FloraBlocker = (x: number, z: number, radius: number) => boolean;

export class GardenFlora {
    private readonly buckets = new Map<string, Bucket>();
    private readonly meshes: THREE.InstancedMesh[] = [];
    private readonly matrix = new THREE.Matrix4();
    private readonly quaternion = new THREE.Quaternion();
    private readonly euler = new THREE.Euler();
    private readonly position = new THREE.Vector3();
    private readonly scaleVector = new THREE.Vector3();
    private readonly color = new THREE.Color();
    private ready: Promise<void> = Promise.resolve();

    constructor(
        private readonly scene: THREE.Scene,
        private readonly surface: GardenSurface,
        private readonly random: () => number,
        private readonly blocked: FloraBlocker,
        private readonly detail: number
    ) {
        this.buckets.set("canopy", { sources: CANOPY_SOURCES, placements: [], shadows: true });
        this.buckets.set("understory", { sources: UNDERSTORY_SOURCES, placements: [], shadows: true });
        this.buckets.set("bush", { sources: BUSH_SOURCES, placements: [], shadows: true });
        this.buckets.set("bloom", { sources: BLOOM_SOURCES, placements: [], shadows: false });
        this.buckets.set("tuft", { sources: TUFT_SOURCES, placements: [], shadows: false });
        this.buckets.set("rock", { sources: ROCK_SOURCES, placements: [], shadows: true });
    }

    public place(
        bucket: string,
        x: number,
        z: number,
        scale: number,
        options: { tilt?: number; tint?: number; sink?: number; pick?: number } = {}
    ) {
        const target = this.buckets.get(bucket);
        if (!target) return;

        target.placements.push({
            x,
            z,
            scale,
            rotation: this.random() * Math.PI * 2,
            tiltX: (this.random() - 0.5) * (options.tilt ?? 0.08),
            tiltZ: (this.random() - 0.5) * (options.tilt ?? 0.08),
            pick: options.pick ?? this.random(),
            tint: options.tint ?? 0.86 + this.random() * 0.3,
            sink: options.sink ?? 0,
        });
    }

    public scatter(
        bucket: string,
        count: number,
        minRadius: number,
        maxRadius: number,
        scaleMin: number,
        scaleSpread: number,
        options: {
            clearance?: number;
            needsGrass?: number;
            prefersBed?: boolean;
            tilt?: number;
            sink?: number;
            center?: THREE.Vector3;
        } = {}
    ) {
        const target = Math.round(count * this.detail);
        const clearance = options.clearance ?? 0.8;
        const needsGrass = options.needsGrass ?? 0.45;
        const centerX = options.center?.x ?? 0;
        const centerZ = options.center?.z ?? 0;
        let placed = 0;
        let guard = 0;

        while (placed < target && guard < target * 22) {
            guard++;
            const angle = this.random() * Math.PI * 2;
            const distance = Math.sqrt(this.random()) * (maxRadius - minRadius) + minRadius;
            const x = centerX + Math.cos(angle) * distance;
            const z = centerZ + Math.sin(angle) * distance;

            if (this.surface.sample(SURFACE_STONE, x, z) > 0.25) continue;
            if (options.prefersBed) {
                if (this.surface.sample(SURFACE_BED, x, z) < 0.4) continue;
            } else if (this.surface.sample(SURFACE_GRASS, x, z) < needsGrass) {
                continue;
            }

            const scale = scaleMin + this.random() * scaleSpread;
            if (this.blocked(x, z, Math.max(clearance, scale * 0.4))) continue;

            this.place(bucket, x, z, scale, { tilt: options.tilt, sink: options.sink });
            placed++;
        }
    }

    public create(grid: CollisionGrid, trunkBuckets: string[] = ["canopy"]) {
        for (const name of trunkBuckets) {
            const bucket = this.buckets.get(name);
            if (!bucket) continue;
            for (const placement of bucket.placements) {
                grid.insertCylinder(
                    new THREE.Vector3(placement.x, placement.scale * 0.5, placement.z),
                    Math.max(0.42, placement.scale * 0.055),
                    placement.scale * 0.9
                );
            }
        }

        this.ready = this.load();
    }

    public whenReady(): Promise<void> {
        return this.ready;
    }

    private async load() {
        const names = [...this.buckets.keys()];
        const sets = await Promise.all(names.map((name) => loadPropSet(this.buckets.get(name)!.sources)));

        for (let i = 0; i < names.length; i++) {
            const bucket = this.buckets.get(names[i])!;
            if (bucket.placements.length === 0) continue;
            this.build(names[i], sets[i], bucket);
        }
    }

    private build(name: string, models: PropModel[], bucket: Bucket) {
        if (models.length === 0) return;

        const groups: Placement[][] = models.map(() => []);
        for (const placement of bucket.placements) {
            const index = Math.min(models.length - 1, Math.floor(placement.pick * models.length));
            groups[index].push(placement);
        }

        for (let i = 0; i < models.length; i++) {
            const placements = groups[i];
            if (placements.length === 0) continue;

            for (const part of models[i].parts) {
                const mesh = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
                mesh.name = `garden-${name}-${i}`;
                mesh.castShadow = bucket.shadows;
                mesh.receiveShadow = true;
                mesh.frustumCulled = true;

                for (let p = 0; p < placements.length; p++) {
                    const placement = placements[p];
                    this.position.set(placement.x, -placement.sink, placement.z);
                    this.euler.set(placement.tiltX, placement.rotation, placement.tiltZ);
                    this.quaternion.setFromEuler(this.euler);
                    this.scaleVector.setScalar(placement.scale);
                    this.matrix.compose(this.position, this.quaternion, this.scaleVector);
                    mesh.setMatrixAt(p, this.matrix);
                    mesh.setColorAt(p, this.color.setScalar(placement.tint));
                }

                mesh.instanceMatrix.needsUpdate = true;
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
                mesh.computeBoundingSphere();

                this.scene.add(mesh);
                this.meshes.push(mesh);
            }
        }
    }

    public dispose() {
        for (const mesh of this.meshes) {
            this.scene.remove(mesh);
            mesh.dispose();
        }
        this.meshes.length = 0;
        this.buckets.clear();
    }
}
