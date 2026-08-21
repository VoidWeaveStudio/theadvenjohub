// src/features/game/entities/cosmeticModels.ts
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { CosmeticId } from "../data/cosmetics";
import { RegionPalette } from "./characterRegions";

export type CosmeticTick = (elapsed: number) => void;

export interface CosmeticAttachment {
    head: THREE.Group | null;
    torso: THREE.Group | null;
    palette: RegionPalette | null;
    tick: CosmeticTick | null;
}

const HEAD_FRONT_Z = 0.94;
const HEAD_TOP_Y = 2.22;
const HEAD_CENTRE_Y = 1.08;
const HEAD_RADIUS = 0.94;

const SHELL_WIDTH = 2.02;
const SHELL_HEIGHT = 2.5;
const SHELL_DEPTH = 2.02;
const SHELL_CENTRE_Y = 1.02;
const SHELL_FRONT_Z = 1.01;
const SHELL_TOP_Y = SHELL_CENTRE_Y + SHELL_HEIGHT / 2;

const CHEST_FRONT_Z = 0.7;
const CHEST_NECK_Y = 0.62;
const CHEST_SHOULDER_Y = 0.4;

function matte(color: number, roughness = 0.8, metalness = 0.05): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function polished(color: number, roughness = 0.26, metalness = 0.78): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function glowing(color: number, emissive: number, intensity = 1.5): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: intensity,
        roughness: 0.3,
        metalness: 0.1,
    });
}

function pulse(material: THREE.MeshStandardMaterial, base: number, amount: number, speed: number) {
    const mesh = new THREE.Object3D();
    mesh.userData.cosmeticTick = (elapsed: number) => {
        material.emissiveIntensity = base + Math.sin(elapsed * speed) * amount;
    };
    return mesh;
}

function mascotShell(material: THREE.Material): THREE.Mesh {
    const shell = new THREE.Mesh(
        new RoundedBoxGeometry(SHELL_WIDTH, SHELL_HEIGHT, SHELL_DEPTH, 5, 0.62),
        material
    );
    shell.position.set(0, SHELL_CENTRE_Y, 0);
    return shell;
}

function mirrored(group: THREE.Group, build: (side: number) => THREE.Object3D) {
    for (const side of [-1, 1]) group.add(build(side));
}

function tickOf(object: THREE.Object3D | null): CosmeticTick | null {
    if (!object) return null;

    const ticks: CosmeticTick[] = [];
    object.traverse((child) => {
        const tick = child.userData.cosmeticTick as CosmeticTick | undefined;
        if (tick) ticks.push(tick);
    });

    if (ticks.length === 0) return null;
    return (elapsed: number) => {
        for (const tick of ticks) tick(elapsed);
    };
}

function mergeTicks(parts: Array<THREE.Object3D | null>): CosmeticTick | null {
    const ticks = parts.map(tickOf).filter((tick): tick is CosmeticTick => !!tick);
    if (ticks.length === 0) return null;
    if (ticks.length === 1) return ticks[0];
    return (elapsed: number) => {
        for (const tick of ticks) tick(elapsed);
    };
}

function facePatch(
    radius: number,
    widthAngle: number,
    heightAngle: number,
    material: THREE.Material,
    pitch = 0
): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(
        radius,
        26,
        20,
        Math.PI / 2 - widthAngle / 2,
        widthAngle,
        Math.PI / 2 - heightAngle / 2 + pitch,
        heightAngle
    );
    return new THREE.Mesh(geometry, material);
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return [canvas, canvas.getContext("2d")!];
}

function toTexture(canvas: HTMLCanvasElement, mirror = false): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    if (mirror) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.repeat.x = -1;
        texture.offset.x = 1;
    }
    return texture;
}

function makeLabelTexture(text: string, color: string): THREE.CanvasTexture {
    const [canvas, ctx] = makeCanvas(256, 96);
    ctx.clearRect(0, 0, 256, 96);
    ctx.fillStyle = color;
    ctx.font = "bold 62px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "6px";
    ctx.fillText(text, 128, 52);
    return toTexture(canvas);
}

