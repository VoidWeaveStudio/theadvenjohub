// src/features/game/world/locations/tower/floors/first-floor/systems/SegmentBuilderSystem.ts
import * as THREE from "three";
import { CANYON_START_Z, COMBAT_DEPTH, FLOOR_HALF_WIDTH, RETURN_PAD_OFFSET, SAFE_ENTRANCE_DEPTH, SEGMENT_LENGTH, pathOffsetX, halfWidthAt, segmentStartZ } from "../utils/canyonMath";
import { getArrowGeometry, getArrowMaterial, getCanyonFloorMaterial, getCanyonRockMaterial, isCachedGeometry, isCachedMaterial } from "../utils/canyonMaterials";
import { CanyonBiome, biomeForSegment } from "../utils/canyonBiomes";
import type { FirstFloor } from "../FirstFloor";
import { createNpcModel, NpcHandle, isSharedNpcGeometry } from "../../../../../../entities/npcModel";
import type { ResourceManager } from "../../../../../../core/ResourceManager";

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
    dispatcher?: NpcHandle;
    arrow?: THREE.Mesh;
    returnPad?: ReturnPad;
}

export class SegmentBuilderSystem {
    private activeBiome: CanyonBiome = biomeForSegment(1);

    constructor(private floor: FirstFloor) { }

    buildHub(resourceManager: ResourceManager): SegmentContent {
        const content: SegmentContent = {
            group: new THREE.Group(),
            colliders: [],
            interactables: [],
            farGate: null as unknown as GateWall,
        };
        this.floor.scene.add(content.group);

        this.buildFloor(content, -20, CANYON_START_Z);
        this.buildCorridorWalls(content, -20, CANYON_START_Z);
        this.buildDeadEnd(content, -15);
        this.buildCrystalAndDispatcher(content, 40, resourceManager);
        this.buildArrowIndicator(content, 70, true);
        content.farGate = this.buildGateWallInto(content, CANYON_START_Z);

        return content;
    }

    buildSegment(segment: number, biome: CanyonBiome = biomeForSegment(segment)): SegmentContent {
        this.activeBiome = biome;
        const content: SegmentContent = {
            group: new THREE.Group(),
            colliders: [],
            interactables: [],
            farGate: null as unknown as GateWall,
        };
        this.floor.scene.add(content.group);

        const startZ = segmentStartZ(segment);
        const endZ = startZ + SEGMENT_LENGTH;

        this.buildFloor(content, startZ, endZ);
        this.buildCorridorWalls(content, startZ, endZ);
        this.buildReturnTeleporter(content, startZ + SAFE_ENTRANCE_DEPTH + COMBAT_DEPTH + RETURN_PAD_OFFSET);
        this.buildArrowIndicator(content, startZ + 30, false);
        this.buildBiomeProps(content, startZ, endZ);
        content.farGate = this.buildGateWallInto(content, endZ);

        return content;
    }

