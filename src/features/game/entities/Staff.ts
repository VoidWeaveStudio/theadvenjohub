// src/features/game/entities/Staff.ts
import * as THREE from "three";

export const STAFF_MUZZLE_OFFSET = new THREE.Vector3(0, -0.62, 0);
export const STAFF_FOREGRIP_OFFSET = new THREE.Vector3(0, -0.2, 0);
export const STAFF_GRIP_POINT_OFFSET = new THREE.Vector3(0, 0.1, 0);

const SHAFT_TOP_Y = -0.5;
const SHAFT_BOTTOM_Y = 0.48;
const HEAD_Y = -0.54;

function wood(color: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.04 });
}

function metal(color: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.75 });
}

function crystalMaterial(accent: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: 1.4,
        roughness: 0.25,
        metalness: 0.1,
        transparent: true,
        opacity: 0.92,
    });
}

function buildShaft(group: THREE.Group) {
    const length = SHAFT_BOTTOM_Y - SHAFT_TOP_Y;

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.031, length, 10), wood(0x6b5238));
    shaft.position.y = (SHAFT_TOP_Y + SHAFT_BOTTOM_Y) / 2;
    group.add(shaft);

    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.22, 10), wood(0x3d2f22));
    wrap.position.y = 0.09;
    group.add(wrap);

    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), metal(0x8a7a5c));
    pommel.position.y = SHAFT_BOTTOM_Y + 0.02;
    group.add(pommel);

    for (const y of [-0.22, 0.3]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.008, 8, 16), metal(0x8a7a5c));
        band.rotation.x = Math.PI / 2;
        band.position.y = y;
        group.add(band);
    }
}

function buildHead(group: THREE.Group, accent: number) {
    const cageMaterial = metal(0x8a7a5c);

    for (let i = 0; i < 3; i++) {
        const angle = (Math.PI * 2 * i) / 3;
        const prong = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.16, 4, 8), cageMaterial);
        prong.position.set(Math.cos(angle) * 0.052, HEAD_Y + 0.03, Math.sin(angle) * 0.052);
        prong.rotation.z = Math.cos(angle) * 0.42;
        prong.rotation.x = -Math.sin(angle) * 0.42;
        group.add(prong);
    }

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.03, 0.06, 10), cageMaterial);
    collar.position.y = HEAD_Y + 0.13;
    group.add(collar);

    const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.062, 0), crystalMaterial(accent));
    crystal.position.y = HEAD_Y - 0.04;
    crystal.name = "staff-crystal";
    group.add(crystal);
}

export function buildStaff(accent: number): THREE.Group {
    const group = new THREE.Group();
    group.name = "staff";

    buildShaft(group);
    buildHead(group, accent);

    return group;
}

export function staffCrystal(staff: THREE.Group): THREE.Mesh | null {
    const found = staff.getObjectByName("staff-crystal");
    return found instanceof THREE.Mesh ? found : null;
}

export function disposeStaff(staff: THREE.Group) {
    staff.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
    });
    staff.removeFromParent();
}
