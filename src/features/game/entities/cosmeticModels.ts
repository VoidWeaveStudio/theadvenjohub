// src/features/game/entities/cosmeticModels.ts
import * as THREE from "three";
import { CosmeticId } from "../data/cosmetics";
import { RegionPalette } from "./characterRegions";

export interface CosmeticAttachment {
    head: THREE.Group | null;
    palette: RegionPalette | null;
}

const HEAD_FRONT_Z = 0.94;
const HEAD_TOP_Y = 2.22;
const HEAD_CENTRE_Y = 1.08;

function matte(color: number, roughness = 0.8, metalness = 0.05): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function buildGhostFace(scale: number): THREE.Group {
    const group = new THREE.Group();
    const white = matte(0xf4f2ec, 0.5);
    const black = matte(0x07070a, 0.9);

    const plate = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 16), white);
    plate.scale.set(0.95, 1.14, 0.44);
    plate.position.set(0, HEAD_CENTRE_Y + 0.08, HEAD_FRONT_Z - 0.32);
    group.add(plate);

    const chin = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.75, 14), white);
    chin.scale.z = 0.5;
    chin.rotation.x = Math.PI;
    chin.position.set(0, HEAD_CENTRE_Y - 0.78, HEAD_FRONT_Z - 0.34);
    group.add(chin);

    for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), black);
        eye.scale.set(0.9, 1.7, 0.5);
        eye.position.set(side * 0.3, HEAD_CENTRE_Y + 0.26, HEAD_FRONT_Z - 0.02);
        group.add(eye);
    }

    const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.42, 6, 12), black);
    mouth.scale.z = 0.55;
    mouth.position.set(0, HEAD_CENTRE_Y - 0.38, HEAD_FRONT_Z - 0.05);
    group.add(mouth);

    group.scale.setScalar(scale);
    return group;
}

function buildScreamMask(): THREE.Group {
    return buildGhostFace(1);
}

function buildTrumpHair(): THREE.Group {
    const group = new THREE.Group();
    const blond = matte(0xdfb04a, 0.65);

    const cap = new THREE.Mesh(
        new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
        blond
    );
    cap.scale.set(1.04, 0.78, 1.08);
    cap.position.set(0, HEAD_TOP_Y - 0.52, -0.04);
    group.add(cap);

    const fringe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.36, 0.62), blond);
    fringe.position.set(0.07, HEAD_TOP_Y - 0.16, HEAD_FRONT_Z - 0.36);
    fringe.rotation.x = -0.24;
    fringe.rotation.z = -0.13;
    group.add(fringe);

    const sweep = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 0.7), blond);
    sweep.position.set(-0.1, HEAD_TOP_Y - 0.05, -0.55);
    sweep.rotation.x = 0.2;
    group.add(sweep);

    for (const side of [-1, 1]) {
        const sideburn = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.95), blond);
        sideburn.position.set(side * 0.9, HEAD_CENTRE_Y + 0.28, -0.05);
        sideburn.rotation.z = side * 0.18;
        group.add(sideburn);
    }

    return group;
}

function buildScreamHood(): THREE.Group {
    const group = new THREE.Group();
    const cloth = matte(0x101014, 0.95);

    const hood = new THREE.Mesh(
        new THREE.SphereGeometry(1.18, 22, 16, Math.PI * 0.85, Math.PI * 1.3),
        cloth
    );
    hood.scale.set(1.02, 1.14, 1.08);
    hood.position.set(0, HEAD_CENTRE_Y + 0.12, -0.05);
    hood.material.side = THREE.DoubleSide;
    group.add(hood);

    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(1.24, 1.62, 1.5, 18, 1, true), cloth);
    shroud.material.side = THREE.DoubleSide;
    shroud.position.set(0, HEAD_CENTRE_Y - 1.1, -0.06);
    group.add(shroud);

    group.add(buildGhostFace(0.94));
    return group;
}

function makeLabelTexture(text: string, color: string): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 256, 96);
    ctx.fillStyle = color;
    ctx.font = "bold 62px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "6px";
    ctx.fillText(text, 128, 52);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function buildPepeHead(): THREE.Group {
    const group = new THREE.Group();
    const green = matte(0x59a83f, 0.75);
    const white = matte(0xf7f7f2, 0.5);
    const black = matte(0x0b0b0d, 0.6);
    const mouthRed = matte(0xc1462a, 0.7);
    const wool = matte(0x141416, 0.95, 0);

    for (const side of [-1, 1]) {
        const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 18), white);
        eyeball.position.set(side * 0.42, HEAD_CENTRE_Y + 0.45, HEAD_FRONT_Z - 0.42);
        group.add(eyeball);

        const lid = new THREE.Mesh(
            new THREE.SphereGeometry(0.42, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
            green
        );
        lid.position.copy(eyeball.position);
        lid.rotation.x = 0.38;
        group.add(lid);

        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), black);
        pupil.position.set(side * 0.46, HEAD_CENTRE_Y + 0.42, HEAD_FRONT_Z - 0.06);
        group.add(pupil);
    }

    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.11, 10, 28, Math.PI), mouthRed);
    mouth.rotation.z = Math.PI;
    mouth.scale.set(1.16, 0.78, 0.9);
    mouth.position.set(0, HEAD_CENTRE_Y - 0.55, HEAD_FRONT_Z - 0.06);
    group.add(mouth);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.88, 0.5, 24), wool);
    brim.position.set(0, HEAD_CENTRE_Y + 0.95, -0.04);
    group.add(brim);

    const crown = new THREE.Mesh(
        new THREE.SphereGeometry(0.82, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
        wool
    );
    crown.scale.set(1, 0.75, 1);
    crown.position.set(0, HEAD_CENTRE_Y + 1.2, -0.04);
    group.add(crown);

    const label = new THREE.Mesh(
        new THREE.PlaneGeometry(0.86, 0.32),
        new THREE.MeshBasicMaterial({
            map: makeLabelTexture("PEPE", "#5bd23a"),
            transparent: true,
            depthWrite: false,
        })
    );
    label.position.set(0, HEAD_CENTRE_Y + 0.97, 0.87);
    group.add(label);

    return group;
}

const HEAD_BUILDERS: Partial<Record<CosmeticId, () => THREE.Group>> = {
    scream_mask: buildScreamMask,
    trump_hair: buildTrumpHair,
    scream_robe: buildScreamHood,
    trump_suit: buildTrumpHair,
    pepe_frog: buildPepeHead,
};

const PALETTES: Partial<Record<CosmeticId, RegionPalette>> = {
    scream_robe: {
        head: 0x101014,
        torso: 0x141419,
        arms: 0x121217,
        hands: 0x1c1c22,
        legs: 0x0e0e12,
        feet: 0x08080b,
    },
    trump_suit: {
        head: 0xe8b48c,
        torso: 0x1b2a4a,
        arms: 0x1b2a4a,
        hands: 0xe8b48c,
        legs: 0x243352,
        feet: 0x14161c,
    },
    pepe_frog: {
        head: 0x59a83f,
        torso: 0x141416,
        arms: 0x17171a,
        hands: 0x59a83f,
        legs: 0x121214,
        feet: 0xe8e8e2,
    },
};

export function buildCosmetic(id: CosmeticId): CosmeticAttachment {
    return {
        head: HEAD_BUILDERS[id]?.() ?? null,
        palette: PALETTES[id] ?? null,
    };
}

export function disposeCosmetic(root: THREE.Object3D | null) {
    if (!root) return;
    root.removeFromParent();
    root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
        } else {
            mesh.material.dispose();
        }
    });
}
