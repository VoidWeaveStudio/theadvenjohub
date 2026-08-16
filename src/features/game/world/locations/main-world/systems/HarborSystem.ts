// src/features/game/world/locations/main-world/systems/HarborSystem.ts
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createRandom } from "../utils/worldNoise";
import type { TerrainSystem } from "./TerrainSystem";
import {
    COVE_CENTER_RADIUS,
    COVE_X,
    COVE_Z,
    HARBOR_DECK_Y,
    WORLD_SEED,
} from "../worldConfig";

const AXIS_X = COVE_X / COVE_CENTER_RADIUS;
const AXIS_Z = COVE_Z / COVE_CENTER_RADIUS;

const PIER_LENGTH = 88;
const PIER_WIDTH = 6.4;
const PLANK_STEP = 1.6;
const PILE_STEP = 7;

interface Batch {
    parts: THREE.BufferGeometry[];
}

function newBatch(): Batch {
    return { parts: [] };
}

function addBox(
    batch: Batch,
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    rotationY: number
) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    geometry.rotateY(rotationY);
    geometry.translate(x, y, z);
    batch.parts.push(geometry);
}

function addCylinder(
    batch: Batch,
    radiusTop: number,
    radiusBottom: number,
    height: number,
    x: number,
    y: number,
    z: number,
    segments = 8
) {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
    geometry.translate(x, y, z);
    batch.parts.push(geometry);
}

function buildBatch(batch: Batch, material: THREE.Material, name: string): THREE.Mesh | null {
    if (batch.parts.length === 0) return null;

    const merged = mergeGeometries(batch.parts, false);
    batch.parts.forEach((part) => part.dispose());
    batch.parts.length = 0;
    if (!merged) return null;

    merged.computeVertexNormals();
    merged.computeBoundingSphere();

    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
}

export class HarborSystem {
    private readonly meshes: THREE.Mesh[] = [];
    private readonly materials: THREE.Material[] = [];
    private readonly colliders: THREE.Box3[] = [];
    private readonly random = createRandom(WORLD_SEED + 5150);

    private lampLight: THREE.PointLight | null = null;
    private beaconMaterial: THREE.MeshStandardMaterial | null = null;
    private time = 0;

    public readonly anchorPoint = new THREE.Vector3();

    constructor(
        private readonly scene: THREE.Scene,
        private readonly terrain: TerrainSystem,
        private readonly lowEnd: boolean
    ) { }

    private local(along: number, across: number): { x: number; z: number } {
        return {
            x: COVE_X + AXIS_X * along - AXIS_Z * across,
            z: COVE_Z + AXIS_Z * along + AXIS_X * across,
        };
    }

