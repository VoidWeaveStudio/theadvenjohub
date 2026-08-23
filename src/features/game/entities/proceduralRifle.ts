// src/features/game/entities/proceduralRifle.ts
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type PartKey = "body" | "steel" | "polymer" | "dark" | "accent";

const GUNMETAL = 0x30353d;
const STEEL = 0x555d68;
const POLYMER = 0x1b1f25;
const DARK = 0x101216;

const BORE_Z = 0.028;

const SIDE_TO_WORLD = new THREE.Matrix4().set(
    0, 0, 1, 0,
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 0, 1
);

type Point = [number, number];

class PartBuilder {
    private readonly buckets = new Map<PartKey, THREE.BufferGeometry[]>();

    add(key: PartKey, geometry: THREE.BufferGeometry): void {
        const flat = geometry.index ? geometry.toNonIndexed() : geometry;
        const list = this.buckets.get(key);
        if (list) list.push(flat);
        else this.buckets.set(key, [flat]);
    }

    merge(key: PartKey): THREE.BufferGeometry | null {
        const list = this.buckets.get(key);
        if (!list || list.length === 0) return null;
        if (list.length === 1) return list[0];

        const merged = mergeGeometries(list, false);
        list.forEach((geometry) => geometry.dispose());
        return merged;
    }

    keys(): PartKey[] {
        return [...this.buckets.keys()];
    }
}

function box(width: number, length: number, height: number, position: Point3, rotation?: Point3): THREE.BufferGeometry {
    return place(new THREE.BoxGeometry(width, length, height), position, rotation);
}

type Point3 = [number, number, number];

function place(geometry: THREE.BufferGeometry, position: Point3, rotation?: Point3): THREE.BufferGeometry {
    if (rotation) {
        if (rotation[0]) geometry.rotateX(rotation[0]);
        if (rotation[1]) geometry.rotateY(rotation[1]);
        if (rotation[2]) geometry.rotateZ(rotation[2]);
    }
    geometry.translate(position[0], position[1], position[2]);
    return geometry;
}

function tube(radiusTop: number, radiusBottom: number, length: number, segments: number, position: Point3, rotation?: Point3): THREE.BufferGeometry {
    return place(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, segments), position, rotation);
}

function ring(radius: number, thickness: number, segments: number, position: Point3): THREE.BufferGeometry {
    return place(new THREE.TorusGeometry(radius, thickness, 6, segments), position, [Math.PI / 2, 0, 0]);
}

function sideProfile(outline: Point[], width: number, hole?: Point[], bevel = 0.004): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    shape.moveTo(outline[0][0], outline[0][1]);
    for (let i = 1; i < outline.length; i++) shape.lineTo(outline[i][0], outline[i][1]);
    shape.closePath();

    if (hole) {
        const path = new THREE.Path();
        path.moveTo(hole[0][0], hole[0][1]);
        for (let i = 1; i < hole.length; i++) path.lineTo(hole[i][0], hole[i][1]);
        path.closePath();
        shape.holes.push(path);
    }

    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: width,
        bevelEnabled: bevel > 0,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelOffset: 0,
        bevelSegments: 1,
        curveSegments: 1,
        steps: 1,
    });

    geometry.applyMatrix4(SIDE_TO_WORLD);
    geometry.translate(-width / 2, 0, 0);
    return geometry;
}

function buildBarrel(parts: PartBuilder) {
    parts.add("steel", tube(0.0125, 0.0125, 0.30, 12, [0, 0.22, BORE_Z]));
    parts.add("body", box(0.032, 0.05, 0.034, [0, 0.302, BORE_Z + 0.01]));
    parts.add("dark", box(0.012, 0.026, 0.014, [0, 0.302, BORE_Z + 0.032]));

    const brake = new THREE.LatheGeometry([
        new THREE.Vector2(0.0135, 0),
        new THREE.Vector2(0.0265, 0.006),
        new THREE.Vector2(0.0265, 0.016),
        new THREE.Vector2(0.0195, 0.020),
        new THREE.Vector2(0.0195, 0.030),
        new THREE.Vector2(0.0275, 0.034),
        new THREE.Vector2(0.0275, 0.044),
        new THREE.Vector2(0.0205, 0.049),
        new THREE.Vector2(0.0135, 0.049),
    ], 12);
    parts.add("steel", place(brake, [0, 0.352, BORE_Z]));

    for (const side of [-1, 1]) {
        parts.add("dark", box(0.006, 0.03, 0.03, [side * 0.021, 0.372, BORE_Z]));
    }
}

