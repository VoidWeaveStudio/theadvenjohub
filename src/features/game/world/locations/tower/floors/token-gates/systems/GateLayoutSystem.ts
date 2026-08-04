// src/features/game/world/locations/tower/floors/token-gates/systems/GateLayoutSystem.ts
import * as THREE from "three";
import type { TokenGatesFloor } from "../../TokenGatesFloor";

export const HALL_HALF = 50;
export const GATE_SLOTS_PER_SIDE_WALL = 6;
export const SOUTH_GATE_COUNT = 4;
export const TOTAL_GATE_SLOTS = GATE_SLOTS_PER_SIDE_WALL * 3 + SOUTH_GATE_COUNT;

const WALL_HEIGHT = 26;
const WALL_THICKNESS = 3;
const WALL_MARGIN = 8;
const SOUTH_GAP_HALF_WIDTH = 6;
const GATE_INSET = 4;

const COLUMN_HALF_SPACING = 3;
const COLUMN_HEIGHT = 9;
const ARCH_RADIUS = 3.2;

export interface GateSlot {
    index: number;
    group: THREE.Group;
    mountPoint: THREE.Group;
    occupantFactionId: string | null;
}

let sharedColumnGeometry: THREE.CylinderGeometry | null = null;
let sharedArchGeometry: THREE.TorusGeometry | null = null;
let sharedArchTrimGeometry: THREE.TorusGeometry | null = null;
let sharedColumnPlinthGeometry: THREE.CylinderGeometry | null = null;
let sharedStoneMaterial: THREE.MeshStandardMaterial | null = null;
let sharedTrimMaterial: THREE.MeshStandardMaterial | null = null;

function getColumnGeometry(): THREE.CylinderGeometry {
    if (!sharedColumnGeometry) sharedColumnGeometry = new THREE.CylinderGeometry(0.5, 0.7, COLUMN_HEIGHT, 12);
    return sharedColumnGeometry;
}
function getColumnPlinthGeometry(): THREE.CylinderGeometry {
    if (!sharedColumnPlinthGeometry) sharedColumnPlinthGeometry = new THREE.CylinderGeometry(0.85, 0.95, 0.5, 12);
    return sharedColumnPlinthGeometry;
}
function getArchGeometry(): THREE.TorusGeometry {
    // arc = PI sweeps the ring from local +X through +Y to -X — a dome shape
    // sitting above the X axis, with no extra rotation needed (see plan notes).
    if (!sharedArchGeometry) sharedArchGeometry = new THREE.TorusGeometry(ARCH_RADIUS, 0.38, 10, 28, Math.PI);
    return sharedArchGeometry;
}
function getArchTrimGeometry(): THREE.TorusGeometry {
    if (!sharedArchTrimGeometry) sharedArchTrimGeometry = new THREE.TorusGeometry(ARCH_RADIUS + 0.2, 0.07, 8, 28, Math.PI);
    return sharedArchTrimGeometry;
}
function getStoneMaterial(): THREE.MeshStandardMaterial {
    if (!sharedStoneMaterial) sharedStoneMaterial = new THREE.MeshStandardMaterial({ color: 0x8a6d4a, roughness: 0.85, metalness: 0.05 });
    return sharedStoneMaterial;
}
function getTrimMaterial(): THREE.MeshStandardMaterial {
    if (!sharedTrimMaterial) {
        sharedTrimMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd699, roughness: 0.35, metalness: 0.5, emissive: 0xe8a33d, emissiveIntensity: 0.7,
        });
    }
    return sharedTrimMaterial;
}

interface SlotDef {
    x: number;
    z: number;
    rotY: number;
}

function buildSlotDefs(): SlotDef[] {
    const defs: SlotDef[] = [];
    const usableWidth = HALL_HALF * 2 - WALL_MARGIN * 2;
    const step = usableWidth / (GATE_SLOTS_PER_SIDE_WALL - 1);

    for (let i = 0; i < GATE_SLOTS_PER_SIDE_WALL; i++) {
        defs.push({ x: -HALL_HALF + WALL_MARGIN + i * step, z: -HALL_HALF + GATE_INSET, rotY: 0 });
    }
    for (let i = 0; i < GATE_SLOTS_PER_SIDE_WALL; i++) {
        defs.push({ x: HALL_HALF - GATE_INSET, z: -HALL_HALF + WALL_MARGIN + i * step, rotY: -Math.PI / 2 });
    }
    for (let i = 0; i < GATE_SLOTS_PER_SIDE_WALL; i++) {
        defs.push({ x: -HALL_HALF + GATE_INSET, z: -HALL_HALF + WALL_MARGIN + i * step, rotY: Math.PI / 2 });
    }

    const southSegStart = SOUTH_GAP_HALF_WIDTH;
    const southSegEnd = HALL_HALF - WALL_MARGIN;
    const southStep = (southSegEnd - southSegStart) / (SOUTH_GATE_COUNT / 2 - 1);
    for (const side of [-1, 1] as const) {
        for (let i = 0; i < SOUTH_GATE_COUNT / 2; i++) {
            defs.push({ x: side * (southSegStart + i * southStep), z: HALL_HALF - GATE_INSET, rotY: Math.PI });
        }
    }

    return defs;
}

