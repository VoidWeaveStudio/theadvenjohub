// src/features/game/entities/defusalWeaponModels.ts
import * as THREE from "three";
import { DEFAULT_MELEE, DEFAULT_PISTOL } from "../data/defusalArsenal";

export interface WeaponRig {
    group: THREE.Group;
    muzzle: THREE.Object3D;
    ejection: THREE.Object3D;
    frontGrip: THREE.Object3D;
    scopeLens: THREE.Object3D | null;
    length: number;
}

const materials = new Map<string, THREE.Material>();

function material(key: string, make: () => THREE.Material): THREE.Material {
    let existing = materials.get(key);
    if (!existing) {
        existing = make();
        materials.set(key, existing);
    }
    return existing;
}

const steel = () => material("steel", () => new THREE.MeshStandardMaterial({ color: 0x33383f, roughness: 0.38, metalness: 0.92 }));
const blackPoly = () => material("poly", () => new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.72, metalness: 0.14 }));
const darkSteel = () => material("darkSteel", () => new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.44, metalness: 0.88 }));
const wood = () => material("wood", () => new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.62, metalness: 0.06 }));
const brass = () => material("brass", () => new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.94 }));
const glass = () => material("glass", () => new THREE.MeshStandardMaterial({ color: 0x203040, roughness: 0.08, metalness: 0.3, emissive: 0x0a1622, emissiveIntensity: 0.6 }));
const rugCloth = () => material("rug", () => new THREE.MeshStandardMaterial({ color: 0x9c2b3a, roughness: 0.94, metalness: 0.02 }));

function tinted(key: string, color: number): THREE.Material {
    return material(key, () => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.3 }));
}

// A box with its edges knocked off — reads as machined metal instead of a cube.
function bevelBox(width: number, height: number, depth: number, bevel = 0.004): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    const w = width / 2 - bevel;
    const h = height / 2 - bevel;

    shape.moveTo(-w, -h - bevel);
    shape.lineTo(w, -h - bevel);
    shape.quadraticCurveTo(w + bevel, -h - bevel, w + bevel, -h);
    shape.lineTo(w + bevel, h);
    shape.quadraticCurveTo(w + bevel, h + bevel, w, h + bevel);
    shape.lineTo(-w, h + bevel);
    shape.quadraticCurveTo(-w - bevel, h + bevel, -w - bevel, h);
    shape.lineTo(-w - bevel, -h);
    shape.quadraticCurveTo(-w - bevel, -h - bevel, -w, -h - bevel);

    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 2 });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
}

function part(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    rotation?: [number, number, number]
): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
}

function anchor(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
    const point = new THREE.Object3D();
    point.position.set(x, y, z);
    parent.add(point);
    return point;
}

function barrel(parent: THREE.Object3D, radius: number, length: number, z: number, mat: THREE.Material, y = 0) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 14), mat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, y, z);
    tube.castShadow = true;
    parent.add(tube);
    return tube;
}

function pistolGrip(parent: THREE.Object3D, mat: THREE.Material, rake: number, height: number) {
    const grip = part(parent, bevelBox(0.032, height, 0.05, 0.006), mat, 0, -height / 2 - 0.012, 0.012);
    grip.rotation.x = rake;

    for (let i = 0; i < 5; i++) {
        part(parent, new THREE.BoxGeometry(0.034, 0.004, 0.004), darkSteel(), 0, -0.03 - i * 0.018, 0.032 + i * 0.004);
    }
    return grip;
}

function triggerGuard(parent: THREE.Object3D, z: number) {
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 14, Math.PI * 1.15), darkSteel());
    guard.rotation.set(Math.PI / 2, 0, Math.PI * 0.92);
    guard.position.set(0, -0.026, z);
    parent.add(guard);

    part(parent, new THREE.BoxGeometry(0.008, 0.022, 0.006), steel(), 0, -0.022, z - 0.002);
}