function makeWojakFaceTexture(): THREE.CanvasTexture {
    const [canvas, ctx] = makeCanvas(256, 256);
    ctx.clearRect(0, 0, 256, 256);
    ctx.strokeStyle = "#241f1d";
    ctx.fillStyle = "#241f1d";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(54, 94);
    ctx.quadraticCurveTo(82, 76, 114, 92);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(142, 92);
    ctx.quadraticCurveTo(174, 76, 202, 94);
    ctx.stroke();

    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(86, 128, 28, 19, 0.06, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(170, 128, 28, 19, -0.06, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(88, 131, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(168, 131, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(128, 136);
    ctx.quadraticCurveTo(116, 172, 137, 180);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(88, 208);
    ctx.quadraticCurveTo(111, 196, 130, 206);
    ctx.quadraticCurveTo(150, 216, 171, 202);
    ctx.stroke();

    return toTexture(canvas);
}

function makeVisorChartTexture(): THREE.CanvasTexture {
    const [canvas, ctx] = makeCanvas(256, 256);
    const sky = ctx.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, "#2c1c06");
    sky.addColorStop(0.45, "#130d05");
    sky.addColorStop(1, "#05121b");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = "rgba(120, 210, 160, 0.16)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 42);
        ctx.lineTo(256, i * 42);
        ctx.stroke();
    }

    const closes = [188, 176, 182, 160, 148, 152, 130, 116, 122, 96, 82, 66];
    for (let i = 0; i < closes.length; i++) {
        const x = 20 + i * 19;
        const open = i === 0 ? 200 : closes[i - 1];
        const close = closes[i];
        const up = close < open;
        ctx.strokeStyle = up ? "#4be08a" : "#e2554b";
        ctx.fillStyle = up ? "#4be08a" : "#e2554b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, Math.min(open, close) - 10);
        ctx.lineTo(x, Math.max(open, close) + 10);
        ctx.stroke();
        ctx.fillRect(x - 5, Math.min(open, close), 10, Math.max(4, Math.abs(close - open)));
    }

    const glow = ctx.createRadialGradient(198, 56, 4, 198, 56, 70);
    glow.addColorStop(0, "rgba(235, 246, 255, 0.9)");
    glow.addColorStop(1, "rgba(235, 246, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(198, 56, 70, 0, Math.PI * 2);
    ctx.fill();

    return toTexture(canvas, true);
}

function makePanelTexture(): THREE.CanvasTexture {
    const [canvas, ctx] = makeCanvas(128, 96);
    ctx.fillStyle = "#08110d";
    ctx.fillRect(0, 0, 128, 96);
    ctx.strokeStyle = "#4be08a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, 78);
    ctx.lineTo(38, 60);
    ctx.lineTo(58, 68);
    ctx.lineTo(84, 36);
    ctx.lineTo(118, 16);
    ctx.stroke();
    ctx.fillStyle = "#4be08a";
    ctx.font = "bold 20px Arial";
    ctx.fillText("+1000%", 12, 32);
    return toTexture(canvas);
}

function makeKnitTexture(): THREE.CanvasTexture {
    const [canvas, ctx] = makeCanvas(128, 128);
    ctx.fillStyle = "#efa3c6";
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "rgba(196, 108, 150, 0.55)";
    ctx.lineWidth = 4;
    for (let x = 6; x < 128; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 128);
        ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255, 228, 241, 0.5)";
    ctx.lineWidth = 3;
    for (let y = 8; y < 128; y += 16) {
        ctx.beginPath();
        for (let x = 0; x <= 128; x += 8) {
            ctx.lineTo(x, y + ((x / 8) % 2 === 0 ? 4 : -4));
        }
        ctx.stroke();
    }
    const texture = toTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 3);
    return texture;
}

function makeGlowTexture(inner: string, mid: string): THREE.CanvasTexture {
    const [canvas, ctx] = makeCanvas(64, 64);
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.4, mid);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return toTexture(canvas);
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

function buildDogeHead(): THREE.Group {
    const group = new THREE.Group();
    const fur = matte(0xd8a441, 0.88);
    const cream = matte(0xf4e3c0, 0.82);
    const dark = matte(0x241a10, 0.6);
    const pink = matte(0xd4868a, 0.75);
    const white = matte(0xfbfaf6, 0.4);

    group.add(mascotShell(fur));

    const crest = new THREE.Mesh(new THREE.SphereGeometry(0.6, 18, 12), cream);
    crest.scale.set(1.5, 0.42, 0.9);
    crest.position.set(0, SHELL_TOP_Y - 0.14, 0.34);
    group.add(crest);

    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.5, 22, 18), cream);
    muzzle.scale.set(0.94, 0.76, 1);
    muzzle.position.set(0, SHELL_CENTRE_Y - 0.32, SHELL_FRONT_Z - 0.04);
    group.add(muzzle);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 14), dark);
    nose.scale.set(1.25, 0.86, 0.9);
    nose.position.set(0, SHELL_CENTRE_Y - 0.16, SHELL_FRONT_Z + 0.38);
    group.add(nose);

    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 20, Math.PI), dark);
    smile.rotation.z = Math.PI;
    smile.scale.set(1.3, 0.9, 1);
    smile.position.set(0, SHELL_CENTRE_Y - 0.4, SHELL_FRONT_Z + 0.3);
    group.add(smile);

    mirrored(group, (side) => {
        const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), cream);
        cheek.scale.set(0.95, 0.8, 0.6);
        cheek.position.set(side * 0.62, SHELL_CENTRE_Y - 0.3, SHELL_FRONT_Z - 0.14);
        return cheek;
    });

    mirrored(group, (side) => {
        const brow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), cream);
        brow.scale.set(1.35, 0.6, 0.45);
        brow.position.set(side * 0.42, SHELL_CENTRE_Y + 0.62, SHELL_FRONT_Z - 0.02);
        return brow;
    });

    mirrored(group, (side) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 14), dark);
        eye.scale.set(0.92, 1.05, 0.6);
        eye.position.set(side * 0.4, SHELL_CENTRE_Y + 0.3, SHELL_FRONT_Z);
        return eye;
    });

    mirrored(group, (side) => {
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), white);
        glint.position.set(side * 0.35, SHELL_CENTRE_Y + 0.38, SHELL_FRONT_Z + 0.08);
        return glint;
    });

    mirrored(group, (side) => {
        const ear = new THREE.Group();

        const shell = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.78, 14), fur);
        shell.scale.z = 0.68;
        ear.add(shell);

        const inner = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.5, 12), pink);
        inner.scale.z = 0.48;
        inner.position.set(0, -0.06, 0.16);
        ear.add(inner);

        ear.position.set(side * 0.64, SHELL_TOP_Y - 0.04, -0.06);
        ear.rotation.set(-0.12, 0, side * -0.26);
        return ear;
    });

    return group;
}