    private buildBiomeProps(content: SegmentContent, startZ: number, endZ: number) {
        const biome = this.activeBiome;
        const accent = new THREE.Color(biome.accent);
        const count = 46;

        const trunkMat = new THREE.MeshStandardMaterial({ color: biome.groundColor, roughness: 0.9 });
        const accentMat = new THREE.MeshStandardMaterial({
            color: accent,
            emissive: accent,
            emissiveIntensity: biome.propStyle === "cactus" ? 0.15 : 1.5,
            roughness: 0.5,
        });

        for (let i = 0; i < count; i++) {
            const z = startZ + 40 + Math.random() * (endZ - startZ - 80);
            const centerX = pathOffsetX(z);
            const side = Math.random() < 0.5 ? -1 : 1;
            const x = centerX + side * (12 + Math.random() * (halfWidthAt(z) - 16));
            const prop = new THREE.Group();
            prop.position.set(x, 0, z);
            prop.rotation.y = Math.random() * Math.PI * 2;

            if (biome.propStyle === "cactus") {
                const h = 3 + Math.random() * 3;
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, h, 8), accentMat);
                body.position.y = h / 2;
                body.castShadow = true;
                prop.add(body);
                const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, h * 0.45, 8), accentMat);
                arm.position.set(0.6, h * 0.65, 0);
                arm.rotation.z = -0.6;
                prop.add(arm);
            } else if (biome.propStyle === "ember") {
                const h = 2 + Math.random() * 4;
                const spire = new THREE.Mesh(new THREE.ConeGeometry(0.9, h, 7), trunkMat);
                spire.position.y = h / 2;
                spire.castShadow = true;
                prop.add(spire);
                const coal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), accentMat);
                coal.position.y = h * 0.15;
                prop.add(coal);
            } else if (biome.propStyle === "ice") {
                const h = 3 + Math.random() * 5;
                const shard = new THREE.Mesh(new THREE.ConeGeometry(0.7, h, 6), accentMat);
                shard.position.y = h / 2;
                shard.rotation.z = (Math.random() - 0.5) * 0.35;
                shard.castShadow = true;
                prop.add(shard);
            } else if (biome.propStyle === "mushroom") {
                const h = 1.5 + Math.random() * 2.5;
                const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, h, 8), trunkMat);
                stalk.position.y = h / 2;
                prop.add(stalk);
                const cap = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), accentMat);
                cap.position.y = h;
                cap.scale.y = 0.62;
                cap.castShadow = true;
                prop.add(cap);
            } else {
                const h = 2.5 + Math.random() * 4.5;
                const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), accentMat);
                shard.scale.set(0.5, h / 1.6, 0.5);
                shard.position.y = h / 2;
                shard.rotation.z = (Math.random() - 0.5) * 0.6;
                prop.add(shard);
            }

            content.group.add(prop);
        }
    }

    buildArrowIndicator(content: SegmentContent, z: number, visible: boolean) {
        const centerX = pathOffsetX(z);
        const mesh = new THREE.Mesh(getArrowGeometry(), getArrowMaterial());
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(centerX, 0.15, z);
        mesh.visible = visible;
        mesh.renderOrder = 1;
        content.group.add(mesh);
        content.arrow = mesh;
    }

    buildFloor(content: SegmentContent, startZ: number, endZ: number) {
        const length = endZ - startZ;
        const floorGeo = new THREE.PlaneGeometry(FLOOR_HALF_WIDTH * 2, length, 24, Math.max(8, Math.floor(length / 20)));
        floorGeo.rotateX(-Math.PI / 2);
        floorGeo.translate(0, 0, startZ + length / 2);

        const floor = new THREE.Mesh(floorGeo, getCanyonFloorMaterial(this.activeBiome));
        floor.receiveShadow = true;
        content.group.add(floor);

        content.colliders.push(new THREE.Box3(
            new THREE.Vector3(-FLOOR_HALF_WIDTH, -0.5, startZ),
            new THREE.Vector3(FLOOR_HALF_WIDTH, -0.05, endZ)
        ));
    }

    buildCorridorWalls(content: SegmentContent, startZ: number, endZ: number) {
        const mat = getCanyonRockMaterial(this.activeBiome);
        const sides: Array<-1 | 1> = [-1, 1];
        const chunkDepth = 20;
        const chunkCount = Math.ceil((endZ - startZ) / chunkDepth);
        const baseHeight = 36;

        sides.forEach((side) => {
            for (let i = 0; i < chunkCount; i++) {
                const z = startZ + i * chunkDepth + chunkDepth / 2;
                const centerX = pathOffsetX(z);
                const halfWidth = halfWidthAt(z);

                const height = baseHeight + Math.random() * 20 - 6;
                const jitter = Math.random() * 4;
                const thickness = 6 + Math.random() * 6;
                const overhang = Math.random() > 0.75 ? Math.random() * 3 : 0;

                const chunk = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, chunkDepth + 1), mat);
                const xBase = centerX + side * (halfWidth + thickness / 2 - overhang);
                chunk.position.set(xBase - side * jitter, height / 2, z);
                chunk.rotation.y = (Math.random() - 0.5) * 0.12;
                chunk.castShadow = true;
                chunk.receiveShadow = true;
                content.group.add(chunk);

                const wallMinX = side === -1 ? xBase - thickness - 1 : xBase - 1;
                const wallMaxX = side === -1 ? xBase + 1 : xBase + thickness + 1;
                content.colliders.push(new THREE.Box3(
                    new THREE.Vector3(wallMinX, 0, z - chunkDepth / 2),
                    new THREE.Vector3(wallMaxX, height, z + chunkDepth / 2)
                ));

                if (Math.random() > 0.8) {
                    const spireHeight = 14 + Math.random() * 22;
                    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.5 + Math.random() * 2, spireHeight, 6), mat);
                    spire.position.set(chunk.position.x, height + spireHeight / 2 - 4, z);
                    spire.castShadow = true;
                    content.group.add(spire);
                }

                if (Math.random() > 0.88) {
                    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(2 + Math.random() * 2.5, 0), mat);
                    boulder.position.set(
                        centerX + side * (halfWidth - 2 + Math.random() * 4),
                        1 + Math.random() * 2,
                        z + (Math.random() - 0.5) * 10
                    );
                    boulder.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
                    boulder.castShadow = true;
                    content.group.add(boulder);
                }

                if (Math.random() > 0.75) {
                    const ledgeWidth = 3 + Math.random() * 4;
                    const ledgeThickness = 1.5 + Math.random() * 1.5;
                    const ledgeY = 4 + Math.random() * (height - 10);
                    const ledge = new THREE.Mesh(new THREE.BoxGeometry(ledgeWidth, ledgeThickness, chunkDepth * 0.7), mat);
                    ledge.position.set(chunk.position.x - side * (ledgeWidth / 2 - 1), ledgeY, z);
                    ledge.rotation.y = (Math.random() - 0.5) * 0.2;
                    ledge.castShadow = true;
                    ledge.receiveShadow = true;
                    content.group.add(ledge);
                }
            }
        });
    }

    buildDeadEnd(content: SegmentContent, z: number) {
        const centerX = pathOffsetX(z);
        const halfWidth = halfWidthAt(z);
        const wall = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 + 10, 40, 8), getCanyonRockMaterial(this.activeBiome));
        wall.position.set(centerX, 20, z - 4);
        wall.castShadow = true;
        wall.receiveShadow = true;
        content.group.add(wall);

        content.colliders.push(new THREE.Box3(
            new THREE.Vector3(centerX - halfWidth - 5, 0, z - 8),
            new THREE.Vector3(centerX + halfWidth + 5, 40, z)
        ));
    }

    buildCrystalAndDispatcher(content: SegmentContent, crystalZ: number, resourceManager: ResourceManager) {
        const centerX = pathOffsetX(crystalZ);

        const crystal = new THREE.Group();
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x3399ff, emissiveIntensity: 2 }));
        const shell = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 1), new THREE.MeshPhysicalMaterial({ color: 0x99ddff, transmission: 1, opacity: 0.6, transparent: true, roughness: 0, thickness: 0.5 }));
        const light = new THREE.PointLight(0x66ccff, 9, 45);
        light.position.set(0, 1.5, 0);
        crystal.add(core, shell, light);
        crystal.position.set(centerX, 1.5, crystalZ);
        crystal.userData.interactionId = "tower-crystal";
        content.group.add(crystal);
        content.interactables.push(crystal);
        content.crystal = crystal;

        content.colliders.push(new THREE.Box3(
            new THREE.Vector3(-1, 0, -1),
            new THREE.Vector3(1, 3, 1)
        ).translate(crystal.position));

        const dispatcher = createNpcModel(resourceManager, 0x4a5d8b, (headPos) => {
            const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x33406b, roughness: 0.8 }));
            hat.position.set(headPos.x, headPos.y + 0.35, headPos.z);

            const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), new THREE.MeshStandardMaterial({ color: 0x9ad6ff, emissive: 0x5cb3ff, emissiveIntensity: 5 }));
            marker.position.set(headPos.x, headPos.y + 0.9, headPos.z);

            const glow = new THREE.PointLight(0x6fa8ff, 1.4, 6);
            glow.position.set(headPos.x, headPos.y - 0.2, headPos.z + 0.3);

            return [hat, marker, glow];
        });
        dispatcher.group.position.set(centerX + 14, 0, crystalZ - 5);
        dispatcher.group.userData.interactionId = "canyon-dispatcher";
        content.group.add(dispatcher.group);
        content.interactables.push(dispatcher.group);
        content.dispatcher = dispatcher;

        content.colliders.push(new THREE.Box3(
            new THREE.Vector3(dispatcher.group.position.x - 0.5, 0, dispatcher.group.position.z - 0.5),
            new THREE.Vector3(dispatcher.group.position.x + 0.5, 2.5, dispatcher.group.position.z + 0.5)
        ));
    }

    buildReturnTeleporter(content: SegmentContent, z: number): ReturnPad {
        const centerX = pathOffsetX(z);
        const group = new THREE.Group();
        group.position.set(centerX, 0, z);

        const padMaterial = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, emissive: 0x4fd1ff, emissiveIntensity: 0, roughness: 0.5 });
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.3, 24), padMaterial);
        pad.position.y = 0.15;
        group.add(pad);

        const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x35506b, emissive: 0x4fd1ff, emissiveIntensity: 0 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.15, 8, 32), ringMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.3;
        group.add(ring);

        const light = new THREE.PointLight(0x4fd1ff, 0, 16);
        light.position.y = 2;
        group.add(light);

        group.userData.interactionId = "canyon-return";
        content.group.add(group);

        const handle: ReturnPad = {
            group,
            active: false,
            setActive(active: boolean) {
                if (this.active === active) return;
                this.active = active;
                padMaterial.emissiveIntensity = active ? 0.5 : 0;
                ringMaterial.color.setHex(active ? 0x4fd1ff : 0x35506b);
                ringMaterial.emissiveIntensity = active ? 2 : 0;
                light.intensity = active ? 3 : 0;
            },
        };

        content.returnPad = handle;
        return handle;
    }

    buildGateWallInto(content: SegmentContent, z: number): GateWall {
        const mat = getCanyonRockMaterial(this.activeBiome);
        const centerX = pathOffsetX(z);
        const halfWidth = halfWidthAt(z);
        const width = halfWidth * 2 + 10;
        const group = new THREE.Group();
        group.position.set(centerX, 0, z);

        const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 44, 10), mat);
        slab.position.y = 22;
        slab.castShadow = true;
        slab.receiveShadow = true;
        group.add(slab);

        for (let i = 0; i < 6; i++) {
            const bx = (Math.random() * 2 - 1) * (width / 2 - 6);
            const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(3 + Math.random() * 3, 0), mat);
            boulder.position.set(bx, 2 + Math.random() * 3, (Math.random() - 0.5) * 6);
            boulder.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
            boulder.castShadow = true;
            group.add(boulder);
        }

        const glow = new THREE.PointLight(0x7a2fd9, 2, 35);
        glow.position.set(0, 16, -6);
        group.add(glow);

        content.group.add(group);

        const collider = new THREE.Box3(
            new THREE.Vector3(centerX - width / 2, 0, z - 5),
            new THREE.Vector3(centerX + width / 2, 44, z + 5)
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
            if ((mesh as any).isMesh) {
                if (!isCachedGeometry(mesh.geometry) && !isSharedNpcGeometry(mesh.geometry)) mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m) => { if (!isCachedMaterial(m)) m.dispose(); });
                } else if (mesh.material && !isCachedMaterial(mesh.material as THREE.Material)) {
                    (mesh.material as THREE.Material).dispose();
                }
            }
        });
        this.floor.scene.remove(content.group);
    }
}
