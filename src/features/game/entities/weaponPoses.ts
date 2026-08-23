// src/features/game/entities/weaponPoses.ts
import * as THREE from "three";
import type { WeaponKind } from "./weaponTiers";

export interface WeaponPose {
    position: THREE.Vector3;
    euler: THREE.Euler;
    scale: number;
}

const EASE_RATE = 12;

function pose(x: number, y: number, z: number, rx: number, ry: number, rz: number, scale = 1): WeaponPose {
    return { position: new THREE.Vector3(x, y, z), euler: new THREE.Euler(rx, ry, rz), scale };
}

export const RIFLE_BASE_POSE = pose(-0.0980, 0.9408, 0.4599, 0.1600, -0.1000, 0.0600);
export const STAFF_BASE_POSE = pose(-0.0930, 0.8358, 0.4849, 0, 0, 0);

const RIFLE_CLIP_POSES: Record<string, WeaponPose> = {
    "rifle-idle": pose(-0.0980, 0.9408, 0.4599, 0.1600, -0.1000, 0.0600),
    "rifle-idle-firing": pose(-0.4830, 0.9858, 0.0849, -0.1000, -0.0400, 0.4400),
    "rifle-walk": pose(-0.5380, 0.9408, 0.4599, -0.1600, -0.1000, 0.2800),
    "rifle-walk-firing": pose(-0.5380, 0.9408, 0.4599, -0.1600, -0.1000, 0.2800),
    "rifle-run": pose(-0.1230, 0.9858, 0.2849, -0.4600, -0.0400, 0.0600),
};

const STAFF_CLIP_POSES: Record<string, WeaponPose> = {};

const CLIP_POSES: Record<WeaponKind, Record<string, WeaponPose>> = {
    rifle: RIFLE_CLIP_POSES,
    staff: STAFF_CLIP_POSES,
};

export function weaponBasePose(kind: WeaponKind): WeaponPose {
    return kind === "staff" ? STAFF_BASE_POSE : RIFLE_BASE_POSE;
}

export function weaponPoseFor(kind: WeaponKind, clip: string): WeaponPose {
    return CLIP_POSES[kind][clip] ?? weaponBasePose(kind);
}

export function weaponPoseSlot(kind: WeaponKind, clip: string): WeaponPose {
    const base = weaponBasePose(kind);
    if (!clip) return base;

    const table = CLIP_POSES[kind];
    let entry = table[clip];
    if (!entry) {
        entry = { position: base.position.clone(), euler: base.euler.clone(), scale: base.scale };
        table[clip] = entry;
    }

    return entry;
}

export function weaponPoseSnippet(clip: string, target: WeaponPose): string {
    const f = (value: number) => value.toFixed(4);
    return `"${clip}": pose(${f(target.position.x)}, ${f(target.position.y)}, ${f(target.position.z)},`
        + ` ${f(target.euler.x)}, ${f(target.euler.y)}, ${f(target.euler.z)}`
        + `${target.scale === 1 ? "" : `, ${target.scale.toFixed(3)}`}),`;
}

export function applyWeaponPose(mount: THREE.Object3D, visual: THREE.Object3D | null, target: WeaponPose) {
    mount.position.copy(target.position);
    if (!visual) return;

    visual.rotation.copy(target.euler);
    visual.scale.setScalar(target.scale);
}

export function easeWeaponPose(mount: THREE.Object3D, visual: THREE.Object3D | null, target: WeaponPose, delta: number) {
    const t = Math.min(1, delta * EASE_RATE);

    mount.position.lerp(target.position, t);
    if (!visual) return;

    visual.rotation.x += (target.euler.x - visual.rotation.x) * t;
    visual.rotation.y += (target.euler.y - visual.rotation.y) * t;
    visual.rotation.z += (target.euler.z - visual.rotation.z) * t;
    visual.scale.setScalar(visual.scale.x + (target.scale - visual.scale.x) * t);
}
