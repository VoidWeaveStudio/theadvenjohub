// src/features/game/entities/DeathCrate.ts
import * as THREE from "three";

const CRATE_WIDTH = 0.9;
const CRATE_HEIGHT = 0.6;
const LID_THICKNESS = 0.12;
const MARKER_HEIGHT = 1.7;

export const DEATH_CRATE_PREFIX = "death-crate:";

let sharedBodyGeometry: THREE.BoxGeometry | null = null;
let sharedLidGeometry: THREE.BoxGeometry | null = null;
let sharedMarkerGeometry: THREE.OctahedronGeometry | null = null;
let sharedSeamGeometry: THREE.BoxGeometry | null = null;
let sharedBodyMaterial: THREE.MeshStandardMaterial | null = null;
let sharedLidMaterial: THREE.MeshStandardMaterial | null = null;

function bodyGeometry(): THREE.BoxGeometry {
    if (!sharedBodyGeometry) sharedBodyGeometry = new THREE.BoxGeometry(CRATE_WIDTH, CRATE_HEIGHT, CRATE_WIDTH);
    return sharedBodyGeometry;
}

function lidGeometry(): THREE.BoxGeometry {
    if (!sharedLidGeometry) sharedLidGeometry = new THREE.BoxGeometry(CRATE_WIDTH + 0.06, LID_THICKNESS, CRATE_WIDTH + 0.06);
    return sharedLidGeometry;
}

function markerGeometry(): THREE.OctahedronGeometry {
    if (!sharedMarkerGeometry) sharedMarkerGeometry = new THREE.OctahedronGeometry(0.16, 0);
    return sharedMarkerGeometry;
}

function seamGeometry(): THREE.BoxGeometry {
    if (!sharedSeamGeometry) sharedSeamGeometry = new THREE.BoxGeometry(CRATE_WIDTH + 0.02, 0.05, CRATE_WIDTH + 0.02);
    return sharedSeamGeometry;
}

function bodyMaterial(): THREE.MeshStandardMaterial {
    if (!sharedBodyMaterial) {
        sharedBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.85, metalness: 0.1 });
    }
    return sharedBodyMaterial;
}

function lidMaterial(): THREE.MeshStandardMaterial {
    if (!sharedLidMaterial) {
        sharedLidMaterial = new THREE.MeshStandardMaterial({ color: 0x2a1f18, roughness: 0.7, metalness: 0.2 });
    }
    return sharedLidMaterial;
}

export class DeathCrate {
    public readonly mesh: THREE.Group;
    public readonly anchor: THREE.Object3D;
    public readonly id: string;

    private seamMaterial: THREE.MeshStandardMaterial;
    private markerMaterial: THREE.MeshStandardMaterial;
    private marker: THREE.Mesh;
    private phase = Math.random() * Math.PI * 2;

    constructor(id: string) {
        this.id = id;
        this.mesh = new THREE.Group();

        const body = new THREE.Mesh(bodyGeometry(), bodyMaterial());
        body.position.y = CRATE_HEIGHT / 2;
        body.castShadow = true;
        this.mesh.add(body);

        const lid = new THREE.Mesh(lidGeometry(), lidMaterial());
        lid.position.y = CRATE_HEIGHT + LID_THICKNESS / 2;
        lid.rotation.x = -0.22;
        lid.castShadow = true;
        this.mesh.add(lid);

        this.seamMaterial = new THREE.MeshStandardMaterial({
            color: 0xffb347,
            emissive: 0xffa02a,
            emissiveIntensity: 2.4,
            toneMapped: false,
        });

        const seam = new THREE.Mesh(seamGeometry(), this.seamMaterial);
        seam.position.y = CRATE_HEIGHT - 0.02;
        this.mesh.add(seam);

        this.markerMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd08a,
            emissive: 0xffa02a,
            emissiveIntensity: 3,
            toneMapped: false,
        });

        this.marker = new THREE.Mesh(markerGeometry(), this.markerMaterial);
        this.marker.position.y = MARKER_HEIGHT;
        this.mesh.add(this.marker);

        this.anchor = new THREE.Object3D();
        this.anchor.position.y = CRATE_HEIGHT / 2;
        this.anchor.userData.interactionId = `${DEATH_CRATE_PREFIX}${id}`;
        this.anchor.userData.interactionRadius = 3;
        this.mesh.add(this.anchor);
    }

    public setPosition(position: number[]) {
        this.mesh.position.set(position[0], position[1], position[2]);
    }

    public update(delta: number, getGroundHeight: (x: number, z: number) => number) {
        this.mesh.position.y = getGroundHeight(this.mesh.position.x, this.mesh.position.z);

        this.phase += delta * 2;
        this.marker.rotation.y += delta * 1.4;
        this.marker.position.y = MARKER_HEIGHT + Math.sin(this.phase) * 0.12;

        const pulse = 2.6 + Math.sin(this.phase * 0.8) * 0.9;
        this.seamMaterial.emissiveIntensity = pulse;
        this.markerMaterial.emissiveIntensity = pulse + 0.6;
    }

    public dispose(scene: THREE.Scene) {
        this.seamMaterial.dispose();
        this.markerMaterial.dispose();
        scene.remove(this.mesh);
    }
}