function buildDogeCollar(): THREE.Group {
    const group = new THREE.Group();
    const strap = matte(0xb3352f, 0.85);
    const gold = polished(0xf0c04a, 0.28, 0.85);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.09, 10, 26), strap);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, CHEST_NECK_Y, 0.02);
    group.add(collar);

    const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 20), gold);
    tag.rotation.x = Math.PI / 2;
    tag.position.set(0, CHEST_NECK_Y - 0.24, 0.26);
    group.add(tag);

    const label = new THREE.Mesh(
        new THREE.PlaneGeometry(0.25, 0.09),
        new THREE.MeshBasicMaterial({
            map: makeLabelTexture("DOGE", "#3d2a08"),
            transparent: true,
            depthWrite: false,
        })
    );
    label.position.set(0, CHEST_NECK_Y - 0.24, 0.3);
    group.add(label);

    return group;
}

function buildWojakHood(): THREE.Group {
    const group = new THREE.Group();
    const cloth = matte(0x8b9099, 0.95, 0);

    const hood = new THREE.Mesh(
        new THREE.SphereGeometry(1.14, 24, 18, Math.PI * 0.86, Math.PI * 1.28),
        cloth
    );
    hood.scale.set(1.06, 1.14, 1.12);
    hood.position.set(0, HEAD_CENTRE_Y - 0.04, 0);
    hood.material.side = THREE.DoubleSide;
    group.add(hood);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.14, 10, 30), cloth);
    rim.scale.set(1, 1.1, 1);
    rim.position.set(0, HEAD_CENTRE_Y + 0.02, 0.3);
    group.add(rim);

    const drape = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.48, 1.16, 20, 1, true), cloth);
    drape.material.side = THREE.DoubleSide;
    drape.position.set(0, HEAD_CENTRE_Y - 0.9, -0.08);
    group.add(drape);

    const face = new THREE.Mesh(
        new THREE.PlaneGeometry(1.26, 1.1),
        new THREE.MeshBasicMaterial({
            map: makeWojakFaceTexture(),
            transparent: true,
            depthWrite: false,
        })
    );
    face.position.set(0, HEAD_CENTRE_Y + 0.2, HEAD_FRONT_Z + 0.04);
    group.add(face);

    return group;
}

function buildWojakStrings(): THREE.Group {
    const group = new THREE.Group();
    const cloth = matte(0x7d828b, 0.95, 0);
    const cord = matte(0xd9dde3, 0.9, 0);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.13, 10, 26), cloth);
    collar.rotation.x = Math.PI / 2;
    collar.scale.z = 0.85;
    collar.position.set(0, CHEST_NECK_Y - 0.06, 0.04);
    group.add(collar);

    mirrored(group, (side) => {
        const string = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.6, 8), cord);
        string.position.set(side * 0.2, CHEST_NECK_Y - 0.38, 0.42);
        string.rotation.z = side * 0.09;
        return string;
    });

    mirrored(group, (side) => {
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.11, 10), cloth);
        tip.position.set(side * 0.23, CHEST_NECK_Y - 0.72, 0.42);
        return tip;
    });

    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.28, 0.08), cloth);
    pocket.position.set(0, CHEST_SHOULDER_Y - 1.0, CHEST_FRONT_Z - 0.04);
    group.add(pocket);

    return group;
}

