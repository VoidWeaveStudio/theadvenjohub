// src/features/game/world/locations/tower/floors/first-floor/systems/CanyonScatterSystem.ts
import * as THREE from "three";
import { CanyonBiome } from "../utils/canyonBiomes";
import { createRandom } from "../utils/canyonNoise";
import { getCanyonPropAccentMaterial, getCanyonPropTrunkMaterial } from "../utils/canyonMaterials";
import {
    getBiomePropShapes,
    getBoulderGeometry,
    getHoodooGeometry,
    getSlabGeometry,
} from "../utils/canyonRockShapes";
import { canyonHeight, terrainCenterX, wallFootDistance } from "../utils/canyonTerrain";
import type { CanyonTerrainSystem } from "./CanyonTerrainSystem";

const BOULDER_VARIANTS = 3;
const COLLIDER_MIN_SCALE = 2.3;

interface Instance {
    x: number;
    y: number;
    z: number;
    scale: number;
    stretch: number;
    yaw: number;
    tilt: number;
}

export interface ScatterResult {
    group: THREE.Group;
    colliders: THREE.Box3[];
}

export class CanyonScatterSystem {
    private readonly matrix = new THREE.Matrix4();
    private readonly quaternion = new THREE.Quaternion();
    private readonly euler = new THREE.Euler();
    private readonly position = new THREE.Vector3();
    private readonly scale = new THREE.Vector3();

    constructor(
        private readonly terrainSystem: CanyonTerrainSystem,
        private readonly highQuality: boolean
    ) { }

    public populate(startZ: number, endZ: number, biome: CanyonBiome): ScatterResult {
        const random = createRandom(Math.round(startZ) * 2654435761);
        const group = new THREE.Group();
        const colliders: THREE.Box3[] = [];

        const boulders: Instance[][] = Array.from({ length: BOULDER_VARIANTS }, () => []);
        const slabs: Instance[] = [];
        const hoodoos: Instance[] = [];
        const props: Instance[] = [];

        const density = this.highQuality ? 1 : 0.45;
        const step = this.highQuality ? 7 : 13;

        for (let z = startZ + 3; z < endZ - 3; z += step) {
            const centerX = terrainCenterX(z);

            for (const side of [-1, 1] as const) {
                const foot = wallFootDistance(z, side);

                const rubble = random() < 0.8 * density ? 2 : 1;
                for (let i = 0; i < rubble; i++) {
                    const inward = 0.5 + random() * 17;
                    const x = centerX + side * (foot - inward);
                    const pz = z + (random() - 0.5) * step;
                    const roll = random();
                    const scale = 0.55 + roll * roll * 3.4;

                    const instance: Instance = {
                        x,
                        y: canyonHeight(x, pz) - scale * 0.18,
                        z: pz,
                        scale,
                        stretch: 0.8 + random() * 0.5,
                        yaw: random() * Math.PI * 2,
                        tilt: (random() - 0.5) * 0.5,
                    };

                    boulders[Math.floor(random() * BOULDER_VARIANTS) % BOULDER_VARIANTS].push(instance);
                    if (scale >= COLLIDER_MIN_SCALE) colliders.push(this.colliderFor(instance));
                }

                if (random() < 0.35 * density) {
                    const inward = 2 + random() * 12;
                    const x = centerX + side * (foot - inward);
                    const pz = z + (random() - 0.5) * step;
                    const scale = 1.4 + random() * 3.6;

                    slabs.push({
                        x,
                        y: canyonHeight(x, pz) - 0.1,
                        z: pz,
                        scale,
                        stretch: 0.6 + random() * 0.5,
                        yaw: random() * Math.PI * 2,
                        tilt: (random() - 0.5) * 0.35,
                    });
                }

                if (random() < 0.055 * density) {
                    const inward = 1 + random() * 9;
                    const x = centerX + side * (foot - inward);
                    const pz = z + (random() - 0.5) * step;
                    const scale = 1.1 + random() * 2.4;

                    const instance: Instance = {
                        x,
                        y: canyonHeight(x, pz) - 0.3,
                        z: pz,
                        scale,
                        stretch: 0.9 + random() * 0.8,
                        yaw: random() * Math.PI * 2,
                        tilt: (random() - 0.5) * 0.12,
                    };

                    hoodoos.push(instance);
                    colliders.push(this.colliderFor(instance));
                }
            }

            if (random() < 0.5 * density) {
                const spread = wallFootDistance(z, random() < 0.5 ? -1 : 1);
                const x = centerX + (random() * 2 - 1) * spread * 0.85;
                const pz = z + (random() - 0.5) * step;
                const scale = 0.3 + random() * 0.9;

                boulders[Math.floor(random() * BOULDER_VARIANTS) % BOULDER_VARIANTS].push({
                    x,
                    y: canyonHeight(x, pz) - scale * 0.28,
                    z: pz,
                    scale,
                    stretch: 0.7 + random() * 0.6,
                    yaw: random() * Math.PI * 2,
                    tilt: (random() - 0.5) * 0.6,
                });
            }
        }

        const propCount = Math.round(((endZ - startZ) / 500) * (this.highQuality ? 62 : 28));
        for (let i = 0; i < propCount; i++) {
            const z = startZ + 26 + random() * Math.max(1, endZ - startZ - 52);
            const centerX = terrainCenterX(z);
            const side = random() < 0.5 ? -1 : 1;
            const foot = wallFootDistance(z, side);
            const x = centerX + side * (11 + random() * Math.max(4, foot - 20));

            props.push({
                x,
                y: canyonHeight(x, z),
                z,
                scale: 0.55 + random() * 0.75,
                stretch: 0.85 + random() * 0.4,
                yaw: random() * Math.PI * 2,
                tilt: (random() - 0.5) * 0.14,
            });
        }

        const rockMaterial = this.terrainSystem.getInstancedMaterial(biome);
        const detail = this.highQuality ? 1 : 0;

        boulders.forEach((list, variant) => {
            this.addInstanced(group, getBoulderGeometry(variant, detail), rockMaterial, list);
        });
        this.addInstanced(group, getSlabGeometry(0), rockMaterial, slabs);
        this.addInstanced(group, getHoodooGeometry(0), rockMaterial, hoodoos);

        const shapes = getBiomePropShapes(biome);
        if (shapes.body) this.addInstanced(group, shapes.body, getCanyonPropTrunkMaterial(biome), props);
        if (shapes.glow) this.addInstanced(group, shapes.glow, getCanyonPropAccentMaterial(biome), props);

        return { group, colliders };
    }

    private colliderFor(instance: Instance): THREE.Box3 {
        const radius = instance.scale * 0.55;
        const height = instance.scale * instance.stretch * 1.2;

        return new THREE.Box3(
            new THREE.Vector3(instance.x - radius, instance.y, instance.z - radius),
            new THREE.Vector3(instance.x + radius, instance.y + height, instance.z + radius)
        );
    }

    private addInstanced(
        group: THREE.Group,
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        instances: Instance[]
    ) {
        if (instances.length === 0) return;

        const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
        mesh.castShadow = this.highQuality;
        mesh.receiveShadow = true;

        for (let i = 0; i < instances.length; i++) {
            const instance = instances[i];
            this.position.set(instance.x, instance.y, instance.z);
            this.euler.set(instance.tilt, instance.yaw, instance.tilt * 0.6);
            this.quaternion.setFromEuler(this.euler);
            this.scale.set(instance.scale, instance.scale * instance.stretch, instance.scale);
            this.matrix.compose(this.position, this.quaternion, this.scale);
            mesh.setMatrixAt(i, this.matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
    }
}
