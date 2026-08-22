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
    sky.addColorStop(0, "#04131d");
    sky.addColorStop(0.5, "#07202a");
    sky.addColorStop(1, "#020c12");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 256, 256);

    const moon = ctx.createRadialGradient(206, 48, 6, 206, 48, 62);
    moon.addColorStop(0, "rgba(240, 248, 255, 0.95)");
    moon.addColorStop(0.22, "rgba(214, 232, 245, 0.55)");
    moon.addColorStop(1, "rgba(180, 214, 240, 0)");
    ctx.fillStyle = moon;
    ctx.beginPath();
    ctx.arc(206, 48, 62, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(96, 214, 158, 0.14)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 42);
        ctx.lineTo(256, i * 42);
        ctx.stroke();
    }

    const mirrorX = (x: number) => 256 - x;
    const closes = [214, 198, 204, 182, 170, 176, 150, 132, 138, 108, 88, 58];
    const step = 19;

    ctx.strokeStyle = "rgba(75, 224, 138, 0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < closes.length; i++) {
        const x = mirrorX(22 + i * step);
        if (i === 0) ctx.moveTo(x, closes[i]);
        else ctx.lineTo(x, closes[i]);
    }
    ctx.stroke();

    for (let i = 0; i < closes.length; i++) {
        const x = mirrorX(22 + i * step);
        const open = i === 0 ? 226 : closes[i - 1];
        const close = closes[i];
        const up = close < open;
        const body = Math.max(5, Math.abs(close - open));
        ctx.strokeStyle = up ? "#4be08a" : "#e2554b";
        ctx.fillStyle = up ? "#4be08a" : "#e2554b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, Math.min(open, close) - 9);
        ctx.lineTo(x, Math.max(open, close) + 9);
        ctx.stroke();
        ctx.fillRect(x - 6, Math.min(open, close), 12, body);
    }

    const tip = mirrorX(22 + (closes.length - 1) * step);
    ctx.strokeStyle = "#7dffb8";
    ctx.fillStyle = "#7dffb8";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mirrorX(30), 222);
    ctx.lineTo(tip, 44);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(tip, 26);
    ctx.lineTo(tip - 15, 54);
    ctx.lineTo(tip + 15, 54);
    ctx.closePath();
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

function curveFacePlate(
    geometry: THREE.BufferGeometry,
    bulge: number,
    wrap: number,
    radiusX: number,
    radiusY: number
) {
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i) / radiusX;
        const y = position.getY(i) / radiusY;
        const falloff = Math.max(0, 1 - (x * x + y * y));
        position.setZ(i, position.getZ(i) + falloff * bulge - x * x * wrap);
    }
    position.needsUpdate = true;
}

function buildTrumpHair(): THREE.Group {
    const group = new THREE.Group();
    const blond = matte(0xdfb658, 0.7);
    const blondDark = matte(0xc0952f, 0.72);

    const cap = new THREE.Mesh(new RoundedBoxGeometry(2.14, 1.5, 2.18, 3, 0.56), blond);
    cap.position.set(0, HEAD_TOP_Y - 0.64, -0.12);
    group.add(cap);

    const sweep = new THREE.Mesh(new RoundedBoxGeometry(2.06, 0.62, 1.0, 3, 0.3), blond);
    sweep.rotation.set(-0.2, 0.06, 0.06);
    sweep.position.set(0.05, HEAD_TOP_Y - 0.78, 0.44);
    group.add(sweep);

    const fringe = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.36, 0.5, 3, 0.16), blondDark);
    fringe.rotation.set(-0.42, 0.14, 0.08);
    fringe.position.set(0.12, HEAD_TOP_Y - 1.06, 0.72);
    group.add(fringe);

    return group;
}

