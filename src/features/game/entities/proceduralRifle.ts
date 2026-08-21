// src/features/game/entities/proceduralRifle.ts
import * as THREE from "three";

const GUNMETAL = 0x2b2f36;
const POLYMER = 0x191c21;
const STEEL = 0x4a515b;

function metal(color: number, rough = 0.34, metalness = 0.88): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness });
}

function polymer(color: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.08 });
}

function glow(accent: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: 1.5,
        roughness: 0.3,
        metalness: 0.4,
        toneMapped: false,
    });
}

function part(
    parent: THREE.Group,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    rotation?: [number, number, number]
): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
}

function buildBarrel(group: THREE.Group, bodyMat: THREE.MeshStandardMaterial, steelMat: THREE.MeshStandardMaterial, accentMat: THREE.MeshStandardMaterial) {
    part(group, new THREE.CylinderGeometry(0.017, 0.017, 0.3, 14), steelMat, [0, -0.26, 0.03]);
    part(group, new THREE.CylinderGeometry(0.024, 0.026, 0.05, 14), bodyMat, [0, -0.385, 0.03]);
    part(group, new THREE.TorusGeometry(0.026, 0.005, 6, 16), accentMat, [0, -0.365, 0.03], [Math.PI / 2, 0, 0]);

    const handguard = part(group, new THREE.BoxGeometry(0.052, 0.19, 0.062), polymer(POLYMER), [0, -0.225, 0.028]);
    handguard.name = "rifle-handguard";

    for (let i = 0; i < 4; i++) {
        part(
            group,
            new THREE.BoxGeometry(0.056, 0.012, 0.03),
            metal(0x14171b, 0.9, 0.3),
            [0, -0.17 - i * 0.04, 0.028]
        );
    }

    part(group, new THREE.BoxGeometry(0.02, 0.055, 0.016), bodyMat, [0, -0.155, 0.072]);
}

function buildReceiver(group: THREE.Group, bodyMat: THREE.MeshStandardMaterial, accentMat: THREE.MeshStandardMaterial) {
    part(group, new THREE.BoxGeometry(0.058, 0.24, 0.085), bodyMat, [0, -0.02, 0.018]);
    part(group, new THREE.BoxGeometry(0.062, 0.06, 0.05), metal(STEEL, 0.4, 0.8), [0, -0.08, 0.005]);

    part(group, new THREE.BoxGeometry(0.012, 0.11, 0.006), accentMat, [0.031, -0.02, 0.03]);
    part(group, new THREE.BoxGeometry(0.012, 0.11, 0.006), accentMat, [-0.031, -0.02, 0.03]);

    part(group, new THREE.BoxGeometry(0.03, 0.045, 0.012), metal(0x14171b, 0.5, 0.7), [0.034, 0.02, 0.02]);
    part(group, new THREE.BoxGeometry(0.05, 0.03, 0.02), metal(STEEL, 0.45, 0.75), [0, 0.09, 0.02]);
}

function buildRailAndSights(group: THREE.Group, bodyMat: THREE.MeshStandardMaterial, accentMat: THREE.MeshStandardMaterial) {
    part(group, new THREE.BoxGeometry(0.03, 0.34, 0.014), bodyMat, [0, -0.11, 0.072]);

    for (let i = 0; i < 7; i++) {
        part(group, new THREE.BoxGeometry(0.034, 0.011, 0.02), bodyMat, [0, 0.01 - i * 0.045, 0.075]);
    }

    part(group, new THREE.BoxGeometry(0.008, 0.008, 0.045), metal(STEEL, 0.4, 0.8), [0, -0.3, 0.098]);
    const rear = part(group, new THREE.TorusGeometry(0.019, 0.005, 6, 14), metal(STEEL, 0.4, 0.8), [0, 0.02, 0.1], [Math.PI / 2, 0, 0]);
    rear.name = "rifle-rear-sight";
    part(group, new THREE.SphereGeometry(0.006, 8, 8), accentMat, [0, 0.02, 0.1]);
}

function buildMagazine(group: THREE.Group, accentMat: THREE.MeshStandardMaterial) {
    const magazine = part(
        group,
        new THREE.BoxGeometry(0.042, 0.18, 0.055),
        polymer(0x15181c),
        [0, 0.06, -0.055],
        [0.32, 0, 0]
    );
    magazine.name = "rifle-magazine";

    part(group, new THREE.BoxGeometry(0.046, 0.012, 0.058), accentMat, [0, 0.135, -0.078], [0.32, 0, 0]);
}

function buildGripAndStock(group: THREE.Group, bodyMat: THREE.MeshStandardMaterial) {
    const grip = part(
        group,
        new THREE.BoxGeometry(0.042, 0.13, 0.05),
        polymer(POLYMER),
        [0, 0.13, -0.012],
        [-0.35, 0, 0]
    );
    grip.name = "rifle-grip";

    part(group, new THREE.BoxGeometry(0.05, 0.03, 0.075), bodyMat, [0, 0.09, 0.005]);
    part(group, new THREE.TorusGeometry(0.03, 0.006, 6, 14, Math.PI), metal(0x14171b, 0.6, 0.6), [0, 0.075, -0.04], [Math.PI / 2, 0, 0]);

    part(group, new THREE.BoxGeometry(0.045, 0.13, 0.06), bodyMat, [0, 0.185, 0.03]);
    part(group, new THREE.BoxGeometry(0.05, 0.06, 0.1), polymer(0x15181c), [0, 0.275, 0.045]);
    part(group, new THREE.BoxGeometry(0.052, 0.02, 0.104), metal(0x0f1114, 0.9, 0.2), [0, 0.3, 0.045]);
}

export const RIFLE_BARREL_SIGN = 1;

export function buildRifle(accent: number): THREE.Group {
    const group = new THREE.Group();
    group.name = "rifle";
    if (RIFLE_BARREL_SIGN > 0) group.rotation.z = Math.PI;

    const bodyMat = metal(GUNMETAL);
    const steelMat = metal(STEEL, 0.28, 0.92);
    const accentMat = glow(accent);

    buildBarrel(group, bodyMat, steelMat, accentMat);
    buildReceiver(group, bodyMat, accentMat);
    buildRailAndSights(group, bodyMat, accentMat);
    buildMagazine(group, accentMat);
    buildGripAndStock(group, bodyMat);

    return group;
}

export function disposeRifle(rifle: THREE.Group) {
    rifle.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
    });
    rifle.removeFromParent();
}