function buildHandguard(parts: PartBuilder) {
    const shroud = new THREE.CylinderGeometry(0.036, 0.033, 0.205, 8, 1, true);
    shroud.rotateY(Math.PI / 8);
    parts.add("polymer", place(shroud, [0, 0.225, BORE_Z]));

    parts.add("polymer", tube(0.0355, 0.0355, 0.016, 8, [0, 0.132, BORE_Z], [0, Math.PI / 8, 0]));

    for (const y of [0.162, 0.208, 0.254, 0.300]) {
        parts.add("dark", ring(0.0355, 0.0035, 14, [0, y, BORE_Z]));
    }

    for (const side of [-1, 1]) {
        parts.add("accent", box(0.005, 0.148, 0.008, [side * 0.0345, 0.226, BORE_Z]));
    }

    parts.add("accent", ring(0.0385, 0.0055, 16, [0, 0.181, BORE_Z]));
    parts.add("accent", ring(0.0385, 0.0055, 16, [0, 0.272, BORE_Z]));

    parts.add("dark", box(0.026, 0.06, 0.02, [0, 0.185, BORE_Z - 0.04]));
}

function buildReceiver(parts: PartBuilder) {
    parts.add("body", sideProfile([
        [-0.175, -0.010],
        [-0.090, -0.036],
        [0.020, -0.042],
        [0.125, -0.032],
        [0.152, 0.006],
        [0.132, 0.048],
        [0.010, 0.057],
        [-0.095, 0.051],
        [-0.168, 0.030],
    ], 0.060, undefined, 0.005));

    parts.add("steel", box(0.008, 0.062, 0.030, [0.031, 0.062, 0.018]));
    parts.add("dark", box(0.004, 0.066, 0.034, [0.036, 0.062, 0.018]));

    parts.add("steel", box(0.026, 0.014, 0.014, [-0.038, 0.104, 0.034]));
    parts.add("dark", box(0.010, 0.030, 0.010, [-0.048, 0.104, 0.034]));

    parts.add("dark", box(0.030, 0.040, 0.012, [0.030, -0.020, 0.026], [0, 0, 0.2]));

    for (const side of [-1, 1]) {
        parts.add("accent", box(0.005, 0.130, 0.007, [side * 0.031, 0.010, 0.034]));
    }
}

function buildRail(parts: PartBuilder) {
    parts.add("body", box(0.028, 0.455, 0.012, [0, 0.118, 0.062]));

    for (let i = 0; i < 10; i++) {
        parts.add("dark", box(0.032, 0.009, 0.017, [0, -0.090 + i * 0.045, 0.069]));
    }

    parts.add("steel", box(0.006, 0.009, 0.038, [0, 0.318, 0.086]));
    for (const side of [-1, 1]) {
        parts.add("dark", box(0.005, 0.008, 0.044, [side * 0.016, 0.318, 0.088]));
    }

    parts.add("steel", place(new THREE.TorusGeometry(0.017, 0.004, 6, 14), [0, -0.046, 0.086], [Math.PI / 2, 0, 0]));
    parts.add("accent", place(new THREE.SphereGeometry(0.0055, 8, 6), [0, -0.046, 0.086]));
}

function buildCell(parts: PartBuilder) {
    const tilt = 0.22;
    const axisY = Math.sin(tilt);
    const axisZ = -Math.cos(tilt);
    const along = (d: number): [number, number, number] => [0, 0.014 + axisY * d, -0.082 + axisZ * d];

    parts.add("polymer", box(0.046, 0.052, 0.160, along(0), [tilt, 0, 0]));
    parts.add("dark", box(0.052, 0.058, 0.022, along(-0.072), [tilt, 0, 0]));

    for (let i = 0; i < 3; i++) {
        parts.add("accent", box(0.049, 0.056, 0.010, along(i * 0.035), [tilt, 0, 0]));
    }

    parts.add("dark", box(0.048, 0.056, 0.016, along(0.086), [tilt, 0, 0]));
}