function buildTrumpFace(): THREE.Group {
    const group = new THREE.Group();
    const tan = matte(0xe0a065, 0.82);
    const tanDark = matte(0xc9854a, 0.82);
    const white = matte(0xf6f4ee, 0.6);
    const iris = matte(0x2f4f74, 0.5);
    const dark = matte(0x14100e, 0.6);
    const lipMat = matte(0xb56b58, 0.75);

    group.add(mascotShell(tan));

    mirrored(group, (side) => {
        const socket = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), white);
        socket.scale.set(1.0, 0.5, 0.36);
        socket.position.set(side * 0.42, SHELL_CENTRE_Y + 0.26, SHELL_FRONT_Z - 0.04);
        return socket;
    });

    mirrored(group, (side) => {
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), iris);
        pupil.scale.set(1, 1, 0.5);
        pupil.position.set(side * 0.42, SHELL_CENTRE_Y + 0.28, SHELL_FRONT_Z + 0.06);
        return pupil;
    });

    mirrored(group, (side) => {
        const brow = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.14, 0.24, 2, 0.06), tanDark);
        brow.rotation.z = side * -0.1;
        brow.position.set(side * 0.44, SHELL_CENTRE_Y + 0.56, SHELL_FRONT_Z - 0.02);
        return brow;
    });

    mirrored(group, (side) => {
        const bag = new THREE.Mesh(new RoundedBoxGeometry(0.54, 0.14, 0.2, 2, 0.06), tanDark);
        bag.position.set(side * 0.42, SHELL_CENTRE_Y + 0.06, SHELL_FRONT_Z - 0.02);
        return bag;
    });

    const nose = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.6, 0.36, 2, 0.14), tan);
    nose.rotation.x = -0.08;
    nose.position.set(0, SHELL_CENTRE_Y - 0.24, SHELL_FRONT_Z - 0.06);
    group.add(nose);

    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), lipMat);
    mouth.scale.set(1.05, 0.62, 0.42);
    mouth.position.set(0, SHELL_CENTRE_Y - 0.78, SHELL_FRONT_Z - 0.06);
    group.add(mouth);

    const lipLine = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.34, 4, 8), dark);
    lipLine.rotation.z = Math.PI / 2;
    lipLine.position.set(0, SHELL_CENTRE_Y - 0.78, SHELL_FRONT_Z + 0.04);
    group.add(lipLine);

    const jaw = new THREE.Mesh(new RoundedBoxGeometry(1.86, 0.78, 1.8, 3, 0.34), tan);
    jaw.position.set(0, SHELL_CENTRE_Y - 1.02, 0.04);
    group.add(jaw);

    group.add(buildTrumpHair());
    return group;
}

function buildTrumpSuit(): THREE.Group {
    const group = new THREE.Group();
    const navyDark = matte(0x101c34, 0.85, 0);
    const shirt = matte(0xf1f3f7, 0.8, 0);
    const tie = matte(0xc0342c, 0.7, 0.05);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 8, 20), shirt);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, CHEST_NECK_Y - 0.04, 0.02);
    group.add(collar);

    mirrored(group, (side) => {
        const lapel = new THREE.Mesh(new RoundedBoxGeometry(0.32, 1.0, 0.14, 2, 0.06), navyDark);
        lapel.rotation.set(0.06, side * 0.14, side * 0.3);
        lapel.position.set(side * 0.26, CHEST_SHOULDER_Y - 0.44, CHEST_FRONT_Z - 0.08);
        return lapel;
    });

    mirrored(group, (side) => {
        const chestShirt = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.66, 0.1, 2, 0.04), shirt);
        chestShirt.rotation.z = side * 0.26;
        chestShirt.position.set(side * 0.1, CHEST_SHOULDER_Y - 0.34, CHEST_FRONT_Z - 0.04);
        return chestShirt;
    });

    const knot = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.2, 0.14, 2, 0.06), tie);
    knot.position.set(0, CHEST_NECK_Y - 0.26, CHEST_FRONT_Z - 0.08);
    group.add(knot);

    const tieBody = new THREE.Mesh(new RoundedBoxGeometry(0.24, 1.34, 0.12, 2, 0.05), tie);
    tieBody.position.set(0, CHEST_SHOULDER_Y - 0.88, CHEST_FRONT_Z - 0.02);
    group.add(tieBody);

    const tieTip = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.3, 4), tie);
    tieTip.rotation.set(Math.PI, Math.PI / 4, 0);
    tieTip.position.set(0, CHEST_SHOULDER_Y - 1.68, CHEST_FRONT_Z - 0.02);
    group.add(tieTip);

    return group;
}