function ironSights(parent: THREE.Object3D, frontZ: number, rearZ: number, y: number) {
    part(parent, new THREE.BoxGeometry(0.006, 0.014, 0.006), darkSteel(), 0, y + 0.008, frontZ);
    part(parent, new THREE.BoxGeometry(0.026, 0.012, 0.006), darkSteel(), 0, y + 0.006, rearZ);
    part(parent, new THREE.BoxGeometry(0.008, 0.008, 0.007), blackPoly(), 0, y + 0.008, rearZ);
}

function railSlots(parent: THREE.Object3D, from: number, to: number, y: number, count: number) {
    const step = (to - from) / count;
    for (let i = 0; i < count; i++) {
        part(parent, new THREE.BoxGeometry(0.026, 0.004, step * 0.5), darkSteel(), 0, y, from + i * step);
    }
}

function buildDustNine(): WeaponRig {
    const group = new THREE.Group();

    part(group, bevelBox(0.03, 0.042, 0.2, 0.005), steel(), 0, 0.012, -0.03);
    part(group, bevelBox(0.028, 0.03, 0.15, 0.004), blackPoly(), 0, -0.012, -0.01);
    part(group, new THREE.BoxGeometry(0.026, 0.008, 0.06), darkSteel(), 0, 0.03, -0.06);

    for (let i = 0; i < 6; i++) {
        part(group, new THREE.BoxGeometry(0.031, 0.004, 0.004), darkSteel(), 0, 0.012, 0.03 + i * 0.008);
    }

    barrel(group, 0.007, 0.05, -0.13, darkSteel(), 0.012);
    pistolGrip(group, blackPoly(), 0.24, 0.09);
    triggerGuard(group, 0.006);
    part(group, bevelBox(0.022, 0.07, 0.04, 0.003), darkSteel(), 0, -0.05, 0.02);
    ironSights(group, -0.115, 0.055, 0.03);

    return {
        group,
        muzzle: anchor(group, 0, 0.012, -0.155),
        ejection: anchor(group, 0.016, 0.026, -0.02),
        frontGrip: anchor(group, 0, -0.02, -0.04),
        scopeLens: null,
        length: 0.24,
    };
}

function buildWhaleCannon(): WeaponRig {
    const group = new THREE.Group();

    part(group, bevelBox(0.034, 0.05, 0.12, 0.006), steel(), 0, 0.014, -0.02);
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.055, 12), darkSteel());
    cylinder.rotation.x = Math.PI / 2;
    cylinder.position.set(0, 0.012, 0.01);
    group.add(cylinder);

    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        part(group, new THREE.CylinderGeometry(0.005, 0.005, 0.058, 8), blackPoly(), Math.cos(a) * 0.017, 0.012 + Math.sin(a) * 0.017, 0.01, [Math.PI / 2, 0, 0]);
    }

    barrel(group, 0.011, 0.19, -0.15, steel(), 0.016);
    part(group, new THREE.BoxGeometry(0.014, 0.012, 0.18), darkSteel(), 0, 0.03, -0.15);
    part(group, new THREE.CylinderGeometry(0.016, 0.016, 0.02, 12), brass(), 0, 0.016, -0.25, [Math.PI / 2, 0, 0]);

    pistolGrip(group, wood(), 0.3, 0.1);
    triggerGuard(group, 0.02);
    part(group, new THREE.BoxGeometry(0.012, 0.02, 0.014), darkSteel(), 0, 0.04, 0.05);
    ironSights(group, -0.2, 0.045, 0.036);

    return {
        group,
        muzzle: anchor(group, 0, 0.016, -0.262),
        ejection: anchor(group, 0.02, 0.02, 0.01),
        frontGrip: anchor(group, 0, -0.01, -0.1),
        scopeLens: null,
        length: 0.36,
    };
}