export class GateLayoutSystem {
    public slots: GateSlot[] = [];
    public exitZone!: THREE.Box3;

    constructor(private floor: TokenGatesFloor) { }

    create() {
        this.buildFloor();
        this.buildWalls();
        this.buildGateArchways();

        this.exitZone = new THREE.Box3(
            new THREE.Vector3(-SOUTH_GAP_HALF_WIDTH, 0, HALL_HALF - 6),
            new THREE.Vector3(SOUTH_GAP_HALF_WIDTH, 20, HALL_HALF + 10)
        );
    }

    private buildFloor() {
        const floorMat = new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 1.0, metalness: 0.0 });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL_HALF * 2, HALL_HALF * 2, 32, 32), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.floor.scene.add(floor);
    }

    private buildWallSegment(centerX: number, centerZ: number, width: number, rotY: number, mat: THREE.Material) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(width, WALL_HEIGHT, WALL_THICKNESS), mat);
        wall.position.set(centerX, WALL_HEIGHT / 2, centerZ);
        wall.rotation.y = rotY;
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.floor.scene.add(wall);
        this.floor.collisionGrid.insert(new THREE.Box3().setFromObject(wall));
    }

    private buildWalls() {
        const wallMat = new THREE.MeshStandardMaterial({ color: 0xb59a6b, roughness: 0.95, metalness: 0.0 });
        const fullSpan = HALL_HALF * 2 + WALL_THICKNESS;

        this.buildWallSegment(0, -HALL_HALF - WALL_THICKNESS / 2, fullSpan, 0, wallMat);
        this.buildWallSegment(HALL_HALF + WALL_THICKNESS / 2, 0, fullSpan, Math.PI / 2, wallMat);
        this.buildWallSegment(-HALL_HALF - WALL_THICKNESS / 2, 0, fullSpan, Math.PI / 2, wallMat);

        const southSegWidth = HALL_HALF - SOUTH_GAP_HALF_WIDTH;
        const southSegCenterOffset = SOUTH_GAP_HALF_WIDTH + southSegWidth / 2;
        this.buildWallSegment(-southSegCenterOffset, HALL_HALF + WALL_THICKNESS / 2, southSegWidth, 0, wallMat);
        this.buildWallSegment(southSegCenterOffset, HALL_HALF + WALL_THICKNESS / 2, southSegWidth, 0, wallMat);
    }

    private buildGateArchways() {
        const defs = buildSlotDefs();
        const stoneMat = getStoneMaterial();
        const trimMat = getTrimMaterial();

        defs.forEach((def, index) => {
            const group = new THREE.Group();
            group.position.set(def.x, 0, def.z);
            group.rotation.y = def.rotY;

            const leftPlinth = new THREE.Mesh(getColumnPlinthGeometry(), stoneMat);
            leftPlinth.position.set(-COLUMN_HALF_SPACING, 0.25, 0);
            const rightPlinth = new THREE.Mesh(getColumnPlinthGeometry(), stoneMat);
            rightPlinth.position.set(COLUMN_HALF_SPACING, 0.25, 0);

            const leftColumn = new THREE.Mesh(getColumnGeometry(), stoneMat);
            leftColumn.position.set(-COLUMN_HALF_SPACING, 0.5 + COLUMN_HEIGHT / 2, 0);
            leftColumn.castShadow = true;
            const rightColumn = new THREE.Mesh(getColumnGeometry(), stoneMat);
            rightColumn.position.set(COLUMN_HALF_SPACING, 0.5 + COLUMN_HEIGHT / 2, 0);
            rightColumn.castShadow = true;

            const arch = new THREE.Mesh(getArchGeometry(), stoneMat);
            arch.position.set(0, 0.5 + COLUMN_HEIGHT, 0);
            arch.castShadow = true;
            const archTrim = new THREE.Mesh(getArchTrimGeometry(), trimMat);
            archTrim.position.copy(arch.position);

            group.add(leftPlinth, rightPlinth, leftColumn, rightColumn, arch, archTrim);

            const mountPoint = new THREE.Group();
            mountPoint.position.set(0, 0.5 + COLUMN_HEIGHT * 0.55, 0);
            group.add(mountPoint);

            const glow = new THREE.PointLight(0xe8a33d, 0.9, 10);
            glow.position.set(0, 0.5 + COLUMN_HEIGHT * 0.75, 1.2);
            group.add(glow);

            this.floor.scene.add(group);
            this.floor.collisionGrid.insert(new THREE.Box3().setFromObject(group));

            this.slots.push({ index, group, mountPoint, occupantFactionId: null });
        });
    }

    dispose() {
        for (const slot of this.slots) {
            this.floor.scene.remove(slot.group);
        }
        this.slots = [];
    }
}