function extruded(
    shape: THREE.Shape,
    depth: number,
    bevel: number,
    material: THREE.Material | THREE.Material[],
    segments = 22
): THREE.Mesh {
    return new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, {
            depth,
            bevelEnabled: bevel > 0,
            bevelThickness: bevel * 1.4,
            bevelSize: bevel,
            bevelSegments: 1,
            curveSegments: segments,
        }),
        material
    );
}

function hoodedShell(cloth: THREE.Material, clothDark: THREE.Material): THREE.Group {
    const group = new THREE.Group();

    const shell = new THREE.Mesh(new RoundedBoxGeometry(2.24, 2.92, 2.24, 3, 0.78), cloth);
    shell.position.set(0, SHELL_CENTRE_Y + 0.12, -0.12);
    group.add(shell);

    const portal = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 18), clothDark);
    portal.scale.set(0.88, 1.08, 0.3);
    portal.position.set(0, HEAD_CENTRE_Y, 0.9);
    group.add(portal);

    const collar = new THREE.Mesh(new RoundedBoxGeometry(2.18, 0.66, 2.0, 2, 0.32), clothDark);
    collar.position.set(0, SHELL_CENTRE_Y - 1.36, -0.16);
    group.add(collar);

    return group;
}

function pepeGrinShape(): THREE.Shape {
    const shape = new THREE.Shape();
    shape.moveTo(-0.92, 0.26);
    shape.bezierCurveTo(-0.5, -0.42, 0.5, -0.42, 0.92, 0.26);
    shape.bezierCurveTo(0.74, 0.16, 0.6, 0.1, 0.5, 0.06);
    shape.bezierCurveTo(0.24, -0.06, -0.24, -0.06, -0.5, 0.06);
    shape.bezierCurveTo(-0.6, 0.1, -0.74, 0.16, -0.92, 0.26);
    return shape;
}

function buildPepeHead(): THREE.Group {
    const group = new THREE.Group();
    const skin = matte(0x63b544, 0.82);
    const skinDark = matte(0x4c8f34, 0.85);
    const white = matte(0xf7f7f2, 0.55);
    const black = matte(0x0b0b0d, 0.5);
    const lip = matte(0xb64c33, 0.75);

    group.add(mascotShell(skin));

    const jaw = new THREE.Mesh(new RoundedBoxGeometry(1.94, 1.02, 1.7, 3, 0.44), skin);
    jaw.position.set(0, SHELL_CENTRE_Y - 0.72, 0.24);
    group.add(jaw);

    const grin = extruded(pepeGrinShape(), 0.12, 0.07, lip, 20);
    curveFacePlate(grin.geometry, 0.1, 0.42, 1.0, 0.7);
    grin.scale.set(0.88, 1, 1);
    grin.position.set(0, SHELL_CENTRE_Y - 0.48, SHELL_FRONT_Z - 0.12);
    group.add(grin);

    mirrored(group, (side) => {
        const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), skinDark);
        nostril.scale.set(1, 0.8, 0.6);
        nostril.position.set(side * 0.2, SHELL_CENTRE_Y + 0.14, SHELL_FRONT_Z - 0.02);
        return nostril;
    });

    mirrored(group, (side) => {
        const socket = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), skin);
        socket.scale.set(1.05, 0.95, 0.9);
        socket.position.set(side * 0.56, SHELL_TOP_Y - 0.34, 0.24);
        return socket;
    });

    mirrored(group, (side) => {
        const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.46, 22, 18), white);
        eyeball.position.set(side * 0.56, SHELL_TOP_Y - 0.32, 0.42);
        return eyeball;
    });

    mirrored(group, (side) => {
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), black);
        pupil.scale.set(0.95, 1.1, 0.75);
        pupil.position.set(side * 0.53, SHELL_TOP_Y - 0.34, 0.81);
        return pupil;
    });

    mirrored(group, (side) => {
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), white);
        glint.position.set(side * 0.44, SHELL_TOP_Y - 0.22, 0.8);
        return glint;
    });

    mirrored(group, (side) => {
        const lid = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.34),
            skin
        );
        lid.position.set(side * 0.56, SHELL_TOP_Y - 0.32, 0.42);
        lid.rotation.set(0.24, 0, side * 0.16);
        return lid;
    });

    return group;
}