function buildPumpRifle(): WeaponRig {
    const group = new THREE.Group();

    part(group, bevelBox(0.038, 0.062, 0.24, 0.006), steel(), 0, 0.01, -0.02);
    part(group, new THREE.BoxGeometry(0.04, 0.02, 0.2), darkSteel(), 0, 0.045, -0.06);

    part(group, bevelBox(0.042, 0.05, 0.16, 0.008), wood(), 0, -0.004, -0.16);
    for (let i = 0; i < 4; i++) {
        part(group, new THREE.BoxGeometry(0.044, 0.006, 0.012), darkSteel(), 0, 0.018, -0.11 - i * 0.03);
    }

    barrel(group, 0.009, 0.3, -0.32, darkSteel(), 0.012);
    part(group, new THREE.CylinderGeometry(0.014, 0.014, 0.045, 10), darkSteel(), 0, 0.012, -0.46, [Math.PI / 2, 0, 0]);
    part(group, new THREE.CylinderGeometry(0.017, 0.013, 0.03, 10), steel(), 0, 0.012, -0.5, [Math.PI / 2, 0, 0]);

    const magazine = part(group, bevelBox(0.03, 0.13, 0.06, 0.005), blackPoly(), 0, -0.08, -0.03);
    magazine.rotation.x = -0.34;
    part(group, new THREE.BoxGeometry(0.032, 0.02, 0.05), darkSteel(), 0, -0.15, 0.01);

    pistolGrip(group, blackPoly(), 0.2, 0.085);
    triggerGuard(group, 0.055);

    part(group, bevelBox(0.036, 0.05, 0.18, 0.006), wood(), 0, -0.012, 0.19);
    part(group, new THREE.BoxGeometry(0.038, 0.03, 0.02), blackPoly(), 0, -0.02, 0.285);

    part(group, new THREE.BoxGeometry(0.008, 0.02, 0.008), darkSteel(), 0, 0.04, -0.42);
    part(group, new THREE.BoxGeometry(0.03, 0.014, 0.01), darkSteel(), 0, 0.045, 0.02);

    return {
        group,
        muzzle: anchor(group, 0, 0.012, -0.52),
        ejection: anchor(group, 0.022, 0.03, -0.02),
        frontGrip: anchor(group, 0, -0.02, -0.17),
        scopeLens: null,
        length: 0.82,
    };
}

function buildBlueChip(): WeaponRig {
    const group = new THREE.Group();

    part(group, bevelBox(0.036, 0.058, 0.22, 0.005), blackPoly(), 0, 0.008, -0.01);
    part(group, new THREE.BoxGeometry(0.03, 0.026, 0.24), darkSteel(), 0, 0.044, -0.04);
    railSlots(group, -0.15, 0.04, 0.06, 12);

    const handguard = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.22, 12), blackPoly());
    handguard.rotation.x = Math.PI / 2;
    handguard.position.set(0, 0.012, -0.22);
    group.add(handguard);

    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        part(group, new THREE.BoxGeometry(0.006, 0.006, 0.14), darkSteel(), Math.cos(a) * 0.023, 0.012 + Math.sin(a) * 0.023, -0.22);
    }

    barrel(group, 0.008, 0.24, -0.4, darkSteel(), 0.012);
    part(group, new THREE.CylinderGeometry(0.013, 0.013, 0.05, 10), steel(), 0, 0.012, -0.5, [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) {
        part(group, new THREE.BoxGeometry(0.028, 0.004, 0.006), darkSteel(), 0, 0.012, -0.49 + i * 0.012);
    }

    const magazine = part(group, bevelBox(0.028, 0.12, 0.055, 0.004), blackPoly(), 0, -0.075, -0.02);
    magazine.rotation.x = -0.12;

    pistolGrip(group, blackPoly(), 0.18, 0.08);
    triggerGuard(group, 0.045);

    part(group, new THREE.BoxGeometry(0.026, 0.026, 0.13), darkSteel(), 0, 0.006, 0.16);
    part(group, bevelBox(0.04, 0.058, 0.07, 0.006), blackPoly(), 0, 0.002, 0.235);
    part(group, new THREE.BoxGeometry(0.042, 0.02, 0.014), blackPoly(), 0, -0.022, 0.272);

    ironSights(group, -0.34, 0.03, 0.058);

    return {
        group,
        muzzle: anchor(group, 0, 0.012, -0.53),
        ejection: anchor(group, 0.02, 0.028, -0.01),
        frontGrip: anchor(group, 0, -0.012, -0.24),
        scopeLens: null,
        length: 0.84,
    };
}