function buildGigachadHead(): THREE.Group {
    const group = new THREE.Group();
    const marble = matte(0xdedad2, 0.52);
    const shade = matte(0xbcb7ae, 0.62);
    const hair = matte(0x16171d, 0.7);
    const dark = matte(0x0d0e12, 0.55);

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.62, 0.66), marble);
    jaw.rotation.x = 0.06;
    jaw.position.set(0, HEAD_CENTRE_Y - 0.66, 0.72);
    group.add(jaw);

    const chin = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.46), marble);
    chin.rotation.x = 0.2;
    chin.position.set(0, HEAD_CENTRE_Y - 0.92, 0.9);
    group.add(chin);

    const cleft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), shade);
    cleft.position.set(0, HEAD_CENTRE_Y - 0.9, 1.12);
    group.add(cleft);

    mirrored(group, (side) => {
        const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.26, 0.6), marble);
        cheek.rotation.set(0, side * -0.2, side * 0.2);
        cheek.position.set(side * 0.6, HEAD_CENTRE_Y + 0.06, 0.72);
        return cheek;
    });

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.52, 0.3), marble);
    nose.rotation.x = -0.1;
    nose.position.set(0, HEAD_CENTRE_Y - 0.1, 1);
    group.add(nose);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.26, 0.5), marble);
    brow.rotation.x = -0.14;
    brow.position.set(0, HEAD_CENTRE_Y + 0.6, 0.78);
    group.add(brow);

    mirrored(group, (side) => {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.14), dark);
        eye.rotation.z = side * 0.07;
        eye.position.set(side * 0.38, HEAD_CENTRE_Y + 0.38, 0.95);
        return eye;
    });

    const cap = new THREE.Mesh(
        new THREE.SphereGeometry(1.02, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
        hair
    );
    cap.scale.set(1.02, 0.86, 1.04);
    cap.position.set(0, HEAD_TOP_Y - 0.78, -0.03);
    group.add(cap);

    const sweep = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.32, 0.5), hair);
    sweep.rotation.set(-0.22, 0, 0.1);
    sweep.position.set(0.05, HEAD_TOP_Y - 0.34, 0.72);
    group.add(sweep);

    mirrored(group, (side) => {
        const temple = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.76, 0.9), hair);
        temple.position.set(side * 0.92, HEAD_CENTRE_Y + 0.66, 0.04);
        temple.rotation.z = side * 0.08;
        return temple;
    });

    return group;
}

function buildAstronautHelmet(): THREE.Group {
    const group = new THREE.Group();
    const shellMat = matte(0xf1f4f8, 0.42, 0.08);
    const metal = polished(0xb9c1cc, 0.3, 0.85);
    const lampMat = glowing(0xfff0c4, 0xffb648, 1.6);
    const beaconMat = glowing(0xff5a4a, 0xff2a1a, 2.2);

    const shell = new THREE.Mesh(
        new THREE.SphereGeometry(1.26, 28, 22, Math.PI * 0.5 + 0.72, Math.PI * 2 - 1.44),
        shellMat
    );
    shell.material.side = THREE.DoubleSide;
    shell.scale.set(1, 1.04, 1.02);
    shell.position.set(0, HEAD_CENTRE_Y - 0.06, 0.04);
    group.add(shell);

    const glass = new THREE.Mesh(
        new THREE.SphereGeometry(1.24, 26, 20),
        new THREE.MeshStandardMaterial({
            color: 0xd6e9ff,
            transparent: true,
            opacity: 0.15,
            roughness: 0.05,
            metalness: 0.1,
            depthWrite: false,
        })
    );
    glass.scale.set(1, 1.04, 1.02);
    glass.position.copy(shell.position);
    group.add(glass);

    const visorTexture = makeVisorChartTexture();
    const visor = facePatch(
        1.25,
        1.5,
        1.9,
        new THREE.MeshStandardMaterial({
            map: visorTexture,
            emissive: 0xffffff,
            emissiveMap: visorTexture,
            emissiveIntensity: 0.55,
            roughness: 0.16,
            metalness: 0.6,
        })
    );
    visor.scale.set(1, 1.04, 1.02);
    visor.position.copy(shell.position);
    group.add(visor);

    const crown = facePatch(1.26, 1.52, 0.66, shellMat, -1.24);
    crown.scale.set(1, 1.04, 1.02);
    crown.position.copy(shell.position);
    group.add(crown);

    for (const pitch of [-0.86, 0.88]) {
        const band = facePatch(1.275, 1.52, 0.13, metal, pitch);
        band.scale.set(1, 1.04, 1.02);
        band.position.copy(shell.position);
        group.add(band);
    }

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.14, 12, 28), metal);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, HEAD_CENTRE_Y - 1.22, 0.02);
    group.add(collar);

    mirrored(group, (side) => {
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 14), lampMat);
        lamp.rotation.set(Math.PI / 2, 0, 0);
        lamp.position.set(side * 0.92, HEAD_CENTRE_Y + 0.72, 0.42);
        return lamp;
    });

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.62, 8), metal);
    antenna.rotation.z = -0.24;
    antenna.position.set(0.66, HEAD_TOP_Y - 0.02, -0.36);
    group.add(antenna);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), beaconMat);
    beacon.position.set(0.8, HEAD_TOP_Y + 0.27, -0.36);
    group.add(beacon);

    group.add(pulse(beaconMat, 2.2, 1.5, 3.4));
    return group;
}

