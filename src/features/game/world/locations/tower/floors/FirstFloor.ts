// src/features/game/world/locations/tower/floors/FirstFloor.ts
import * as THREE from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";
import { CollisionGrid } from "../../../CollisionGrid";

export interface CanyonSegmentInfo {
    segment: number;
    maxSegmentReached: number;
    cleared: boolean;
    name: string;
}

export interface CanyonClearedInfo {
    clearedSegment: number;
    segment: number;
    maxSegmentReached: number;
    name: string;
}

export interface CanyonHubInfo {
    maxSegmentReached: number;
}

const CANYON_HALF_WIDTH = 50;
const CANYON_HUB_LENGTH = 100;
const CANYON_START_Z = CANYON_HUB_LENGTH;
const SAFE_ENTRANCE_DEPTH = 100;
const COMBAT_DEPTH = 360;
const BOSS_ZONE_DEPTH = 40;
const SEGMENT_LENGTH = SAFE_ENTRANCE_DEPTH + COMBAT_DEPTH + BOSS_ZONE_DEPTH;
const SEAL_TRIGGER_MARGIN = 20;
const FLOOR_HALF_WIDTH = 100;

function segmentStartZ(segment: number): number {
    return CANYON_START_Z + (segment - 1) * SEGMENT_LENGTH;
}

function pathOffsetX(z: number): number {
    if (z <= CANYON_START_Z) return 0;
    const rel = z - CANYON_START_Z;
    return Math.sin(rel * 0.008) * 22 + Math.sin(rel * 0.021 + 1.7) * 9;
}

function halfWidthAt(z: number): number {
    if (z <= CANYON_START_Z) return CANYON_HALF_WIDTH;
    const rel = z - CANYON_START_Z;
    return Math.max(25, CANYON_HALF_WIDTH + Math.sin(rel * 0.006 + 0.5) * 15);
}