function buildPepeShirt(): THREE.Group {
    const group = new THREE.Group();
    const shirt = matte(0x3f74b8, 0.85, 0);
    const shirtDark = matte(0x2f5b95, 0.85, 0);
    const button = matte(0xeeeee6, 0.6);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 8, 20), shirt);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, CHEST_NECK_Y - 0.04, 0.02);
    group.add(collar);

    mirrored(group, (side) => {
        const flap = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.26, 0.1, 2, 0.04), shirt);
        flap.rotation.set(0.2, side * 0.3, side * 0.62);
        flap.position.set(side * 0.16, CHEST_NECK_Y - 0.22, CHEST_FRONT_Z - 0.16);
        return flap;
    });

    const placket = new THREE.Mesh(new RoundedBoxGeometry(0.16, 1.1, 0.1, 2, 0.04), shirtDark);
    placket.position.set(0, CHEST_SHOULDER_Y - 0.72, CHEST_FRONT_Z - 0.06);
    group.add(placket);

    for (let i = 0; i < 3; i++) {
        const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10), button);
        stud.rotation.x = Math.PI / 2;
        stud.position.set(0, CHEST_SHOULDER_Y - 0.42 - i * 0.34, CHEST_FRONT_Z);
        group.add(stud);
    }

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

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), dark);
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
        const brow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), cream);
        brow.scale.set(1.35, 0.6, 0.45);
        brow.position.set(side * 0.42, SHELL_CENTRE_Y + 0.62, SHELL_FRONT_Z - 0.02);
        return brow;
    });

    mirrored(group, (side) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), dark);
        eye.scale.set(0.92, 1.05, 0.6);
        eye.position.set(side * 0.4, SHELL_CENTRE_Y + 0.3, SHELL_FRONT_Z);
        return eye;
    });

    mirrored(group, (side) => {
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), white);
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
    const cloth = matte(0x8f959f, 0.98, 0);
    const clothDark = matte(0x5f656e, 0.98, 0);
    const skin = matte(0xe6c9ae, 0.85);

    const group = hoodedShell(cloth, clothDark);

    const faceBlock = new THREE.Mesh(new THREE.SphereGeometry(0.96, 24, 18), skin);
    faceBlock.scale.set(0.8, 1.0, 0.34);
    faceBlock.position.set(0, HEAD_CENTRE_Y + 0.04, 0.9);
    group.add(faceBlock);

    const face = new THREE.Mesh(
        new THREE.PlaneGeometry(1.28, 1.42),
        new THREE.MeshBasicMaterial({
            map: makeWojakFaceTexture(),
            transparent: true,
            depthWrite: false,
        })
    );
    face.position.set(0, HEAD_CENTRE_Y + 0.12, 1.24);
    group.add(face);

    return group;
}

function buildWojakStrings(): THREE.Group {
    const group = new THREE.Group();
    const cloth = matte(0x8f959f, 0.98, 0);
    const clothDark = matte(0x6f757f, 0.98, 0);
    const cord = matte(0xe4e7ec, 0.9, 0);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.13, 8, 20), clothDark);
    collar.rotation.x = Math.PI / 2 - 0.1;
    collar.position.set(0, CHEST_NECK_Y - 0.06, 0.04);
    group.add(collar);

    mirrored(group, (side) => {
        const cordMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.6, 4, 8), cord);
        cordMesh.rotation.z = side * 0.12;
        cordMesh.position.set(side * 0.16, CHEST_NECK_Y - 0.5, CHEST_FRONT_Z - 0.06);
        return cordMesh;
    });

    mirrored(group, (side) => {
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), clothDark);
        tip.position.set(side * 0.2, CHEST_NECK_Y - 0.86, CHEST_FRONT_Z - 0.06);
        return tip;
    });

    const pocket = new THREE.Mesh(new RoundedBoxGeometry(0.94, 0.44, 0.14, 2, 0.07), clothDark);
    pocket.position.set(0, CHEST_SHOULDER_Y - 1.16, CHEST_FRONT_Z - 0.06);
    group.add(pocket);

    const hem = new THREE.Mesh(new RoundedBoxGeometry(1.16, 0.18, 0.96, 2, 0.08), clothDark);
    hem.position.set(0, CHEST_SHOULDER_Y - 1.54, 0.06);
    group.add(hem);

    return group;
}

