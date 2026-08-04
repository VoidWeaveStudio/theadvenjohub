// src/features/game/entities/furniture/Wardrobe.ts
import * as THREE from "three";

const WOOD_COLOR = 0x8a6a4a;
const PANEL_COLOR = 0x6b4a2f;
const HANDLE_COLOR = 0xc9a227;

const CARCASS_WIDTH = 1.0;
const CARCASS_HEIGHT = 1.5;
const CARCASS_DEPTH = 0.5;
const PLINTH_HEIGHT = 0.08;

const DOOR_WIDTH = 0.47;
const DOOR_HEIGHT = 1.38;
const DOOR_THICKNESS = 0.035;
const HALF_DOOR_WIDTH = DOOR_WIDTH / 2;

// Doors ease open around a hinge on the carcass's outer edge; positive rotation
// on the right pivot and negative on the left swings both outward (away from
// each other) rather than into the cabinet — see rotation.y sign derivation
// in the plan notes. Flip both signs together if it visually opens backwards.
const OPEN_ANGLE = Math.PI * 0.55;
const OPEN_DURATION_MS = 450;

let carcassGeometry: THREE.BoxGeometry | null = null;
let plinthGeometry: THREE.BoxGeometry | null = null;
let corniceGeometry: THREE.BoxGeometry | null = null;
let doorFrameGeometry: THREE.BoxGeometry | null = null;
let doorPanelGeometry: THREE.BoxGeometry | null = null;
let handleGeometry: THREE.CylinderGeometry | null = null;
let woodMaterial: THREE.MeshStandardMaterial | null = null;
let panelMaterial: THREE.MeshStandardMaterial | null = null;
let handleMaterial: THREE.MeshStandardMaterial | null = null;
let ghostMaterial: THREE.MeshStandardMaterial | null = null;

function getCarcassGeometry(): THREE.BoxGeometry {
    if (!carcassGeometry) carcassGeometry = new THREE.BoxGeometry(CARCASS_WIDTH, CARCASS_HEIGHT, CARCASS_DEPTH);
    return carcassGeometry;
}
function getPlinthGeometry(): THREE.BoxGeometry {
    if (!plinthGeometry) plinthGeometry = new THREE.BoxGeometry(CARCASS_WIDTH + 0.04, PLINTH_HEIGHT, CARCASS_DEPTH + 0.02);
    return plinthGeometry;
}
function getCorniceGeometry(): THREE.BoxGeometry {
    if (!corniceGeometry) corniceGeometry = new THREE.BoxGeometry(CARCASS_WIDTH + 0.06, 0.06, CARCASS_DEPTH + 0.04);
    return corniceGeometry;
}
function getDoorFrameGeometry(): THREE.BoxGeometry {
    if (!doorFrameGeometry) doorFrameGeometry = new THREE.BoxGeometry(DOOR_WIDTH, DOOR_HEIGHT, DOOR_THICKNESS);
    return doorFrameGeometry;
}
function getDoorPanelGeometry(): THREE.BoxGeometry {
    if (!doorPanelGeometry) doorPanelGeometry = new THREE.BoxGeometry(DOOR_WIDTH - 0.1, DOOR_HEIGHT - 0.32, 0.018);
    return doorPanelGeometry;
}
function getHandleGeometry(): THREE.CylinderGeometry {
    if (!handleGeometry) handleGeometry = new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8);
    return handleGeometry;
}
function getWoodMaterial(): THREE.MeshStandardMaterial {
    if (!woodMaterial) woodMaterial = new THREE.MeshStandardMaterial({ color: WOOD_COLOR, roughness: 0.6, metalness: 0.05 });
    return woodMaterial;
}
function getPanelMaterial(): THREE.MeshStandardMaterial {
    if (!panelMaterial) panelMaterial = new THREE.MeshStandardMaterial({ color: PANEL_COLOR, roughness: 0.55, metalness: 0.05 });
    return panelMaterial;
}
function getHandleMaterial(): THREE.MeshStandardMaterial {
    if (!handleMaterial) handleMaterial = new THREE.MeshStandardMaterial({ color: HANDLE_COLOR, roughness: 0.3, metalness: 0.7 });
    return handleMaterial;
}
function getGhostMaterial(): THREE.MeshStandardMaterial {
    if (!ghostMaterial) {
        ghostMaterial = new THREE.MeshStandardMaterial({
            color: WOOD_COLOR, roughness: 0.6, metalness: 0.05, transparent: true, opacity: 0.5,
        });
    }
    return ghostMaterial;
}

