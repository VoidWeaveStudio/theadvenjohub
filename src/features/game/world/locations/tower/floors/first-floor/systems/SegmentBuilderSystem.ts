// src/features/game/world/locations/tower/floors/first-floor/systems/SegmentBuilderSystem.ts
import * as THREE from "three";
import {
    CANYON_START_Z,
    COMBAT_DEPTH,
    RETURN_PAD_OFFSET,
    SAFE_ENTRANCE_DEPTH,
    SEGMENT_LENGTH,
    segmentStartZ,
} from "../utils/canyonMath";
import {
    getArrowGeometry,
    getArrowMaterial,
    getCanyonSealMaterial,
    getUnitBox,
    isCachedGeometry,
    isCachedMaterial,
} from "../utils/canyonMaterials";
import { getBoulderGeometry, isCanyonShapeGeometry } from "../utils/canyonRockShapes";
import {
    canyonHeight,
    HUB_BACK_Z,
    HUB_MESH_START_Z,
    lowestAcross,
    terrainCenterX,
    terrainHalfWidth,
} from "../utils/canyonTerrain";
import { CanyonBiome, biomeForSegment } from "../utils/canyonBiomes";
import { CanyonTerrainSystem } from "./CanyonTerrainSystem";
import { CanyonScatterSystem } from "./CanyonScatterSystem";
import type { FirstFloor } from "../FirstFloor";
import { createNpcModel, NpcHandle, isSharedNpcGeometry } from "../../../../../../entities/npcModel";
import type { ResourceManager } from "../../../../../../core/ResourceManager";

const GATE_HEIGHT = 48;
const GATE_DEPTH = 11;

export interface GateWall {
    group: THREE.Group;
    collider: THREE.Box3;
}

export interface ReturnPad {
    group: THREE.Group;
    active: boolean;
    setActive(active: boolean): void;
}

export interface SegmentContent {
    group: THREE.Group;
    colliders: THREE.Box3[];
    interactables: THREE.Object3D[];
    farGate: GateWall;
    crystal?: THREE.Group;
    crystalBaseY?: number;
    dispatcher?: NpcHandle;
    arrow?: THREE.Mesh;
    returnPad?: ReturnPad;
}

export class SegmentBuilderSystem {
    public readonly terrain: CanyonTerrainSystem;
    public readonly scatter: CanyonScatterSystem;

    private activeBiome: CanyonBiome = biomeForSegment(1);

    constructor(private floor: FirstFloor, highQuality: boolean) {
        this.terrain = new CanyonTerrainSystem(highQuality);
        this.scatter = new CanyonScatterSystem(this.terrain, highQuality);
    }

    private emptyContent(): SegmentContent {
        const content: SegmentContent = {
            group: new THREE.Group(),
            colliders: [],
            interactables: [],
            farGate: null as unknown as GateWall,
        };
        this.floor.scene.add(content.group);
        return content;
    }

    buildHub(resourceManager: ResourceManager): SegmentContent {
        this.activeBiome = this.floor.biome;
        const content = this.emptyContent();

        this.buildGround(content, HUB_MESH_START_Z, CANYON_START_Z);
        this.buildHubBackWall(content);
        this.buildCrystalAndDispatcher(content, 40, resourceManager);
        this.buildArrowIndicator(content, 70, true);
        content.farGate = this.buildGateWallInto(content, CANYON_START_Z);

        return content;
    }

    buildSegment(segment: number, biome: CanyonBiome = biomeForSegment(segment)): SegmentContent {
        this.activeBiome = biome;
        const content = this.emptyContent();

        const startZ = segmentStartZ(segment);
        const endZ = startZ + SEGMENT_LENGTH;

        this.buildGround(content, startZ, endZ);
        this.buildReturnTeleporter(content, startZ + SAFE_ENTRANCE_DEPTH + COMBAT_DEPTH + RETURN_PAD_OFFSET);
        this.buildArrowIndicator(content, startZ + 30, false);
        content.farGate = this.buildGateWallInto(content, endZ);

        return content;
    }

    private buildGround(content: SegmentContent, startZ: number, endZ: number) {
        const strip = this.terrain.build(startZ, endZ, this.activeBiome);
        content.group.add(strip.mesh);
        content.colliders.push(...strip.colliders);

        const scatter = this.scatter.populate(startZ, endZ, this.activeBiome);
        content.group.add(scatter.group);
        content.colliders.push(...scatter.colliders);
    }