function buildGigachadHead(): THREE.Group {
    const group = new THREE.Group();
    const marble = matte(0xe6e2da, 0.55);
    const marbleShade = matte(0xc9c4ba, 0.6);
    const stubble = matte(0x8f8b83, 0.72);
    const hair = matte(0x1d1e24, 0.72);
    const dark = matte(0x111219, 0.5);

    group.add(mascotShell(marble));

    const jaw = new THREE.Mesh(new RoundedBoxGeometry(2.0, 1.0, 1.9, 3, 0.32), marble);
    jaw.position.set(0, SHELL_CENTRE_Y - 0.78, 0.1);
    group.add(jaw);

    const beard = new THREE.Mesh(new RoundedBoxGeometry(2.04, 0.78, 1.98, 3, 0.32), stubble);
    beard.position.set(0, SHELL_CENTRE_Y - 1.02, 0.1);
    group.add(beard);

    const chin = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.5, 0.66, 2, 0.2), stubble);
    chin.position.set(0, SHELL_CENTRE_Y - 1.2, SHELL_FRONT_Z - 0.18);
    group.add(chin);

    const cleft = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.16, 4, 8), marbleShade);
    cleft.position.set(0, SHELL_CENTRE_Y - 1.2, SHELL_FRONT_Z + 0.14);
    group.add(cleft);

    mirrored(group, (side) => {
        const cheek = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.44, 0.72, 2, 0.18), marbleShade);
        cheek.rotation.set(0, 0, side * 0.16);
        cheek.position.set(side * 0.66, SHELL_CENTRE_Y - 0.1, SHELL_FRONT_Z - 0.3);
        return cheek;
    });

    const nose = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.72, 0.34, 2, 0.11), marble);
    nose.rotation.x = -0.08;
    nose.position.set(0, SHELL_CENTRE_Y - 0.22, SHELL_FRONT_Z - 0.04);
    group.add(nose);

    const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.52, 4, 10), dark);
    mouth.rotation.z = Math.PI / 2;
    mouth.position.set(0, SHELL_CENTRE_Y - 0.76, SHELL_FRONT_Z + 0.1);
    group.add(mouth);

    const brow = new THREE.Mesh(new RoundedBoxGeometry(1.84, 0.36, 0.62, 3, 0.14), marbleShade);
    brow.rotation.x = -0.2;
    brow.position.set(0, SHELL_CENTRE_Y + 0.52, SHELL_FRONT_Z - 0.16);
    group.add(brow);

    mirrored(group, (side) => {
        const socket = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), dark);
        socket.scale.set(1.15, 0.52, 0.34);
        socket.rotation.z = side * 0.14;
        socket.position.set(side * 0.44, SHELL_CENTRE_Y + 0.16, SHELL_FRONT_Z - 0.02);
        return socket;
    });

    mirrored(group, (side) => {
        const lid = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.16, 0.34, 2, 0.07), marble);
        lid.rotation.set(0.22, 0, side * 0.16);
        lid.position.set(side * 0.44, SHELL_CENTRE_Y + 0.32, SHELL_FRONT_Z - 0.04);
        return lid;
    });

    const cap = new THREE.Mesh(new RoundedBoxGeometry(2.06, 0.86, 2.06, 3, 0.42), hair);
    cap.position.set(0, SHELL_TOP_Y - 0.2, -0.04);
    group.add(cap);

    const fringe = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.42, 0.6, 3, 0.16), hair);
    fringe.rotation.x = -0.22;
    fringe.position.set(0, SHELL_TOP_Y - 0.56, SHELL_FRONT_Z - 0.24);
    group.add(fringe);

    mirrored(group, (side) => {
        const temple = new THREE.Mesh(new RoundedBoxGeometry(0.3, 1.1, 1.9, 3, 0.16), hair);
        temple.position.set(side * 0.94, SHELL_CENTRE_Y + 0.68, -0.06);
        return temple;
    });

    const nape = new THREE.Mesh(new RoundedBoxGeometry(1.86, 1.3, 0.34, 3, 0.16), hair);
    nape.position.set(0, SHELL_CENTRE_Y + 0.58, -0.94);
    group.add(nape);

    return group;
}