function buildDoor(mat: THREE.Material, side: "left" | "right"): THREE.Group {
    const door = new THREE.Group();

    const frame = new THREE.Mesh(getDoorFrameGeometry(), mat);
    door.add(frame);

    const panel = new THREE.Mesh(getDoorPanelGeometry(), mat === getGhostMaterial() ? mat : getPanelMaterial());
    panel.position.z = DOOR_THICKNESS / 2 + 0.01;
    door.add(panel);

    const freeEdgeSign = side === "left" ? 1 : -1;
    const handle = new THREE.Mesh(getHandleGeometry(), mat === getGhostMaterial() ? mat : getHandleMaterial());
    handle.rotation.x = Math.PI / 2;
    handle.position.set(freeEdgeSign * (HALF_DOOR_WIDTH - 0.06), 0, DOOR_THICKNESS / 2 + 0.03);
    door.add(handle);

    return door;
}

export class Wardrobe {
    public readonly id: string;
    public readonly mesh: THREE.Group;

    private leftPivot: THREE.Group;
    private rightPivot: THREE.Group;
    private isOpen = false;
    private animStart = 0;
    private animFromLeft = 0;
    private animFromRight = 0;

    constructor(id: string, ghost: boolean = false) {
        this.id = id;
        this.mesh = new THREE.Group();
        const mat = ghost ? getGhostMaterial() : getWoodMaterial();

        const plinthY = PLINTH_HEIGHT / 2;
        const plinth = new THREE.Mesh(getPlinthGeometry(), mat);
        plinth.position.y = plinthY;
        this.mesh.add(plinth);

        const carcassY = PLINTH_HEIGHT + CARCASS_HEIGHT / 2;
        const carcass = new THREE.Mesh(getCarcassGeometry(), mat);
        carcass.position.y = carcassY;
        this.mesh.add(carcass);

        const corniceY = PLINTH_HEIGHT + CARCASS_HEIGHT + 0.03;
        const cornice = new THREE.Mesh(getCorniceGeometry(), mat);
        cornice.position.y = corniceY;
        this.mesh.add(cornice);

        const doorY = PLINTH_HEIGHT + CARCASS_HEIGHT / 2;
        const frontZ = CARCASS_DEPTH / 2;
        const hingeX = CARCASS_WIDTH / 2;

        this.leftPivot = new THREE.Group();
        this.leftPivot.position.set(-hingeX, doorY, frontZ);
        const leftDoor = buildDoor(mat, "left");
        leftDoor.position.x = HALF_DOOR_WIDTH;
        this.leftPivot.add(leftDoor);
        this.mesh.add(this.leftPivot);

        this.rightPivot = new THREE.Group();
        this.rightPivot.position.set(hingeX, doorY, frontZ);
        const rightDoor = buildDoor(mat, "right");
        rightDoor.position.x = -HALF_DOOR_WIDTH;
        this.rightPivot.add(rightDoor);
        this.mesh.add(this.rightPivot);

        this.mesh.traverse((child) => {
            const meshChild = child as THREE.Mesh;
            if (meshChild.isMesh) {
                meshChild.castShadow = !ghost;
                meshChild.receiveShadow = !ghost;
            }
        });

        if (!ghost) {
            this.mesh.userData.interactionId = `item-${id}`;
            this.mesh.userData.itemId = "wardrobe";
        }
    }

    toggleOpen() {
        this.isOpen = !this.isOpen;
        this.animStart = performance.now();
        this.animFromLeft = this.leftPivot.rotation.y;
        this.animFromRight = this.rightPivot.rotation.y;
    }

    update(now: number) {
        const targetLeft = this.isOpen ? -OPEN_ANGLE : 0;
        const targetRight = this.isOpen ? OPEN_ANGLE : 0;
        const t = Math.min(1, (now - this.animStart) / OPEN_DURATION_MS);
        const eased = 1 - Math.pow(1 - t, 2);
        this.leftPivot.rotation.y = this.animFromLeft + (targetLeft - this.animFromLeft) * eased;
        this.rightPivot.rotation.y = this.animFromRight + (targetRight - this.animFromRight) * eased;
    }

    dispose(scene: THREE.Scene) {
        scene.remove(this.mesh);
    }
}