// The joke is the barrel. It is four metres of chromed pipe and it one-shots.
function buildMoonLadder(): WeaponRig {
    const group = new THREE.Group();

    part(group, bevelBox(0.044, 0.07, 0.3, 0.007), darkSteel(), 0, 0.006, 0.02);
    part(group, new THREE.BoxGeometry(0.036, 0.024, 0.34), steel(), 0, 0.048, -0.02);

    const chrome = material("chrome", () => new THREE.MeshStandardMaterial({ color: 0xb8c4cf, roughness: 0.12, metalness: 1 }));

    barrel(group, 0.012, 3.4, -1.85, chrome, 0.012);
    for (let i = 0; i < 9; i++) {
        part(group, new THREE.CylinderGeometry(0.019, 0.019, 0.02, 12), darkSteel(), 0, 0.012, -0.4 - i * 0.38, [Math.PI / 2, 0, 0]);
    }
    part(group, new THREE.CylinderGeometry(0.026, 0.02, 0.14, 14), steel(), 0, 0.012, -3.62, [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) {
        part(group, new THREE.BoxGeometry(0.05, 0.005, 0.008), darkSteel(), 0, 0.012, -3.6 + i * 0.02);
    }

    const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.3, 16), blackPoly());
    scopeBody.rotation.x = Math.PI / 2;
    scopeBody.position.set(0, 0.088, -0.06);
    group.add(scopeBody);

    part(group, new THREE.CylinderGeometry(0.038, 0.03, 0.06, 16), darkSteel(), 0, 0.088, -0.22, [Math.PI / 2, 0, 0]);
    part(group, new THREE.CylinderGeometry(0.032, 0.032, 0.05, 16), darkSteel(), 0, 0.088, 0.1, [Math.PI / 2, 0, 0]);

    const lens = part(group, new THREE.CircleGeometry(0.032, 20), glass(), 0, 0.088, -0.248, [0, Math.PI, 0]);
    part(group, new THREE.CircleGeometry(0.028, 20), glass(), 0, 0.088, 0.126);

    for (const z of [-0.16, 0.02]) {
        part(group, new THREE.BoxGeometry(0.03, 0.04, 0.024), darkSteel(), 0, 0.062, z);
    }
    part(group, new THREE.CylinderGeometry(0.014, 0.014, 0.026, 10), darkSteel(), 0.03, 0.088, -0.06, [0, 0, Math.PI / 2]);

    const magazine = part(group, bevelBox(0.03, 0.075, 0.07, 0.004), darkSteel(), 0, -0.07, 0.01);
    magazine.rotation.x = -0.06;

    pistolGrip(group, blackPoly(), 0.16, 0.085);
    triggerGuard(group, 0.075);

    part(group, bevelBox(0.042, 0.075, 0.24, 0.008), blackPoly(), 0, -0.004, 0.26);
    part(group, new THREE.BoxGeometry(0.044, 0.03, 0.05), blackPoly(), 0, -0.036, 0.36);
    part(group, new THREE.BoxGeometry(0.044, 0.024, 0.09), blackPoly(), 0, 0.05, 0.24);

    for (const side of [-1, 1]) {
        const leg = part(group, new THREE.CylinderGeometry(0.005, 0.004, 0.16, 8), darkSteel(), side * 0.03, -0.06, -0.62);
        leg.rotation.set(0.2, 0, side * 0.5);
    }

    return {
        group,
        muzzle: anchor(group, 0, 0.012, -3.7),
        ejection: anchor(group, 0.024, 0.03, 0.02),
        frontGrip: anchor(group, 0, -0.01, -0.5),
        scopeLens: lens,
        length: 3.9,
    };
}