function buildGigachadTorso(): THREE.Group {
    const group = new THREE.Group();
    const marble = matte(0xe6e2da, 0.55);
    const marbleShade = matte(0xc7c2b8, 0.6);

    mirrored(group, (side) => {
        const pec = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), marble);
        pec.scale.set(0.92, 0.5, 0.3);
        pec.rotation.z = side * 0.08;
        pec.position.set(side * 0.3, CHEST_SHOULDER_Y - 0.32, CHEST_FRONT_Z - 0.2);
        return pec;
    });

    const sternum = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.34, 4, 8), marbleShade);
    sternum.position.set(0, CHEST_SHOULDER_Y - 0.34, CHEST_FRONT_Z - 0.12);
    group.add(sternum);

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
            emissiveIntensity: 0.72,
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
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), eyeMat);
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
    const furDark = matte(0x3b3129, 0.92);
    const fur = matte(0x53453a, 0.9);
    const muzzleMat = matte(0x8b7458, 0.85);
    const dark = matte(0x140f0c, 0.6);
    const ivory = matte(0xf1ece0, 0.45);
    const white = matte(0xf6f3ec, 0.5);
    const irisMat = glowing(0xff8a72, 0xd22a1c, 1.6);

    group.add(mascotShell(fur));

    const crown = new THREE.Mesh(new RoundedBoxGeometry(1.94, 0.42, 1.9, 3, 0.2), furDark);
    crown.position.set(0, SHELL_TOP_Y - 0.2, -0.04);
    group.add(crown);

    mirrored(group, (side) => {
        const ear = new THREE.Group();

        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 14), furDark);
        shell.scale.set(1, 1, 0.5);
        ear.add(shell);

        const inner = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), muzzleMat);
        inner.scale.set(1, 1, 0.42);
        inner.position.z = 0.13;
        ear.add(inner);

        ear.position.set(side * 0.72, SHELL_TOP_Y - 0.08, -0.02);
        ear.rotation.y = side * -0.2;
        return ear;
    });

    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.54, 22, 18), muzzleMat);
    muzzle.scale.set(0.96, 0.8, 1);
    muzzle.position.set(0, SHELL_CENTRE_Y - 0.46, SHELL_FRONT_Z - 0.06);
    group.add(muzzle);

    const nose = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.2, 0.2, 2, 0.09), dark);
    nose.position.set(0, SHELL_CENTRE_Y - 0.22, SHELL_FRONT_Z + 0.34);
    group.add(nose);

    const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.2, 4, 8), dark);
    bridge.position.set(0, SHELL_CENTRE_Y - 0.44, SHELL_FRONT_Z + 0.4);
    group.add(bridge);

    const snarl = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), dark);
    snarl.scale.set(1.32, 0.42, 0.4);
    snarl.position.set(0, SHELL_CENTRE_Y - 0.74, SHELL_FRONT_Z + 0.26);
    group.add(snarl);

    const lowerLip = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.2, 0.3, 2, 0.08), muzzleMat);
    lowerLip.position.set(0, SHELL_CENTRE_Y - 0.92, SHELL_FRONT_Z + 0.2);
    group.add(lowerLip);

    mirrored(group, (side) => {
        const fang = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 10), ivory);
        fang.rotation.x = Math.PI;
        fang.position.set(side * 0.17, SHELL_CENTRE_Y - 0.78, SHELL_FRONT_Z + 0.34);
        return fang;
    });

    mirrored(group, (side) => {
        const brow = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.19, 0.3, 2, 0.08), furDark);
        brow.rotation.z = side * -0.42;
        brow.position.set(side * 0.42, SHELL_CENTRE_Y + 0.58, SHELL_FRONT_Z - 0.04);
        return brow;
    });

    mirrored(group, (side) => {
        const socket = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), white);
        socket.scale.set(0.95, 0.85, 0.55);
        socket.position.set(side * 0.42, SHELL_CENTRE_Y + 0.28, SHELL_FRONT_Z - 0.04);
        return socket;
    });

    mirrored(group, (side) => {
        const iris = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), irisMat);
        iris.scale.set(1, 1, 0.55);
        iris.position.set(side * 0.44, SHELL_CENTRE_Y + 0.26, SHELL_FRONT_Z + 0.04);
        return iris;
    });

    mirrored(group, (side) => {
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), dark);
        pupil.scale.set(1, 1.2, 0.5);
        pupil.position.set(side * 0.44, SHELL_CENTRE_Y + 0.26, SHELL_FRONT_Z + 0.1);
        return pupil;
    });

    group.add(pulse(irisMat, 1.6, 0.6, 2.2));
    return group;
}