let rockTextureCache: THREE.Texture | null = null;
function getCanyonRockTexture(): THREE.Texture {
    if (rockTextureCache) return rockTextureCache;

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#B79868";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(200,175,130,0.3)");
    gradient.addColorStop(1, "rgba(95,72,48,0.3)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 900; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const r = 3 + Math.random() * 9;
        const lighter = Math.random() > 0.5;
        ctx.fillStyle = lighter
            ? `rgba(255,240,210,${0.03 + Math.random() * 0.05})`
            : `rgba(60,40,20,${0.03 + Math.random() * 0.06})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = "rgba(70,48,26,0.3)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
        let x = Math.random() * canvas.width;
        let y = Math.random() * canvas.height;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 4; j++) {
            x += (Math.random() - 0.5) * 26;
            y += (Math.random() - 0.5) * 26;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    rockTextureCache = texture;
    return texture;
}

let rockMaterialCache: THREE.MeshStandardMaterial | null = null;
function getCanyonRockMaterial(): THREE.MeshStandardMaterial {
    if (rockMaterialCache) return rockMaterialCache;
    const texture = getCanyonRockTexture();
    texture.repeat.set(3, 3);
    rockMaterialCache = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.97, metalness: 0.0 });
    return rockMaterialCache;
}

let floorTextureCache: THREE.Texture | null = null;
function getCanyonFloorTexture(): THREE.Texture {
    if (floorTextureCache) return floorTextureCache;

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#C7A165";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 500; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        ctx.fillStyle = `rgba(120,80,40,${0.03 + Math.random() * 0.06})`;
        ctx.beginPath();
        ctx.arc(x, y, 2 + Math.random() * 6, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = "rgba(94,62,32,0.45)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
        let x = Math.random() * canvas.width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y <= canvas.height; y += 20) {
            x += (Math.random() - 0.5) * 30;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    floorTextureCache = texture;
    return texture;
}

let floorMaterialCache: THREE.MeshStandardMaterial | null = null;
function getCanyonFloorMaterial(): THREE.MeshStandardMaterial {
    if (floorMaterialCache) return floorMaterialCache;
    const texture = getCanyonFloorTexture();
    texture.repeat.set(8, 50);
    floorMaterialCache = new THREE.MeshStandardMaterial({ map: texture, roughness: 1.0, metalness: 0.0 });
    return floorMaterialCache;
}

function isCachedMaterial(mat: THREE.Material): boolean {
    return mat === rockMaterialCache || mat === floorMaterialCache || mat === arrowMaterialCache;
}

let arrowGeometryCache: THREE.ShapeGeometry | null = null;
function getArrowGeometry(): THREE.ShapeGeometry {
    if (arrowGeometryCache) return arrowGeometryCache;
    const shape = new THREE.Shape();
    shape.moveTo(0, 2.4);
    shape.lineTo(1.2, 0.6);
    shape.lineTo(0.5, 0.6);
    shape.lineTo(0.5, -1.4);
    shape.lineTo(-0.5, -1.4);
    shape.lineTo(-0.5, 0.6);
    shape.lineTo(-1.2, 0.6);
    shape.closePath();
    arrowGeometryCache = new THREE.ShapeGeometry(shape);
    return arrowGeometryCache;
}

let arrowMaterialCache: THREE.MeshBasicMaterial | null = null;
function getArrowMaterial(): THREE.MeshBasicMaterial {
    if (arrowMaterialCache) return arrowMaterialCache;
    arrowMaterialCache = new THREE.MeshBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    return arrowMaterialCache;
}

interface GateWall {
    group: THREE.Group;
    collider: THREE.Box3;
}

interface SegmentContent {
    group: THREE.Group;
    colliders: THREE.Box3[];
    interactables: THREE.Object3D[];
    farGate: GateWall;
    crystal?: THREE.Group;
    dispatcher?: THREE.Group;
    arrow?: THREE.Mesh;
}

interface GateAnimation {
    gate: GateWall;
    mode: "crumble" | "reform";
    startTime: number;
}

export class FirstFloor extends TowerFloor {
    private hub!: SegmentContent;
    private current: SegmentContent | null = null;
    private pendingNext: SegmentContent | null = null;
    private thresholdZ: number | null = null;
    private animations: GateAnimation[] = [];
    private dispatcherTime: number = 0;
    private hubGateOpen: boolean = false;

    public segment: number = 1;
    public inHub: boolean = true;

    public onInteractablesChanged?: (added: THREE.Object3D[], removed: THREE.Object3D[]) => void;
    public onReadyToEnterDungeon?: () => void;
    public onSegmentCrossed?: () => void;

    constructor() {
        super('tower-first-floor', 'Slime Valley');
        this.collisionGrid = new CollisionGrid(300);
    }

    create(resourceManager: ResourceManager): void {
        this.scene.background = new THREE.Color(0xC9A876);
        this.scene.fog = new THREE.FogExp2(0xC9A876, 0.0028);

        const sun = new THREE.DirectionalLight(0xfff2d8, 1.3);
        sun.position.set(120, 220, 80);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -150;
        sun.shadow.camera.right = 150;
        sun.shadow.camera.top = 150;
        sun.shadow.camera.bottom = -150;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 700;
        this.scene.add(sun);

        this.scene.add(new THREE.HemisphereLight(0xE8C99A, 0x8B5A2B, 0.9));

        this.hub = this.buildHub();
        this.rebuildCollisionGrid();
    }

    private buildHub(): SegmentContent {
        const content: SegmentContent = {
            group: new THREE.Group(),
            colliders: [],
            interactables: [],
            farGate: null as unknown as GateWall,
        };
        this.scene.add(content.group);

        this.buildFloor(content, -20, CANYON_START_Z);
        this.buildCorridorWalls(content, -20, CANYON_START_Z);
        this.buildDeadEnd(content, -15);
        this.buildCrystalAndDispatcher(content, 40);
        this.buildArrowIndicator(content, 70, true);
        content.farGate = this.buildGateWallInto(content, CANYON_START_Z);

        return content;
    }

    private buildSegment(segment: number): SegmentContent {
        const content: SegmentContent = {
            group: new THREE.Group(),
            colliders: [],
            interactables: [],
            farGate: null as unknown as GateWall,
        };
        this.scene.add(content.group);

        const startZ = segmentStartZ(segment);
        const endZ = startZ + SEGMENT_LENGTH;

        this.buildFloor(content, startZ, endZ);
        this.buildCorridorWalls(content, startZ, endZ);
        this.buildReturnTeleporter(content, startZ + 15);
        this.buildArrowIndicator(content, startZ + 30, false);
        content.farGate = this.buildGateWallInto(content, endZ);

        return content;
    }

    private buildArrowIndicator(content: SegmentContent, z: number, visible: boolean) {
        const centerX = pathOffsetX(z);
        const mesh = new THREE.Mesh(getArrowGeometry(), getArrowMaterial());
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(centerX, 0.15, z);
        mesh.visible = visible;
        mesh.renderOrder = 1;
        content.group.add(mesh);
        content.arrow = mesh;
    }

    private buildFloor(content: SegmentContent, startZ: number, endZ: number) {
        const length = endZ - startZ;
        const floorGeo = new THREE.PlaneGeometry(FLOOR_HALF_WIDTH * 2, length, 24, Math.max(8, Math.floor(length / 20)));
        floorGeo.rotateX(-Math.PI / 2);
        floorGeo.translate(0, 0, startZ + length / 2);

        const floor = new THREE.Mesh(floorGeo, getCanyonFloorMaterial());
        floor.receiveShadow = true;
        content.group.add(floor);

        content.colliders.push(new THREE.Box3(
            new THREE.Vector3(-FLOOR_HALF_WIDTH, -0.5, startZ),
            new THREE.Vector3(FLOOR_HALF_WIDTH, -0.05, endZ)
        ));
    }

    private buildCorridorWalls(content: SegmentContent, startZ: number, endZ: number) {
        const mat = getCanyonRockMaterial();
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

    private buildDeadEnd(content: SegmentContent, z: number) {
        const centerX = pathOffsetX(z);
        const halfWidth = halfWidthAt(z);
        const wall = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 + 10, 40, 8), getCanyonRockMaterial());
        wall.position.set(centerX, 20, z - 4);
        wall.castShadow = true;
        wall.receiveShadow = true;
        content.group.add(wall);

        content.colliders.push(new THREE.Box3(
            new THREE.Vector3(centerX - halfWidth - 5, 0, z - 8),
            new THREE.Vector3(centerX + halfWidth + 5, 40, z)
        ));
    }

    private buildCrystalAndDispatcher(content: SegmentContent, crystalZ: number) {
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

        const dispatcher = new THREE.Group();
        dispatcher.position.set(centerX + 14, 0, crystalZ - 5);

        const robe = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 1.0, 4, 8), new THREE.MeshStandardMaterial({ color: 0x4a5d8b, roughness: 0.75, metalness: 0.05 }));
        robe.position.y = 1.15;
        robe.castShadow = true;
        dispatcher.add(robe);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), new THREE.MeshStandardMaterial({ color: 0xd8ac8a, roughness: 0.8 }));
        head.position.y = 1.95;
        head.castShadow = true;
        dispatcher.add(head);

        const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x33406b, roughness: 0.8 }));
        hat.position.y = 2.25;
        dispatcher.add(hat);

        const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), new THREE.MeshStandardMaterial({ color: 0x9ad6ff, emissive: 0x5cb3ff, emissiveIntensity: 5 }));
        marker.position.y = 2.8;
        dispatcher.add(marker);

        const glow = new THREE.PointLight(0x6fa8ff, 1.4, 6);
        glow.position.set(0, 2, 0.5);
        dispatcher.add(glow);

        dispatcher.userData.interactionId = "canyon-dispatcher";
        content.group.add(dispatcher);
        content.interactables.push(dispatcher);
        content.dispatcher = dispatcher;

        content.colliders.push(new THREE.Box3(
            new THREE.Vector3(dispatcher.position.x - 0.5, 0, dispatcher.position.z - 0.5),
            new THREE.Vector3(dispatcher.position.x + 0.5, 2.5, dispatcher.position.z + 0.5)
        ));
    }

    private buildReturnTeleporter(content: SegmentContent, z: number) {
        const centerX = pathOffsetX(z);
        const group = new THREE.Group();
        group.position.set(centerX, 0, z);

        const pad = new THREE.Mesh(
            new THREE.CylinderGeometry(3, 3, 0.3, 24),
            new THREE.MeshStandardMaterial({ color: 0x2a3a5a, emissive: 0x4fd1ff, emissiveIntensity: 0.5, roughness: 0.5 })
        );
        pad.position.y = 0.15;
        group.add(pad);

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(2.6, 0.15, 8, 32),
            new THREE.MeshStandardMaterial({ color: 0x4fd1ff, emissive: 0x4fd1ff, emissiveIntensity: 2 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.3;
        group.add(ring);

        const light = new THREE.PointLight(0x4fd1ff, 3, 16);
        light.position.y = 2;
        group.add(light);

        group.userData.interactionId = "canyon-return";
        content.group.add(group);
        content.interactables.push(group);
    }

    private buildGateWallInto(content: SegmentContent, z: number): GateWall {
        const mat = getCanyonRockMaterial();
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

    private rebuildCollisionGrid() {
        this.collisionGrid.clear();
        if (this.inHub) {
            for (const box of this.hub.colliders) this.collisionGrid.insert(box);
        } else {
            if (this.current) for (const box of this.current.colliders) this.collisionGrid.insert(box);
            if (this.pendingNext) for (const box of this.pendingNext.colliders) this.collisionGrid.insert(box);
        }
    }

    private disposeContent(content: SegmentContent) {
        content.group.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if ((mesh as any).isMesh) {
                if (mesh.geometry !== arrowGeometryCache) mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m) => { if (!isCachedMaterial(m)) m.dispose(); });
                } else if (mesh.material && !isCachedMaterial(mesh.material as THREE.Material)) {
                    (mesh.material as THREE.Material).dispose();
                }
            }
        });
        this.scene.remove(content.group);
    }

    private startCrumble(gate: GateWall) {
        this.animations = this.animations.filter((a) => a.gate !== gate);
        this.animations.push({ gate, mode: "crumble", startTime: performance.now() });
    }

    private startReform(gate: GateWall) {
        gate.group.scale.y = 0.01;
        this.animations = this.animations.filter((a) => a.gate !== gate);
        this.animations.push({ gate, mode: "reform", startTime: performance.now() });
    }

    private resetGate(gate: GateWall, content: SegmentContent) {
        this.animations = this.animations.filter((a) => a.gate !== gate);
        gate.group.scale.set(1, 1, 1);
        gate.group.position.y = 0;
        if (!content.colliders.includes(gate.collider)) content.colliders.push(gate.collider);
    }

    private updateAnimations() {
        if (this.animations.length === 0) return;
        const now = performance.now();
        this.animations = this.animations.filter((anim) => {
            const t = Math.min(1, (now - anim.startTime) / 1200);
            if (anim.mode === "crumble") {
                anim.gate.group.scale.y = 1 - t;
                anim.gate.group.position.y = -t * 5;
            } else {
                anim.gate.group.scale.y = t;
            }
            return t < 1;
        });
    }

    private pulseArrow(mesh: THREE.Mesh, time: number) {
        const s = 1 + Math.sin(time * 3) * 0.2;
        mesh.scale.set(s, s, 1);
    }

    public applyFreshSegment(info: CanyonSegmentInfo): void {
        const removed = [...(this.current?.interactables ?? []), ...(this.pendingNext?.interactables ?? [])];
        if (this.current) this.disposeContent(this.current);
        if (this.pendingNext) this.disposeContent(this.pendingNext);
        this.pendingNext = null;
        this.thresholdZ = null;

        this.hubGateOpen = false;
        this.resetGate(this.hub.farGate, this.hub);

        this.inHub = false;
        this.segment = info.segment;
        this.current = this.buildSegment(info.segment);
        this.rebuildCollisionGrid();

        this.onInteractablesChanged?.(this.current.interactables, removed);
    }

    public applyHub(info: CanyonHubInfo): void {
        const removed = [...(this.current?.interactables ?? []), ...(this.pendingNext?.interactables ?? [])];
        if (this.current) this.disposeContent(this.current);
        if (this.pendingNext) this.disposeContent(this.pendingNext);
        this.current = null;
        this.pendingNext = null;
        this.thresholdZ = null;

        this.inHub = true;
        this.hubGateOpen = false;
        this.resetGate(this.hub.farGate, this.hub);
        this.rebuildCollisionGrid();

        this.onInteractablesChanged?.(this.hub.interactables, removed);
    }

    public applyBossDefeated(info: CanyonClearedInfo): void {
        if (!this.current) return;
        this.segment = info.segment;
        this.startCrumble(this.current.farGate);
        if (this.current.arrow) this.current.arrow.visible = true;

        const idx = this.current.colliders.indexOf(this.current.farGate.collider);
        if (idx !== -1) this.current.colliders.splice(idx, 1);

        const next = this.buildSegment(info.segment);
        this.pendingNext = next;
        this.thresholdZ = segmentStartZ(info.segment);
        this.rebuildCollisionGrid();

        this.onInteractablesChanged?.(next.interactables, []);
    }

    private sealBehindAndPromote() {
        if (!this.current || !this.pendingNext || this.thresholdZ === null) return;
        this.onSegmentCrossed?.();
        const removedInteractables = this.current.interactables;
        this.disposeContent(this.current);

        const sealGate = this.buildGateWallInto(this.pendingNext, this.thresholdZ);
        this.startReform(sealGate);

        this.current = this.pendingNext;
        this.pendingNext = null;
        this.thresholdZ = null;
        this.rebuildCollisionGrid();

        this.onInteractablesChanged?.([], removedInteractables);
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        if (this.hub.crystal) {
            const t = performance.now() * 0.002;
            this.hub.crystal.rotation.y += delta * 0.6;
            this.hub.crystal.position.y = 1.5 + Math.sin(t) * 0.2;
        }
        if (this.hub.dispatcher) {
            this.dispatcherTime += delta;
            this.hub.dispatcher.rotation.y = Math.sin(this.dispatcherTime * 0.4) * 0.3;
        }

        this.updateAnimations();

        const time = performance.now() * 0.001;
        if (this.hub.arrow?.visible) this.pulseArrow(this.hub.arrow, time);
        if (this.current?.arrow?.visible) this.pulseArrow(this.current.arrow, time);
        if (this.pendingNext?.arrow?.visible) this.pulseArrow(this.pendingNext.arrow, time);

        if (this.inHub) {
            if (!this.hubGateOpen && playerPosition.z >= CANYON_START_Z - 15 && playerPosition.z <= CANYON_START_Z + 5) {
                this.hubGateOpen = true;
                const idx = this.hub.colliders.indexOf(this.hub.farGate.collider);
                if (idx !== -1) this.hub.colliders.splice(idx, 1);
                this.rebuildCollisionGrid();
                this.startCrumble(this.hub.farGate);
                this.onReadyToEnterDungeon?.();
            }
        } else if (this.thresholdZ !== null && this.pendingNext && playerPosition.z >= this.thresholdZ + SEAL_TRIGGER_MARGIN) {
            this.sealBehindAndPromote();
        }
    }

    getSpawnPoint(): THREE.Vector3 {
        if (this.inHub) {
            return new THREE.Vector3(0, 2, 20);
        }
        const startZ = segmentStartZ(this.segment);
        return new THREE.Vector3(pathOffsetX(startZ + 20), 2, startZ + 20);
    }

    public override getInteractables(): THREE.Object3D[] {
        if (this.inHub) return this.hub.interactables;
        return [...(this.current?.interactables ?? []), ...(this.pendingNext?.interactables ?? [])];
    }

    dispose() {
        this.disposeContent(this.hub);
        if (this.current) this.disposeContent(this.current);
        if (this.pendingNext) this.disposeContent(this.pendingNext);
        super.dispose();
    }
}