    public create() {
        const wood = new THREE.MeshStandardMaterial({ color: 0x6b4d31, roughness: 0.88, metalness: 0 });
        const darkWood = new THREE.MeshStandardMaterial({ color: 0x3f2c1c, roughness: 0.92, metalness: 0 });
        const stone = new THREE.MeshStandardMaterial({ color: 0x8b8578, roughness: 0.9, metalness: 0.03 });
        const iron = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.6, metalness: 0.7 });
        this.materials.push(wood, darkWood, stone, iron);

        const deck = newBatch();
        const piles = newBatch();
        const props = newBatch();
        const metal = newBatch();

        this.buildPier(-152, 0, PIER_LENGTH, deck, piles, props, metal);
        this.buildPier(-146, -38, 68, deck, piles, props, metal);
        this.buildLighthouse(stone, iron);

        const anchor = this.local(-152 + PIER_LENGTH * 0.6, 0);
        this.anchorPoint.set(anchor.x, HARBOR_DECK_Y, anchor.z);

        this.push(buildBatch(deck, wood, "harbor-deck"));
        this.push(buildBatch(piles, darkWood, "harbor-piles"));
        this.push(buildBatch(props, wood, "harbor-props"));
        this.push(buildBatch(metal, iron, "harbor-metal"));
    }

    public setVisible(visible: boolean) {
        for (const mesh of this.meshes) {
            mesh.visible = visible;
        }
    }

    private push(mesh: THREE.Mesh | null) {
        if (!mesh) return;
        this.scene.add(mesh);
        this.meshes.push(mesh);
    }

    private buildPier(startAlong: number, across: number, length: number, deck: Batch, piles: Batch, props: Batch, metal: Batch) {
        const rotation = Math.atan2(AXIS_X, AXIS_Z);
        const plankCount = Math.floor(length / PLANK_STEP);

        for (let i = 0; i < plankCount; i++) {
            const along = startAlong + i * PLANK_STEP + PLANK_STEP / 2;
            const point = this.local(along, across);
            const jitter = (this.random() - 0.5) * 0.06;

            addBox(deck, PIER_WIDTH, 0.22, PLANK_STEP * 0.86, point.x, HARBOR_DECK_Y + jitter, point.z, rotation);
        }

        for (const side of [-1, 1]) {
            const rail = this.local(startAlong + length / 2, across + side * (PIER_WIDTH / 2 - 0.2));
            addBox(props, 0.16, 0.16, length, rail.x, HARBOR_DECK_Y + 1.05, rail.z, rotation);
        }

        const pileCount = Math.floor(length / PILE_STEP);
        for (let i = 0; i <= pileCount; i++) {
            const along = startAlong + i * PILE_STEP;
            for (const side of [-1, 1]) {
                const point = this.local(along, across + side * (PIER_WIDTH / 2 - 0.5));
                const bed = this.terrain.getHeightAt(point.x, point.z);
                const height = HARBOR_DECK_Y - bed + 1.2;
                if (height <= 0.6) continue;

                addCylinder(piles, 0.28, 0.34, height, point.x, bed + height / 2, point.z);

                if (i % 2 === 0) {
                    addCylinder(props, 0.14, 0.14, 1.05, point.x, HARBOR_DECK_Y + 0.62, point.z, 6);
                }
            }
        }

        for (let i = 0; i < 3; i++) {
            const along = startAlong + length * (0.45 + i * 0.18);
            const point = this.local(along, across + (this.random() - 0.5) * (PIER_WIDTH - 2.4));
            addCylinder(metal, 0.22, 0.26, 0.9, point.x, HARBOR_DECK_Y + 0.55, point.z, 10);
        }

        const crateCount = 4;
        for (let i = 0; i < crateCount; i++) {
            const along = startAlong + length * (0.2 + this.random() * 0.7);
            const point = this.local(along, across + (this.random() - 0.5) * (PIER_WIDTH - 2));
            const size = 0.9 + this.random() * 0.5;
            addBox(props, size, size, size, point.x, HARBOR_DECK_Y + size / 2 + 0.11, point.z, rotation + this.random());
        }

        this.addPierColliders(startAlong, across, length);
    }

    private addPierColliders(startAlong: number, across: number, length: number) {
        const steps = Math.ceil(length / 6);
        for (let i = 0; i < steps; i++) {
            const along = startAlong + (i + 0.5) * (length / steps);
            const point = this.local(along, across);
            const half = PIER_WIDTH * 0.62;

            this.colliders.push(new THREE.Box3(
                new THREE.Vector3(point.x - half, HARBOR_DECK_Y - 0.5, point.z - half),
                new THREE.Vector3(point.x + half, HARBOR_DECK_Y, point.z + half)
            ));
        }
    }

    private buildLighthouse(stone: THREE.MeshStandardMaterial, iron: THREE.MeshStandardMaterial) {
        const point = this.local(10, 168);
        const base = this.terrain.getHeightAt(point.x, point.z);

        const group = new THREE.Group();
        group.name = "harbor-lighthouse";
        group.position.set(point.x, base, point.z);

        const plinth = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.4, 2.2, 16), stone);
        plinth.position.y = 1.1;
        plinth.castShadow = true;
        plinth.receiveShadow = true;
        group.add(plinth);

        const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 3.4, 18, 18), stone);
        tower.position.y = 11.2;
        tower.castShadow = true;
        tower.receiveShadow = true;
        group.add(tower);

        const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.5, 18), iron);
        gallery.position.y = 20.4;
        gallery.castShadow = true;
        group.add(gallery);

        this.beaconMaterial = new THREE.MeshStandardMaterial({
            color: 0xfff3cf,
            emissive: 0xffcf6a,
            emissiveIntensity: 2.2,
            roughness: 0.3,
            toneMapped: false,
        });
        const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.4, 14), this.beaconMaterial);
        beacon.position.y = 21.9;
        group.add(beacon);

        const cap = new THREE.Mesh(new THREE.ConeGeometry(2.3, 2.4, 14), iron);
        cap.position.y = 24.3;
        cap.castShadow = true;
        group.add(cap);

        if (!this.lowEnd) {
            this.lampLight = new THREE.PointLight(0xffcf6a, 40, 120, 2);
            this.lampLight.position.set(0, 21.9, 0);
            this.lampLight.castShadow = false;
            group.add(this.lampLight);
        }

        this.scene.add(group);
        this.meshes.push(group as unknown as THREE.Mesh);
        this.materials.push(this.beaconMaterial);

        this.colliders.push(new THREE.Box3(
            new THREE.Vector3(point.x - 4.2, base, point.z - 4.2),
            new THREE.Vector3(point.x + 4.2, base + 20, point.z + 4.2)
        ));
    }

    public getColliders(): THREE.Box3[] {
        return this.colliders;
    }

    public update(delta: number) {
        this.time += delta;
        if (!this.beaconMaterial) return;

        const pulse = 1.6 + Math.sin(this.time * 1.1) * 0.7;
        this.beaconMaterial.emissiveIntensity = pulse;
        if (this.lampLight) this.lampLight.intensity = 26 + pulse * 9;
    }

    public dispose() {
        for (const mesh of this.meshes) {
            this.scene.remove(mesh);
            mesh.traverse?.((child) => {
                const asMesh = child as THREE.Mesh;
                if (asMesh.isMesh) asMesh.geometry.dispose();
            });
            if ((mesh as THREE.Mesh).geometry) (mesh as THREE.Mesh).geometry.dispose();
        }
        this.meshes.length = 0;

        for (const material of this.materials) material.dispose();
        this.materials.length = 0;
        this.colliders.length = 0;
        this.lampLight = null;
        this.beaconMaterial = null;
    }
}