function buildBearClaws(): THREE.Group {
    const group = new THREE.Group();
    const hide = matte(0x2b211b, 0.95);
    const torn = matte(0x1a1411, 0.95);
    const slashMat = glowing(0xff6a55, 0xd42a1c, 1.6);

    mirrored(group, (side) => {
        const strap = new THREE.Mesh(new RoundedBoxGeometry(0.22, 1.3, 0.16, 2, 0.07), hide);
        strap.rotation.z = side * 0.3;
        strap.position.set(side * 0.3, CHEST_SHOULDER_Y - 0.44, CHEST_FRONT_Z - 0.08);
        return strap;
    });

    for (let i = 0; i < 3; i++) {
        const offset = -0.28 + i * 0.28;

        const gash = new THREE.Mesh(new RoundedBoxGeometry(0.15, 1.0, 0.12, 2, 0.05), torn);
        gash.rotation.z = 0.36;
        gash.position.set(offset, CHEST_SHOULDER_Y - 0.6, CHEST_FRONT_Z - 0.08);
        group.add(gash);

        const glow = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.82, 4, 8), slashMat);
        glow.rotation.z = 0.36;
        glow.position.set(offset, CHEST_SHOULDER_Y - 0.6, CHEST_FRONT_Z - 0.02);
        group.add(glow);
    }

    const belt = new THREE.Mesh(new RoundedBoxGeometry(1.24, 0.2, 1.0, 2, 0.08), hide);
    belt.position.set(0, CHEST_SHOULDER_Y - 1.36, 0.04);
    group.add(belt);

    group.add(pulse(slashMat, 1.6, 0.5, 1.7));
    return group;
}