    private buildHubBackWall(content: SegmentContent) {
        const halfWidth = terrainHalfWidth(HUB_BACK_Z) + 40;

        content.colliders.push(new THREE.Box3(
            new THREE.Vector3(-halfWidth, -6, HUB_MESH_START_Z - 4),
            new THREE.Vector3(halfWidth, 46, HUB_BACK_Z)
        ));
    }

    buildArrowIndicator(content: SegmentContent, z: number, visible: boolean) {
        const centerX = terrainCenterX(z);
        const mesh = new THREE.Mesh(getArrowGeometry(), getArrowMaterial());
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(centerX, canyonHeight(centerX, z) + 0.3, z);
        mesh.visible = visible;
        mesh.renderOrder = 1;
        content.group.add(mesh);
        content.arrow = mesh;
    }

    buildCrystalAndDispatcher(content: SegmentContent, crystalZ: number, resourceManager: ResourceManager) {
        const centerX = terrainCenterX(crystalZ);
        const ground = canyonHeight(centerX, crystalZ);

        const crystal = new THREE.Group();
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x3399ff, emissiveIntensity: 2 }));
        // No transmission: it would make three.js re-render the whole opaque scene
        // into a full-viewport MSAA target every frame this beacon is on screen,
        // and the canyon keeps two segments alive at once. Opacity alone reads the
        // same on a small decorative shell.
        const shell = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 1), new THREE.MeshPhysicalMaterial({ color: 0x99ddff, opacity: 0.42, transparent: true, roughness: 0.05, metalness: 0, depthWrite: false }));
        const light = new THREE.PointLight(0x66ccff, 9, 45);
        light.position.set(0, 1.5, 0);
        crystal.add(core, shell, light);
        crystal.position.set(centerX, ground + 1.5, crystalZ);
        crystal.userData.interactionId = "tower-crystal";
        content.group.add(crystal);
        content.interactables.push(crystal);
        content.crystal = crystal;
        content.crystalBaseY = ground + 1.5;

        content.colliders.push(new THREE.Box3(
            new THREE.Vector3(-1, 0, -1),
            new THREE.Vector3(1, 3, 1)
        ).translate(crystal.position));

        const dispatcherX = centerX + 14;
        const dispatcherZ = crystalZ - 5;
        const dispatcher = createNpcModel(resourceManager, 0x4a5d8b, (headPos) => {
            const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x33406b, roughness: 0.8 }));
            hat.position.set(headPos.x, headPos.y + 0.35, headPos.z);

            const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), new THREE.MeshStandardMaterial({ color: 0x9ad6ff, emissive: 0x5cb3ff, emissiveIntensity: 5 }));
            marker.position.set(headPos.x, headPos.y + 0.9, headPos.z);

            const glow = new THREE.PointLight(0x6fa8ff, 1.4, 6);
            glow.position.set(headPos.x, headPos.y - 0.2, headPos.z + 0.3);

            return [hat, marker, glow];
        });
        dispatcher.group.position.set(dispatcherX, canyonHeight(dispatcherX, dispatcherZ), dispatcherZ);
        dispatcher.group.userData.interactionId = "canyon-dispatcher";
        content.group.add(dispatcher.group);
        content.interactables.push(dispatcher.group);
        content.dispatcher = dispatcher;

        content.colliders.push(new THREE.Box3(
            new THREE.Vector3(dispatcher.group.position.x - 0.5, dispatcher.group.position.y, dispatcher.group.position.z - 0.5),
            new THREE.Vector3(dispatcher.group.position.x + 0.5, dispatcher.group.position.y + 2.5, dispatcher.group.position.z + 0.5)
        ));
    }

    buildReturnTeleporter(content: SegmentContent, z: number): ReturnPad {
        const centerX = terrainCenterX(z);
        const group = new THREE.Group();
        group.position.set(centerX, lowestAcross(z, 5) + 0.05, z);

        const padMaterial = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, emissive: 0x4fd1ff, emissiveIntensity: 0, roughness: 0.5 });
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 0.5, 24), padMaterial);
        pad.position.y = 0.25;
        pad.receiveShadow = true;
        group.add(pad);

        const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x35506b, emissive: 0x4fd1ff, emissiveIntensity: 0, toneMapped: false });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.15, 8, 32), ringMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.55;
        group.add(ring);

        group.userData.interactionId = "canyon-return";
        content.group.add(group);

        const handle: ReturnPad = {
            group,
            active: false,
            setActive(active: boolean) {
                if (this.active === active) return;
                this.active = active;
                padMaterial.emissiveIntensity = active ? 1.2 : 0;
                ringMaterial.color.setHex(active ? 0x4fd1ff : 0x35506b);
                ringMaterial.emissiveIntensity = active ? 3.5 : 0;
            },
        };

        content.returnPad = handle;
        return handle;
    }

    buildGateWallInto(content: SegmentContent, z: number): GateWall {
        const material = this.terrain.getMaterial(this.activeBiome);
        const centerX = terrainCenterX(z);
        const halfWidth = terrainHalfWidth(z);
        const width = halfWidth * 2 + 30;
        const base = lowestAcross(z) - 2.5;

        const group = new THREE.Group();
        group.position.set(centerX, 0, z);

        const slab = new THREE.Mesh(getUnitBox(), material);
        slab.scale.set(width, GATE_HEIGHT, GATE_DEPTH);
        slab.position.y = base + GATE_HEIGHT / 2;
        slab.castShadow = true;
        slab.receiveShadow = true;
        group.add(slab);

        const rubble = new THREE.InstancedMesh(getBoulderGeometry(0, 1), this.terrain.getInstancedMaterial(this.activeBiome), 14);
        rubble.castShadow = true;
        rubble.receiveShadow = true;

        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const euler = new THREE.Euler();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();

        for (let i = 0; i < 14; i++) {
            const t = i / 13;
            const x = (t * 2 - 1) * (width / 2 - 5);
            const size = 2.6 + ((i * 7919) % 13) / 13 * 3.4;
            position.set(x, base + size * 0.2, ((i % 3) - 1) * 3.2);
            euler.set(i * 0.7, i * 1.3, i * 0.4);
            quaternion.setFromEuler(euler);
            scale.set(size, size * 0.85, size);
            matrix.compose(position, quaternion, scale);
            rubble.setMatrixAt(i, matrix);
        }
        rubble.instanceMatrix.needsUpdate = true;
        rubble.computeBoundingSphere();
        group.add(rubble);

        const seal = new THREE.Mesh(
            new THREE.PlaneGeometry(width * 0.88, GATE_HEIGHT * 0.62),
            getCanyonSealMaterial(this.activeBiome)
        );
        seal.position.set(0, base + GATE_HEIGHT * 0.4, -GATE_DEPTH / 2 - 0.4);
        seal.renderOrder = 2;
        group.add(seal);

        content.group.add(group);

        const collider = new THREE.Box3(
            new THREE.Vector3(centerX - width / 2, base, z - GATE_DEPTH / 2),
            new THREE.Vector3(centerX + width / 2, base + GATE_HEIGHT, z + GATE_DEPTH / 2)
        );
        content.colliders.push(collider);

        return { group, collider };
    }

    rebuildCollisionGrid() {
        this.floor.collisionGrid.clear();
        if (this.floor.inHub) {
            for (const box of this.floor.hub.colliders) this.floor.collisionGrid.insert(box);
        } else {
            if (this.floor.current) for (const box of this.floor.current.colliders) this.floor.collisionGrid.insert(box);
            if (this.floor.pendingNext) for (const box of this.floor.pendingNext.colliders) this.floor.collisionGrid.insert(box);
        }
    }

    disposeContent(content: SegmentContent) {
        content.group.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh.isMesh) return;

            const instanced = obj as THREE.InstancedMesh;
            if (instanced.isInstancedMesh) instanced.dispose();

            if (!isCachedGeometry(mesh.geometry) && !isSharedNpcGeometry(mesh.geometry) && !isCanyonShapeGeometry(mesh.geometry)) {
                mesh.geometry.dispose();
            }

            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const material of materials) {
                if (!material) continue;
                if (isCachedMaterial(material) || this.terrain.isOwnedMaterial(material)) continue;
                material.dispose();
            }
        });

        this.floor.scene.remove(content.group);
    }

    dispose() {
        this.terrain.dispose();
    }
}