function buildAstronautPack(): THREE.Group {
    const group = new THREE.Group();
    const suit = matte(0xeef1f6, 0.62, 0.06);
    const metal = polished(0xa9b2be, 0.32, 0.82);
    const trim = matte(0xf07a2c, 0.7);
    const panelMat = new THREE.MeshStandardMaterial({
        map: makePanelTexture(),
        emissive: 0x2bd07a,
        emissiveIntensity: 0.7,
        roughness: 0.4,
        metalness: 0.2,
    });

    const pack = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.92, 0.44), suit);
    pack.position.set(0, CHEST_SHOULDER_Y - 0.32, -0.68);
    group.add(pack);

    mirrored(group, (side) => {
        const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.5, 6, 12), metal);
        tank.position.set(side * 0.3, CHEST_SHOULDER_Y - 0.3, -0.92);
        return tank;
    });

    mirrored(group, (side) => {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 0.12), trim);
        strap.rotation.set(0, 0, side * 0.06);
        strap.position.set(side * 0.36, CHEST_SHOULDER_Y - 0.34, CHEST_FRONT_Z - 0.12);
        return strap;
    });

    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.38, 0.1), panelMat);
    panel.position.set(0, CHEST_SHOULDER_Y - 0.42, CHEST_FRONT_Z - 0.02);
    group.add(panel);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.08, 10, 26), metal);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, CHEST_NECK_Y - 0.02, 0.02);
    group.add(ring);

    group.add(pulse(panelMat, 0.7, 0.45, 2.1));
    return group;
}

function buildBullHead(): THREE.Group {
    const group = new THREE.Group();
    const hide = matte(0x6d4a2c, 0.9);
    const hideDark = matte(0x4a3120, 0.9);
    const muzzleMat = matte(0x8f6b46, 0.85);
    const ivory = matte(0xe9e1cf, 0.5);
    const gold = polished(0xf0c04a, 0.28, 0.88);
    const eyeMat = glowing(0x7bf5b0, 0x2ad07a, 2);

    group.add(mascotShell(hide));

    const forehead = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 14), hideDark);
    forehead.scale.set(1.24, 0.66, 0.5);
    forehead.position.set(0, SHELL_CENTRE_Y + 0.8, SHELL_FRONT_Z - 0.18);
    group.add(forehead);

    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.52, 22, 18), muzzleMat);
    muzzle.scale.set(0.98, 0.8, 1);
    muzzle.position.set(0, SHELL_CENTRE_Y - 0.44, SHELL_FRONT_Z - 0.04);
    group.add(muzzle);

    mirrored(group, (side) => {
        const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), hideDark);
        nostril.scale.set(1, 1.35, 0.7);
        nostril.position.set(side * 0.19, SHELL_CENTRE_Y - 0.34, SHELL_FRONT_Z + 0.38);
        return nostril;
    });

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 10, 22), gold);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(0, SHELL_CENTRE_Y - 0.68, SHELL_FRONT_Z + 0.3);
    group.add(ring);

    mirrored(group, (side) => {
        const horn = new THREE.Group();

        const base = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.66, 14), ivory);
        base.position.y = 0.33;
        horn.add(base);

        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.54, 12), ivory);
        tip.position.set(0, 0.84, 0.07);
        tip.rotation.x = -0.34;
        horn.add(tip);

        horn.position.set(side * 0.82, SHELL_CENTRE_Y + 0.84, -0.02);
        horn.rotation.set(0.06, 0, side * -0.72);
        return horn;
    });

    mirrored(group, (side) => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), hideDark);
        ear.scale.set(0.55, 0.34, 0.24);
        ear.rotation.z = side * 0.4;
        ear.position.set(side * 1.06, SHELL_CENTRE_Y + 0.3, -0.14);
        return ear;
    });

    const brow = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.22, 0.42), hideDark);
    brow.rotation.x = -0.12;
    brow.position.set(0, SHELL_CENTRE_Y + 0.52, SHELL_FRONT_Z - 0.1);
    group.add(brow);

    mirrored(group, (side) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), eyeMat);
        eye.scale.set(1, 0.86, 0.7);
        eye.position.set(side * 0.44, SHELL_CENTRE_Y + 0.28, SHELL_FRONT_Z);
        return eye;
    });

    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), hideDark);
    tuft.scale.set(1.1, 0.62, 0.82);
    tuft.position.set(0, SHELL_TOP_Y - 0.08, 0.16);
    group.add(tuft);

    group.add(pulse(eyeMat, 2, 0.7, 2.6));
    return group;
}