function buildTrigger(parts: PartBuilder) {
    parts.add("body", sideProfile([
        [-0.016, -0.030],
        [-0.062, -0.030],
        [-0.070, -0.060],
        [-0.040, -0.082],
        [-0.012, -0.062],
    ], 0.016, [
        [-0.022, -0.038],
        [-0.056, -0.038],
        [-0.062, -0.056],
        [-0.040, -0.072],
        [-0.018, -0.056],
    ], 0.002));

    parts.add("steel", box(0.008, 0.012, 0.028, [0, -0.040, -0.050], [0.2, 0, 0]));
}

function buildGrip(parts: PartBuilder) {
    parts.add("polymer", sideProfile([
        [-0.070, -0.026],
        [-0.048, -0.046],
        [-0.060, -0.108],
        [-0.086, -0.172],
        [-0.140, -0.188],
        [-0.164, -0.146],
        [-0.140, -0.078],
        [-0.134, -0.026],
    ], 0.044, undefined, 0.006));

    for (let i = 0; i < 4; i++) {
        parts.add("dark", box(0.048, 0.010, 0.016, [0, -0.084 - i * 0.022, -0.072 - i * 0.030], [0.42, 0, 0]));
    }

    parts.add("dark", box(0.046, 0.040, 0.014, [0, -0.148, -0.190], [0.42, 0, 0]));
}

function buildStock(parts: PartBuilder) {
    parts.add("steel", tube(0.019, 0.019, 0.175, 10, [0, -0.245, 0.018]));

    parts.add("body", sideProfile([
        [-0.168, -0.022],
        [-0.152, 0.048],
        [-0.300, 0.062],
        [-0.352, 0.046],
        [-0.362, -0.006],
        [-0.300, -0.016],
        [-0.216, -0.050],
    ], 0.050, [
        [-0.206, 0.004],
        [-0.200, 0.038],
        [-0.302, 0.046],
        [-0.330, 0.008],
        [-0.252, -0.010],
    ], 0.005));

    parts.add("polymer", box(0.038, 0.135, 0.016, [0, -0.248, 0.068]));
    parts.add("dark", box(0.054, 0.020, 0.082, [0, -0.368, 0.020], [0.12, 0, 0]));
    parts.add("accent", box(0.052, 0.028, 0.006, [0, -0.186, 0.052]));
}

function materialFor(key: PartKey, accent: number): THREE.MeshStandardMaterial {
    if (key === "accent") {
        return new THREE.MeshStandardMaterial({
            color: accent,
            emissive: accent,
            emissiveIntensity: 1.5,
            roughness: 0.3,
            metalness: 0.35,
            toneMapped: false,
        });
    }

    if (key === "polymer") return new THREE.MeshStandardMaterial({ color: POLYMER, roughness: 0.74, metalness: 0.1 });
    if (key === "dark") return new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.88, metalness: 0.25 });
    if (key === "steel") return new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.26, metalness: 0.92 });
    return new THREE.MeshStandardMaterial({ color: GUNMETAL, roughness: 0.38, metalness: 0.85 });
}

export function buildRifle(accent: number): THREE.Group {
    const group = new THREE.Group();
    group.name = "rifle";

    const parts = new PartBuilder();
    buildBarrel(parts);
    buildHandguard(parts);
    buildReceiver(parts);
    buildRail(parts);
    buildCell(parts);
    buildTrigger(parts);
    buildGrip(parts);
    buildStock(parts);

    for (const key of parts.keys()) {
        const geometry = parts.merge(key);
        if (!geometry) continue;

        const mesh = new THREE.Mesh(geometry, materialFor(key, accent));
        mesh.name = `rifle-${key}`;
        mesh.castShadow = true;
        group.add(mesh);
    }

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
