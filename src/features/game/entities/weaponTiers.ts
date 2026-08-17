// src/features/game/entities/weaponTiers.ts
import * as THREE from "three";
import { WEAPON_TIERS } from "../data/progression";

export type WeaponKind = "rifle" | "staff";

const ORBIT_NAME = "tier-orbit";
const PULSE_NAME = "tier-pulse";

export function accentForTier(tier: number): number {
    const clamped = Math.max(1, Math.min(WEAPON_TIERS.length, Math.floor(tier)));
    return new THREE.Color(WEAPON_TIERS[clamped - 1].accent).getHex();
}

export function weaponTierName(kind: WeaponKind, tier: number): string {
    const clamped = Math.max(1, Math.min(WEAPON_TIERS.length, Math.floor(tier)));
    const entry = WEAPON_TIERS[clamped - 1];
    return kind === "staff" ? entry.staffName : entry.rifleName;
}

function alloy(color: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.8 });
}

function glow(accent: number, intensity = 1.6): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: intensity,
        roughness: 0.3,
        metalness: 0.2,
    });
}

function addRiflePlates(group: THREE.Group, accent: number) {
    for (const side of [-1, 1]) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.26, 0.055), alloy(0x6d7480));
        plate.position.set(side * 0.045, -0.16, 0.01);
        group.add(plate);
    }

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.008, 8, 14), alloy(accent));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = -0.03;
    group.add(collar);
}

function addRifleOptics(group: THREE.Group, accent: number) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.018), alloy(0x4d545e));
    rail.position.set(0, -0.06, 0.075);
    group.add(rail);

    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.17, 12), alloy(0x2f343c));
    scope.rotation.x = Math.PI / 2;
    scope.rotation.z = Math.PI / 2;
    scope.position.set(0, -0.05, 0.105);
    group.add(scope);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.021, 14), glow(accent, 1.1));
    lens.position.set(0, -0.135, 0.105);
    lens.rotation.x = Math.PI / 2;
    group.add(lens);
}

function addRifleCell(group: THREE.Group, accent: number) {
    const cell = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.045), glow(accent, 1.5));
    cell.name = PULSE_NAME;
    cell.position.set(-0.055, 0.07, -0.01);
    group.add(cell);

    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.02, 0.055), alloy(0x5b626c));
    clamp.position.set(-0.055, 0.135, -0.01);
    group.add(clamp);
}

function addRifleVents(group: THREE.Group, accent: number) {
    for (let i = 0; i < 3; i++) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.014, 0.03), alloy(0x3c424b));
        vent.position.set(0, -0.26 - i * 0.045, 0.03);
        group.add(vent);
    }

    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.006, 8, 16), glow(accent, 2));
    coil.name = PULSE_NAME;
    coil.rotation.x = Math.PI / 2;
    coil.position.y = -0.33;
    group.add(coil);
}

function addRifleCrown(group: THREE.Group, accent: number) {
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 10, 20), glow(accent, 2.4));
    crown.rotation.x = Math.PI / 2;
    crown.position.y = -0.42;
    group.add(crown);

    const orbit = new THREE.Group();
    orbit.name = ORBIT_NAME;
    orbit.position.y = -0.42;
    for (let i = 0; i < 3; i++) {
        const angle = (Math.PI * 2 * i) / 3;
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.019, 0), glow(accent, 2.6));
        shard.position.set(Math.cos(angle) * 0.085, 0, Math.sin(angle) * 0.085);
        orbit.add(shard);
    }
    group.add(orbit);
}

function addStaffBands(group: THREE.Group, accent: number) {
    for (const y of [-0.36, -0.05, 0.22]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.009, 8, 16), alloy(accent));
        band.rotation.x = Math.PI / 2;
        band.position.y = y;
        group.add(band);
    }
}

function addStaffRunes(group: THREE.Group, accent: number) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.007, 8, 26), glow(accent, 1.4));
    ring.name = ORBIT_NAME;
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.54;
    group.add(ring);

    for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 2) * i;
        const rune = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.03, 0.006), glow(accent, 1.2));
        rune.position.set(Math.cos(angle) * 0.038, -0.2, Math.sin(angle) * 0.038);
        rune.rotation.y = -angle;
        group.add(rune);
    }
}

function addStaffShards(group: THREE.Group, accent: number) {
    const orbit = new THREE.Group();
    orbit.name = ORBIT_NAME;
    orbit.position.y = -0.54;

    for (let i = 0; i < 3; i++) {
        const angle = (Math.PI * 2 * i) / 3;
        const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.028, 0), glow(accent, 2));
        shard.position.set(Math.cos(angle) * 0.11, Math.sin(angle * 1.7) * 0.04, Math.sin(angle) * 0.11);
        orbit.add(shard);
    }

    group.add(orbit);
}

function addStaffRibbons(group: THREE.Group, accent: number) {
    for (let i = 0; i < 2; i++) {
        const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.005, 6, 24, Math.PI * 1.5), glow(accent, 2.2));
        ribbon.name = ORBIT_NAME;
        ribbon.position.y = -0.54;
        ribbon.rotation.set(Math.PI / 2.4, 0, (Math.PI / 2) * i);
        group.add(ribbon);
    }

    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 6), glow(accent, 1.1));
    spine.name = PULSE_NAME;
    spine.position.set(0, -0.18, 0.032);
    group.add(spine);
}

function addStaffHalo(group: THREE.Group, accent: number) {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.009, 10, 28), glow(accent, 2.6));
    halo.name = ORBIT_NAME;
    halo.rotation.x = Math.PI / 2;
    halo.position.y = -0.54;
    group.add(halo);

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.036, 0), glow(accent, 3));
    core.name = PULSE_NAME;
    core.position.y = -0.54;
    group.add(core);
}

const RIFLE_LAYERS = [addRiflePlates, addRifleOptics, addRifleCell, addRifleVents, addRifleCrown];
const STAFF_LAYERS = [addStaffBands, addStaffRunes, addStaffShards, addStaffRibbons, addStaffHalo];

export function buildWeaponTierAttachments(kind: WeaponKind, tier: number): THREE.Group {
    const group = new THREE.Group();
    group.name = "weapon-tier";

    const clamped = Math.max(1, Math.min(WEAPON_TIERS.length, Math.floor(tier)));
    const accent = accentForTier(clamped);
    const layers = kind === "staff" ? STAFF_LAYERS : RIFLE_LAYERS;

    for (let i = 0; i < clamped - 1; i++) layers[i](group, accent);

    return group;
}

export function updateWeaponTierAttachments(group: THREE.Group, elapsed: number, delta: number) {
    group.traverse((child) => {
        if (child.name === ORBIT_NAME) {
            child.rotation.y += delta * 0.9;
            return;
        }

        if (child.name === PULSE_NAME && child instanceof THREE.Mesh) {
            const material = child.material as THREE.MeshStandardMaterial;
            if (material.emissiveIntensity !== undefined) {
                material.emissiveIntensity = 1.4 + Math.sin(elapsed * 3.2) * 0.6;
            }
        }
    });
}

export function disposeWeaponTierAttachments(group: THREE.Group) {
    group.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
    });
    group.clear();
    group.removeFromParent();
}