function buildBullChain(): THREE.Group {
    const group = new THREE.Group();
    const gold = polished(0xf0c04a, 0.25, 0.9);
    const candleGreen = glowing(0x5be89a, 0x1f9d5e, 1.1);

    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 10, 30), gold);
    chain.rotation.x = Math.PI / 2 - 0.16;
    chain.position.set(0, CHEST_NECK_Y - 0.2, 0.08);
    group.add(chain);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.08), candleGreen);
    body.position.set(0, CHEST_NECK_Y - 0.6, 0.44);
    group.add(body);

    const wick = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.54, 0.05), candleGreen);
    wick.position.set(0, CHEST_NECK_Y - 0.6, 0.44);
    group.add(wick);

    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 22), gold);
    frame.position.set(0, CHEST_NECK_Y - 0.6, 0.42);
    group.add(frame);

    return group;
}

function buildBearHead(): THREE.Group {
    const group = new THREE.Group();
    const furDark = matte(0x3f342c, 0.92);
    const fur = matte(0x574839, 0.9);
    const muzzleMat = matte(0x8b7458, 0.85);
    const dark = matte(0x120e0b, 0.6);
    const ivory = matte(0xf1ece0, 0.45);
    const eyeMat = glowing(0xff7a6a, 0xe22e22, 2);

    group.add(mascotShell(fur));

    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 14), furDark);
    crown.scale.set(1.24, 0.44, 1.2);
    crown.position.set(0, SHELL_TOP_Y - 0.16, -0.04);
    group.add(crown);

    mirrored(group, (side) => {
        const ear = new THREE.Group();

        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), furDark);
        shell.scale.set(1, 1, 0.45);
        ear.add(shell);

        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), muzzleMat);
        inner.scale.set(1, 1, 0.4);
        inner.position.z = 0.11;
        ear.add(inner);

        ear.position.set(side * 0.7, SHELL_TOP_Y - 0.04, -0.04);
        ear.rotation.y = side * -0.18;
        return ear;
    });

    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.48, 22, 18), muzzleMat);
    muzzle.scale.set(0.92, 0.76, 1);
    muzzle.position.set(0, SHELL_CENTRE_Y - 0.4, SHELL_FRONT_Z - 0.04);
    group.add(muzzle);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 14), dark);
    nose.scale.set(1.2, 0.9, 0.85);
    nose.position.set(0, SHELL_CENTRE_Y - 0.24, SHELL_FRONT_Z + 0.34);
    group.add(nose);

    mirrored(group, (side) => {
        const fang = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 10), ivory);
        fang.rotation.x = Math.PI;
        fang.position.set(side * 0.17, SHELL_CENTRE_Y - 0.74, SHELL_FRONT_Z + 0.1);
        return fang;
    });

    mirrored(group, (side) => {
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.34), furDark);
        brow.rotation.z = side * -0.34;
        brow.position.set(side * 0.42, SHELL_CENTRE_Y + 0.56, SHELL_FRONT_Z - 0.08);
        return brow;
    });

    mirrored(group, (side) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), eyeMat);
        eye.scale.set(1, 0.9, 0.7);
        eye.position.set(side * 0.4, SHELL_CENTRE_Y + 0.3, SHELL_FRONT_Z - 0.02);
        return eye;
    });

    group.add(pulse(eyeMat, 2, 0.8, 2.2));
    return group;
}

