// src/features/game/entities/furniture/Chair.ts
import * as THREE from "three";

const WOOD_COLOR = 0x8a6a4a;

let seatGeometry: THREE.BoxGeometry | null = null;
let backSlatGeometry: THREE.BoxGeometry | null = null;
let backRailGeometry: THREE.BoxGeometry | null = null;
let legGeometry: THREE.CylinderGeometry | null = null;
let stretcherGeometry: THREE.CylinderGeometry | null = null;
let woodMaterial: THREE.MeshStandardMaterial | null = null;
let ghostMaterial: THREE.MeshStandardMaterial | null = null;

function getSeatGeometry(): THREE.BoxGeometry {
    if (!seatGeometry) seatGeometry = new THREE.BoxGeometry(0.48, 0.05, 0.46);
    return seatGeometry;
}
function getBackSlatGeometry(): THREE.BoxGeometry {
    if (!backSlatGeometry) backSlatGeometry = new THREE.BoxGeometry(0.06, 0.42, 0.03);
    return backSlatGeometry;
}
function getBackRailGeometry(): THREE.BoxGeometry {
    if (!backRailGeometry) backRailGeometry = new THREE.BoxGeometry(0.44, 0.05, 0.04);
    return backRailGeometry;
}
function getLegGeometry(): THREE.CylinderGeometry {
    if (!legGeometry) legGeometry = new THREE.CylinderGeometry(0.02, 0.028, 0.45, 8);
    return legGeometry;
}
function getStretcherGeometry(): THREE.CylinderGeometry {
    if (!stretcherGeometry) stretcherGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.36, 6);
    return stretcherGeometry;
}
function getWoodMaterial(): THREE.MeshStandardMaterial {
    if (!woodMaterial) woodMaterial = new THREE.MeshStandardMaterial({ color: WOOD_COLOR, roughness: 0.65, metalness: 0.05 });
    return woodMaterial;
}
function getGhostMaterial(): THREE.MeshStandardMaterial {
    if (!ghostMaterial) {
        ghostMaterial = new THREE.MeshStandardMaterial({
            color: WOOD_COLOR, roughness: 0.65, metalness: 0.05, transparent: true, opacity: 0.5,
        });
    }
    return ghostMaterial;
}

export class Chair {
    public readonly id: string;
    public readonly mesh: THREE.Group;

    constructor(id: string, ghost: boolean = false) {
        this.id = id;
        this.mesh = new THREE.Group();
        const mat = ghost ? getGhostMaterial() : getWoodMaterial();

        const seatHeight = 0.46;
        const seat = new THREE.Mesh(getSeatGeometry(), mat);
        seat.position.y = seatHeight;
        this.mesh.add(seat);

        const backGroup = new THREE.Group();
        backGroup.position.set(0, seatHeight + 0.025, -0.2);
        backGroup.rotation.x = -0.12;
        const rail = new THREE.Mesh(getBackRailGeometry(), mat);
        rail.position.y = 0.42;
        backGroup.add(rail);
        for (const x of [-0.16, 0, 0.16]) {
            const slat = new THREE.Mesh(getBackSlatGeometry(), mat);
            slat.position.set(x, 0.21, 0);
            backGroup.add(slat);
        }
        this.mesh.add(backGroup);

        const legOffsetX = 0.19;
        const legOffsetZ = 0.18;
        const legCorners: [number, number][] = [
            [-legOffsetX, -legOffsetZ], [legOffsetX, -legOffsetZ],
            [-legOffsetX, legOffsetZ], [legOffsetX, legOffsetZ],
        ];
        for (const [x, z] of legCorners) {
            const leg = new THREE.Mesh(getLegGeometry(), mat);
            leg.position.set(x, seatHeight / 2 - 0.02, z);
            this.mesh.add(leg);
        }

        const stretcherY = 0.14;
        const frontStretcher = new THREE.Mesh(getStretcherGeometry(), mat);
        frontStretcher.rotation.z = Math.PI / 2;
        frontStretcher.position.set(0, stretcherY, legOffsetZ);
        this.mesh.add(frontStretcher);
        const backStretcher = new THREE.Mesh(getStretcherGeometry(), mat);
        backStretcher.rotation.z = Math.PI / 2;
        backStretcher.position.set(0, stretcherY, -legOffsetZ);
        this.mesh.add(backStretcher);

        this.mesh.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) {
                mesh.castShadow = !ghost;
                mesh.receiveShadow = !ghost;
            }
        });
    }

    dispose(scene: THREE.Scene) {
        scene.remove(this.mesh);
    }
}