function buildLaserEyes(): THREE.Group {
    const group = new THREE.Group();
    const scleraMat = matte(0xf8f6f0, 0.5);
    const coreMat = glowing(0xfff0d8, 0xff3a18, 3);
    const beamMat = new THREE.MeshBasicMaterial({
        color: 0xff5528,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const haloMat = new THREE.MeshBasicMaterial({
        color: 0xff7a3c,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const glowMat = new THREE.SpriteMaterial({
        map: makeGlowTexture("rgba(255,240,220,0.95)", "rgba(255,80,40,0.6)"),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    const eyeY = HEAD_CENTRE_Y + 0.08;

    mirrored(group, (side) => {
        const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), scleraMat);
        sclera.scale.set(1, 0.86, 0.6);
        sclera.position.set(side * 0.4, eyeY, HEAD_FRONT_Z - 0.06);
        return sclera;
    });

    mirrored(group, (side) => {
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), coreMat);
        core.position.set(side * 0.4, eyeY, HEAD_FRONT_Z + 0.04);
        return core;
    });

    mirrored(group, (side) => {
        const halo = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.34, 20), haloMat);
        halo.position.set(side * 0.4, eyeY, HEAD_FRONT_Z + 0.08);
        return halo;
    });

    const beams: THREE.Mesh[] = [];
    mirrored(group, (side) => {
        const beam = new THREE.Mesh(new THREE.ConeGeometry(0.34, 3.6, 18, 1, true), beamMat);
        beam.rotation.x = Math.PI / 2;
        beam.position.set(side * 0.4, eyeY, HEAD_FRONT_Z + 1.84);
        beams.push(beam);
        return beam;
    });

    mirrored(group, (side) => {
        const flare = new THREE.Sprite(glowMat);
        flare.scale.setScalar(1.1);
        flare.position.set(side * 0.4, eyeY, HEAD_FRONT_Z + 0.12);
        return flare;
    });

    const driver = new THREE.Object3D();
    driver.userData.cosmeticTick = (elapsed: number) => {
        beamMat.opacity = 0.34 + Math.abs(Math.sin(elapsed * 5.2)) * 0.18;
        haloMat.opacity = 0.24 + Math.abs(Math.sin(elapsed * 3.6)) * 0.14;
        coreMat.emissiveIntensity = 2.6 + Math.sin(elapsed * 7.4) * 0.8;
        for (const beam of beams) {
            beam.scale.set(1 + Math.sin(elapsed * 6.1) * 0.07, 1, 1 + Math.cos(elapsed * 5.3) * 0.07);
        }
    };
    group.add(driver);

    return group;
}

function buildDealShades(): THREE.Group {
    const group = new THREE.Group();
    const frame = matte(0x0c0c10, 0.6, 0.15);
    const lens = new THREE.MeshStandardMaterial({
        color: 0x15151c,
        roughness: 0.16,
        metalness: 0.45,
    });

    const eyeY = HEAD_CENTRE_Y + 0.06;
    const faceZ = HEAD_FRONT_Z + 0.04;

    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.36, 0.2), frame);
    bar.position.set(0, eyeY, faceZ);
    group.add(bar);

    const steps: Array<[number, number]> = [
        [-0.8, 0.12],
        [-0.48, 0.2],
        [-0.16, 0.28],
        [0.16, 0.28],
        [0.48, 0.2],
        [0.8, 0.12],
    ];
    for (const [x, height] of steps) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(0.32, height, 0.2), frame);
        step.position.set(x, eyeY + 0.18 + height / 2, faceZ);
        group.add(step);
    }

    mirrored(group, (side) => {
        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 0.08), lens);
        glass.position.set(side * 0.44, eyeY, faceZ + 0.1);
        return glass;
    });

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.12), frame);
    bridge.position.set(0, eyeY + 0.04, faceZ + 0.08);
    group.add(bridge);

    mirrored(group, (side) => {
        const temple = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 1.1), frame);
        temple.rotation.y = side * 0.12;
        temple.position.set(side * 0.94, eyeY + 0.04, faceZ - 0.62);
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
    trump_hair: {
        head: buildTrumpHair,
    },
    trump_suit: {
        head: buildTrumpFace,
        torso: buildTrumpSuit,
        palette: {
            head: 0xe0a065,
            torso: 0x1b2a4a,
            arms: 0x1b2a4a,
            hands: 0xe0a065,
            legs: 0x243352,
            feet: 0x14161c,
        },
    },
    pepe_frog: {
        head: buildPepeHead,
        torso: buildPepeShirt,
        palette: {
            head: 0x63b544,
            torso: 0x3f74b8,
            arms: 0x3f74b8,
            hands: 0x63b544,
            legs: 0x2c3550,
            feet: 0x1b2030,
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
        torso: buildGigachadTorso,
        palette: {
            head: 0xe6e2da,
            torso: 0xece8e0,
            arms: 0xe0dcd4,
            hands: 0xd6d1c8,
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
            head: 0x53453a,
            torso: 0x3a2b23,
            arms: 0x53453a,
            hands: 0x241c18,
            legs: 0x2f2722,
            feet: 0x14100e,
        },
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