function buildBearClaws(): THREE.Group {
    const group = new THREE.Group();
    const slashMat = new THREE.MeshStandardMaterial({
        color: 0xff5a4a,
        emissive: 0xd42a1c,
        emissiveIntensity: 1.4,
        roughness: 0.5,
        metalness: 0,
    });
    const hide = matte(0x2b211b, 0.95);

    for (let i = 0; i < 3; i++) {
        const slash = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.86, 0.06), slashMat);
        slash.rotation.set(0, 0, 0.42);
        slash.position.set(-0.24 + i * 0.24, CHEST_SHOULDER_Y - 0.5, CHEST_FRONT_Z - 0.02);
        group.add(slash);
    }

    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.02, 0.1), hide);
    strap.rotation.z = -0.24;
    strap.position.set(-0.34, CHEST_SHOULDER_Y - 0.32, CHEST_FRONT_Z - 0.16);
    group.add(strap);

    group.add(pulse(slashMat, 1.4, 0.55, 1.7));
    return group;
}

function buildWifHat(): THREE.Group {
    const group = new THREE.Group();
    const knit = new THREE.MeshStandardMaterial({
        map: makeKnitTexture(),
        color: 0xffffff,
        roughness: 0.95,
        metalness: 0,
    });
    const trim = matte(0xf7c3da, 0.95, 0);

    const cap = new THREE.Mesh(
        new THREE.SphereGeometry(1.02, 26, 18, 0, Math.PI * 2, 0, Math.PI * 0.58),
        knit
    );
    cap.scale.set(1, 0.98, 1);
    cap.position.set(0, HEAD_TOP_Y - 0.86, -0.03);
    group.add(cap);

    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.15, 12, 30), trim);
    brim.rotation.x = Math.PI / 2;
    brim.position.set(0, HEAD_TOP_Y - 0.84, -0.03);
    group.add(brim);

    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), trim);
    pom.position.set(0.06, HEAD_TOP_Y + 0.2, -0.06);
    group.add(pom);

    group.rotation.set(-0.05, 0, 0.11);
    return group;
}

function buildLaserEyes(): THREE.Group {
    const group = new THREE.Group();
    const coreMat = glowing(0xffb4a0, 0xff2a14, 3.2);
    const beamMat = new THREE.MeshBasicMaterial({
        color: 0xff4a24,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const glowMat = new THREE.SpriteMaterial({
        map: makeGlowTexture("rgba(255,240,220,0.95)", "rgba(255,80,40,0.6)"),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    mirrored(group, (side) => {
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), coreMat);
        core.position.set(side * 0.38, HEAD_CENTRE_Y + 0.32, HEAD_FRONT_Z - 0.02);
        return core;
    });

    const beams: THREE.Mesh[] = [];
    mirrored(group, (side) => {
        const beam = new THREE.Mesh(new THREE.ConeGeometry(0.19, 3.2, 14, 1, true), beamMat);
        beam.rotation.x = -Math.PI / 2;
        beam.position.set(side * 0.38, HEAD_CENTRE_Y + 0.32, HEAD_FRONT_Z + 1.52);
        beams.push(beam);
        return beam;
    });

    mirrored(group, (side) => {
        const flare = new THREE.Sprite(glowMat);
        flare.scale.setScalar(0.9);
        flare.position.set(side * 0.38, HEAD_CENTRE_Y + 0.32, HEAD_FRONT_Z + 0.06);
        return flare;
    });

    const driver = new THREE.Object3D();
    driver.userData.cosmeticTick = (elapsed: number) => {
        const flicker = 0.34 + Math.abs(Math.sin(elapsed * 5.2)) * 0.16;
        beamMat.opacity = flicker;
        coreMat.emissiveIntensity = 2.6 + Math.sin(elapsed * 7.4) * 0.8;
        for (const beam of beams) {
            beam.scale.set(1 + Math.sin(elapsed * 6.1) * 0.06, 1, 1 + Math.cos(elapsed * 5.3) * 0.06);
        }
    };
    group.add(driver);

    return group;
}

function buildDealShades(): THREE.Group {
    const group = new THREE.Group();
    const pixel = matte(0x0b0b0e, 0.55, 0.15);
    const lens = new THREE.MeshStandardMaterial({
        color: 0x121218,
        roughness: 0.18,
        metalness: 0.4,
    });

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.16), pixel);
    bridge.position.set(0, HEAD_CENTRE_Y + 0.36, HEAD_FRONT_Z + 0.02);
    group.add(bridge);

    mirrored(group, (side) => {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.34, 0.16), pixel);
        frame.position.set(side * 0.44, HEAD_CENTRE_Y + 0.36, HEAD_FRONT_Z - 0.02);
        return frame;
    });

    mirrored(group, (side) => {
        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.06), lens);
        glass.position.set(side * 0.44, HEAD_CENTRE_Y + 0.36, HEAD_FRONT_Z + 0.07);
        return glass;
    });

    mirrored(group, (side) => {
        const step = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.16), pixel);
        step.position.set(side * 0.68, HEAD_CENTRE_Y + 0.52, HEAD_FRONT_Z - 0.12);
        return step;
    });

    mirrored(group, (side) => {
        const temple = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.9), pixel);
        temple.rotation.y = side * 0.34;
        temple.position.set(side * 0.82, HEAD_CENTRE_Y + 0.4, HEAD_FRONT_Z - 0.52);
        return temple;
    });

    return group;
}