function buildRugBeater(): WeaponRig {
    const group = new THREE.Group();

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.42, 10), wood());
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0, 0.06);
    group.add(handle);

    for (let i = 0; i < 3; i++) {
        part(group, new THREE.TorusGeometry(0.016, 0.003, 6, 12), brass(), 0, 0, 0.13 + i * 0.03, [Math.PI / 2, 0, 0]);
    }

    const head = new THREE.Group();
    head.position.set(0, 0, -0.2);
    group.add(head);

    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.006, 8, 26), wood());
    loop.rotation.y = Math.PI / 2;
    head.add(loop);

    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.005, 8, 22), wood());
    inner.rotation.y = Math.PI / 2;
    head.add(inner);

    for (let i = 0; i < 5; i++) {
        const t = (i / 4 - 0.5) * 0.12;
        part(head, new THREE.CylinderGeometry(0.004, 0.004, 0.13, 6), wood(), 0, t, 0, [0, 0, Math.PI / 2]);
        part(head, new THREE.CylinderGeometry(0.004, 0.004, 0.13, 6), wood(), 0, 0, t, [Math.PI / 2, 0, Math.PI / 2]);
    }

    part(head, new THREE.BoxGeometry(0.004, 0.05, 0.05), rugCloth(), 0.006, 0.02, 0.02, [0.3, 0, 0.2]);
    part(group, new THREE.BoxGeometry(0.02, 0.03, 0.03), rugCloth(), 0, -0.006, -0.1);

    return {
        group,
        muzzle: anchor(group, 0, 0, -0.26),
        ejection: anchor(group, 0, 0, 0),
        frontGrip: anchor(group, 0, 0, -0.06),
        scopeLens: null,
        length: 0.5,
    };
}

const GRENADE_TINT: Record<string, number> = {
    "rug-flash": 0xf2f2f2,
    "fud-cloud": 0x6d8ba8,
    liquidation: 0x4a6b3a,
};

export function buildGrenadeModel(itemId: string): THREE.Group {
    const group = new THREE.Group();
    const shell = tinted(`grenade-${itemId}`, GRENADE_TINT[itemId] ?? 0x4a6b3a);

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 12), shell);
    body.scale.set(1, 1.18, 1);
    body.castShadow = true;
    group.add(body);

    for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.037 - i * 0.002, 0.003, 6, 18), darkSteel());
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.018 + i * 0.018;
        group.add(ring);
    }

    part(group, new THREE.CylinderGeometry(0.012, 0.014, 0.024, 10), darkSteel(), 0, 0.05, 0);
    part(group, new THREE.BoxGeometry(0.008, 0.05, 0.006), steel(), 0.014, 0.036, 0);
    part(group, new THREE.TorusGeometry(0.01, 0.002, 6, 12), brass(), -0.016, 0.05, 0, [Math.PI / 2, 0, 0]);

    return group;
}

const BUILDERS: Record<string, () => WeaponRig> = {
    "dust-nine": buildDustNine,
    "whale-cannon": buildWhaleCannon,
    "pump-rifle": buildPumpRifle,
    "bluechip-rifle": buildBlueChip,
    "moon-ladder": buildMoonLadder,
    "rug-beater": buildRugBeater,
};

export function buildDefusalWeapon(itemId: string): WeaponRig {
    const builder = BUILDERS[itemId] ?? BUILDERS[DEFAULT_PISTOL] ?? BUILDERS[DEFAULT_MELEE];
    const rig = builder();
    rig.group.name = `defusal-weapon-${itemId}`;
    return rig;
}

export function disposeWeaponRig(rig: WeaponRig) {
    rig.group.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
    });
    rig.group.removeFromParent();
}

export function disposeSharedWeaponMaterials() {
    materials.forEach((mat) => mat.dispose());
    materials.clear();
}
