// src/features/game/entities/furniture/Table.ts
import * as THREE from "three";

const WOOD_COLOR = 0x8a6a4a;

let topGeometry: THREE.BoxGeometry | null = null;
let apronLongGeometry: THREE.BoxGeometry | null = null;
let apronShortGeometry: THREE.BoxGeometry | null = null;
let legGeometry: THREE.CylinderGeometry | null = null;
let stretcherGeometry: THREE.CylinderGeometry | null = null;
let woodMaterial: THREE.MeshStandardMaterial | null = null;
let ghostMaterial: THREE.MeshStandardMaterial | null = null;

function getTopGeometry(): THREE.BoxGeometry {
    if (!topGeometry) topGeometry = new THREE.BoxGeometry(1.4, 0.06, 0.8);
    return topGeometry;
}
function getApronLongGeometry(): THREE.BoxGeometry {
    if (!apronLongGeometry) apronLongGeometry = new THREE.BoxGeometry(1.28, 0.08, 0.04);
    return apronLongGeometry;
}
function getApronShortGeometry(): THREE.BoxGeometry {
    if (!apronShortGeometry) apronShortGeometry = new THREE.BoxGeometry(0.04, 0.08, 0.68);
    return apronShortGeometry;
}
function getLegGeometry(): THREE.CylinderGeometry {
    if (!legGeometry) legGeometry = new THREE.CylinderGeometry(0.035, 0.045, 0.68, 8);
    return legGeometry;
}
function getStretcherGeometry(): THREE.CylinderGeometry {
    if (!stretcherGeometry) stretcherGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.62, 6);
    return stretcherGeometry;
}
function getWoodMaterial(): THREE.MeshStandardMaterial {
    if (!woodMaterial) woodMaterial = new THREE.MeshStandardMaterial({ color: WOOD_COLOR, roughness: 0.6, metalness: 0.05 });
    return woodMaterial;
}
function getGhostMaterial(): THREE.MeshStandardMaterial {
    if (!ghostMaterial) {
        ghostMaterial = new THREE.MeshStandardMaterial({
            color: WOOD_COLOR, roughness: 0.6, metalness: 0.05, transparent: true, opacity: 0.5,
        });
    }
    return ghostMaterial;
}

export class Table {
    public readonly id: string;
    public readonly mesh: THREE.Group;

    constructor(id: string, ghost: boolean = false) {
        this.id = id;
        this.mesh = new THREE.Group();
        const mat = ghost ? getGhostMaterial() : getWoodMaterial();

        const legHeight = 0.68;
        const topY = legHeight + 0.03;

        const top = new THREE.Mesh(getTopGeometry(), mat);
        top.position.y = topY;
        this.mesh.add(top);

        const apronY = legHeight - 0.02;
        for (const z of [-0.36, 0.36]) {
            const apron = new THREE.Mesh(getApronLongGeometry(), mat);
            apron.position.set(0, apronY, z);
            this.mesh.add(apron);
        }
        for (const x of [-0.66, 0.66]) {
            const apron = new THREE.Mesh(getApronShortGeometry(), mat);
            apron.position.set(x, apronY, 0);
            this.mesh.add(apron);
        }

        const legX = 0.62;
        const legZ = 0.34;
        const legCorners: [number, number][] = [
            [-legX, -legZ], [legX, -legZ], [-legX, legZ], [legX, legZ],
        ];
        for (const [x, z] of legCorners) {
            const leg = new THREE.Mesh(getLegGeometry(), mat);
            leg.position.set(x, legHeight / 2, z);
            this.mesh.add(leg);
        }

        for (const x of [-legX, legX]) {
            const stretcher = new THREE.Mesh(getStretcherGeometry(), mat);
            stretcher.rotation.x = Math.PI / 2;
            stretcher.position.set(x, 0.12, 0);
            this.mesh.add(stretcher);
        }

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