interface CosmeticBlueprint {
    head?: () => THREE.Group;
    torso?: () => THREE.Group;
    palette?: RegionPalette;
}

const BLUEPRINTS: Partial<Record<CosmeticId, CosmeticBlueprint>> = {
    scream_mask: {
        head: buildScreamMask,
    },
    trump_hair: {
        head: buildTrumpHair,
    },
    scream_robe: {
        head: buildScreamHood,
        palette: {
            head: 0x101014,
            torso: 0x141419,
            arms: 0x121217,
            hands: 0x1c1c22,
            legs: 0x0e0e12,
            feet: 0x08080b,
        },
    },
    trump_suit: {
        head: buildTrumpHair,
        palette: {
            head: 0xe8b48c,
            torso: 0x1b2a4a,
            arms: 0x1b2a4a,
            hands: 0xe8b48c,
            legs: 0x243352,
            feet: 0x14161c,
        },
    },
    pepe_frog: {
        head: buildPepeHead,
        palette: {
            head: 0x59a83f,
            torso: 0x141416,
            arms: 0x17171a,
            hands: 0x59a83f,
            legs: 0x121214,
            feet: 0xe8e8e2,
        },
    },
    doge_shiba: {
        head: buildDogeHead,
        torso: buildDogeCollar,
        palette: {
            head: 0xd8a441,
            torso: 0xf0dcb4,
            arms: 0xd8a441,
            hands: 0xf4e3c0,
            legs: 0xc4922f,
            feet: 0x3b2b1a,
        },
    },
    wojak_hoodie: {
        head: buildWojakHood,
        torso: buildWojakStrings,
        palette: {
            head: 0xe6c9ae,
            torso: 0x8b9099,
            arms: 0x8b9099,
            hands: 0xe6c9ae,
            legs: 0x36415c,
            feet: 0xe4e6ea,
        },
    },
    gigachad_marble: {
        head: buildGigachadHead,
        palette: {
            head: 0xdedad2,
            torso: 0xf3f1ed,
            arms: 0xdedad2,
            hands: 0xd2ccc4,
            legs: 0x23242b,
            feet: 0x101116,
        },
    },
    moon_astronaut: {
        head: buildAstronautHelmet,
        torso: buildAstronautPack,
        palette: {
            head: 0xeef1f6,
            torso: 0xf4f6fa,
            arms: 0xe6eaf0,
            hands: 0xd3d8e1,
            legs: 0xe6eaf0,
            feet: 0x2c313a,
        },
    },
    bull_market: {
        head: buildBullHead,
        torso: buildBullChain,
        palette: {
            head: 0x6d4a2c,
            torso: 0x14392a,
            arms: 0x6d4a2c,
            hands: 0x2b1d12,
            legs: 0x123024,
            feet: 0x1a1208,
        },
    },
    bear_market: {
        head: buildBearHead,
        torso: buildBearClaws,
        palette: {
            head: 0x574839,
            torso: 0x4c1f22,
            arms: 0x3f342c,
            hands: 0x241c18,
            legs: 0x2f2722,
            feet: 0x14100e,
        },
    },
    wif_hat: {
        head: buildWifHat,
    },
    laser_eyes: {
        head: buildLaserEyes,
    },
    deal_shades: {
        head: buildDealShades,
    },
};

export function buildCosmetic(id: CosmeticId): CosmeticAttachment {
    const blueprint = BLUEPRINTS[id];
    const head = blueprint?.head?.() ?? null;
    const torso = blueprint?.torso?.() ?? null;

    return {
        head,
        torso,
        palette: blueprint?.palette ?? null,
        tick: mergeTicks([head, torso]),
    };
}

export function disposeCosmetic(root: THREE.Object3D | null) {
    if (!root) return;
    root.removeFromParent();
    root.traverse((child) => {
        const renderable = child as THREE.Mesh & THREE.Sprite;
        if (!renderable.isMesh && !renderable.isSprite) return;
        renderable.geometry?.dispose();

        const material = renderable.material as THREE.Material | THREE.Material[];
        const list = Array.isArray(material) ? material : [material];
        for (const entry of list) {
            if (!entry) continue;
            const textured = entry as THREE.MeshStandardMaterial & THREE.SpriteMaterial;
            textured.map?.dispose();
            textured.emissiveMap?.dispose();
            entry.dispose();
        }
    });
}
