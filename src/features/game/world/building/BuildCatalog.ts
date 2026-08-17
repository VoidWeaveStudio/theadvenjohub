// src/features/game/world/building/BuildCatalog.ts
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { getSurfaceMaterial, getSurfaceUvScale, type SurfaceId } from "./buildTextures";
import { CELL_SIZE, LEVEL_HEIGHT, SPAWN_BEACON_PIECE, STORAGE_CRATE_PIECE } from "@/core/lib/roomLayoutGrid";

export { CELL_SIZE, LEVEL_HEIGHT };
export const WALL_THICKNESS = 0.18;
export const HALF = CELL_SIZE / 2;
export const STAIR_STEPS = 9;
export const STAIR_LANDING = 0.3;
export const STAIR_FLIGHT = CELL_SIZE - STAIR_LANDING;

const SEAM = 0.02;

export type BuildSlot = "tile" | "edge" | "object";
export type BuildLayer = "floor" | "ceiling" | "roof" | "ground" | "stairs";
export type BuildCategory = "structure" | "openings" | "roofing" | "outdoor" | "garden" | "lighting" | "furniture" | "decor";

export interface BuildPart {
    geometry: THREE.BufferGeometry;
    surface: SurfaceId;
}

export interface BuildOpening {
    width: number;
    bottom: number;
    top: number;
}

export interface BuildLightSpec {
    color: number;
    intensity: number;
    distance: number;
    x: number;
    y: number;
    z: number;
    flicker?: number;
    nightOnly?: boolean;
}

export interface BuildPaintSpec {
    width: number;
    height: number;
    y: number;
    z: number;
}

export interface BuildInteractSpec {
    id: string;
    keyed?: boolean;
    y: number;
    reach?: number;
}

export const SPAWN_BEACON_INTERACTION = "spawn-beacon";
export const STORAGE_INTERACTION = "storage";

export interface BuildEntry {
    id: string;
    name: string;
    icon: string;
    category: BuildCategory;
    slot: BuildSlot;
    layer: BuildLayer;
    blocking: boolean;
    walkableTop: number | null;
    blockHeight?: number;
    blockRadius?: number;
    attachesToWall?: boolean;
    opening?: BuildOpening;
    ramp?: boolean;
    hinged?: boolean;
    light?: BuildLightSpec;
    paint?: BuildPaintSpec;
    interact?: BuildInteractSpec;
    build: () => BuildPart[];
}

function box(width: number, height: number, depth: number, x: number, y: number, z: number): THREE.BufferGeometry {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    geometry.translate(x, y, z);
    return geometry;
}

function tiltedBox(
    width: number, height: number, depth: number,
    x: number, y: number, z: number,
    rotX: number, rotY: number, rotZ: number
): THREE.BufferGeometry {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    if (rotX) geometry.rotateX(rotX);
    if (rotZ) geometry.rotateZ(rotZ);
    if (rotY) geometry.rotateY(rotY);
    geometry.translate(x, y, z);
    return geometry;
}

function cylinder(radiusTop: number, radiusBottom: number, height: number, segments: number, x: number, y: number, z: number): THREE.BufferGeometry {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
    geometry.translate(x, y, z);
    return geometry;
}

function tube(radiusTop: number, radiusBottom: number, height: number, segments: number): THREE.BufferGeometry {
    return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, true);
}

function cone(radius: number, height: number, segments: number, x: number, y: number, z: number): THREE.BufferGeometry {
    const geometry = new THREE.ConeGeometry(radius, height, segments);
    geometry.translate(x, y, z);
    return geometry;
}

function disc(radius: number, thickness: number, segments: number, x: number, y: number, z: number): THREE.BufferGeometry {
    const geometry = new THREE.CylinderGeometry(radius, radius, thickness, segments);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(x, y, z);
    return geometry;
}

function plate(radius: number, thickness: number, segments: number, x: number, y: number, z: number): THREE.BufferGeometry {
    const geometry = new THREE.CylinderGeometry(radius, radius, thickness, segments);
    geometry.translate(x, y, z);
    return geometry;
}

function ring(radius: number, tubeRadius: number, segments: number, x: number, y: number, z: number): THREE.BufferGeometry {
    const geometry = new THREE.TorusGeometry(radius, tubeRadius, 5, segments);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(x, y, z);
    return geometry;
}

function hoop(radius: number, tubeRadius: number, segments: number, x: number, y: number, z: number): THREE.BufferGeometry {
    const geometry = new THREE.TorusGeometry(radius, tubeRadius, 5, segments);
    geometry.translate(x, y, z);
    return geometry;
}

function bar(
    radius: number, length: number, segments: number,
    x: number, y: number, z: number,
    rotX = 0, rotZ = 0
): THREE.BufferGeometry {
    const geometry = new THREE.CylinderGeometry(radius, radius, length, segments);
    if (rotX) geometry.rotateX(rotX);
    if (rotZ) geometry.rotateZ(rotZ);
    geometry.translate(x, y, z);
    return geometry;
}

function blob(radius: number, detail: number, x: number, y: number, z: number): THREE.BufferGeometry {
    const geometry = new THREE.IcosahedronGeometry(radius, detail);
    geometry.translate(x, y, z);
    return geometry;
}

function shapedBlob(
    radius: number, detail: number,
    scaleX: number, scaleY: number, scaleZ: number,
    x: number, y: number, z: number, rotY = 0
): THREE.BufferGeometry {
    const geometry = new THREE.IcosahedronGeometry(radius, detail);
    geometry.scale(scaleX, scaleY, scaleZ);
    if (rotY) geometry.rotateY(rotY);
    geometry.translate(x, y, z);
    return geometry;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const flat = parts.map((geometry) => {
        if (!geometry.index) return geometry;
        const converted = geometry.toNonIndexed();
        geometry.dispose();
        return converted;
    });

    if (flat.length === 1) return flat[0];

    const merged = mergeGeometries(flat, false);
    flat.forEach((geometry) => geometry.dispose());
    return merged ?? new THREE.BufferGeometry();
}

function part(surface: SurfaceId, geometries: THREE.BufferGeometry[]): BuildPart {
    return { surface, geometry: merge(geometries) };
}

const uvNormal = new THREE.Vector3();
const uvEdgeA = new THREE.Vector3();
const uvEdgeB = new THREE.Vector3();
const uvA = new THREE.Vector3();
const uvB = new THREE.Vector3();
const uvC = new THREE.Vector3();

export function applyBoxUv(geometry: THREE.BufferGeometry, scale: number) {
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    const count = position.count;
    const uv = new Float32Array(count * 2);

    for (let i = 0; i < count; i += 3) {
        uvA.fromBufferAttribute(position, i);
        uvB.fromBufferAttribute(position, i + 1);
        uvC.fromBufferAttribute(position, i + 2);

        uvEdgeA.subVectors(uvB, uvA);
        uvEdgeB.subVectors(uvC, uvA);
        uvNormal.crossVectors(uvEdgeA, uvEdgeB);

        const absX = Math.abs(uvNormal.x);
        const absY = Math.abs(uvNormal.y);
        const absZ = Math.abs(uvNormal.z);

        for (let v = 0; v < 3; v++) {
            const point = v === 0 ? uvA : v === 1 ? uvB : uvC;
            const index = (i + v) * 2;

            if (absY >= absX && absY >= absZ) {
                uv[index] = point.x * scale;
                uv[index + 1] = point.z * scale;
            } else if (absX >= absZ) {
                uv[index] = point.z * scale;
                uv[index + 1] = point.y * scale;
            } else {
                uv[index] = point.x * scale;
                uv[index + 1] = point.y * scale;
            }
        }
    }

    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

export function applyLocalUv(geometry: THREE.BufferGeometry, surface: SurfaceId) {
    const target = geometry.index ? geometry.toNonIndexed() : geometry;
    applyBoxUv(target, getSurfaceUvScale(surface));
    return target;
}

function slab(surface: SurfaceId, thickness: number, y: number): BuildPart[] {
    return [part(surface, [box(CELL_SIZE, thickness + SEAM, CELL_SIZE, 0, y + thickness / 2 - SEAM / 2, 0)])];
}

function pavedSlab(surface: SurfaceId, thickness: number, joint: SurfaceId): BuildPart[] {
    const slabs: THREE.BufferGeometry[] = [];
    const gap = 0.045;
    const size = CELL_SIZE / 2;

    for (let ix = 0; ix < 2; ix++) {
        for (let iz = 0; iz < 2; iz++) {
            const cx = -HALF + size / 2 + ix * size;
            const cz = -HALF + size / 2 + iz * size;
            slabs.push(box(size - gap, thickness, size - gap, cx, thickness / 2 + 0.015, cz));
        }
    }

    return [
        part(joint, [box(CELL_SIZE, 0.06 + SEAM, CELL_SIZE, 0, 0.03 - SEAM / 2, 0)]),
        part(surface, slabs),
    ];
}

function wallBody(height: number, baseY: number): THREE.BufferGeometry {
    return box(CELL_SIZE, height + SEAM, WALL_THICKNESS, 0, baseY + height / 2 - SEAM / 2, -HALF + WALL_THICKNESS / 2);
}

function wallTrim(surface: SurfaceId, height: number): BuildPart {
    const z = -HALF + WALL_THICKNESS / 2;
    return part(surface, [
        box(CELL_SIZE, 0.12, WALL_THICKNESS + 0.05, 0, 0.06, z),
        box(CELL_SIZE, 0.07, WALL_THICKNESS + 0.04, 0, height - 0.05, z),
    ]);
}

function wallWithHole(surface: SurfaceId, holeWidth: number, holeBottom: number, holeTop: number): BuildPart[] {
    const sideWidth = (CELL_SIZE - holeWidth) / 2;
    const z = -HALF + WALL_THICKNESS / 2;
    const pieces: THREE.BufferGeometry[] = [
        box(sideWidth, LEVEL_HEIGHT + SEAM, WALL_THICKNESS, -(CELL_SIZE - sideWidth) / 2, LEVEL_HEIGHT / 2 - SEAM / 2, z),
        box(sideWidth, LEVEL_HEIGHT + SEAM, WALL_THICKNESS, (CELL_SIZE - sideWidth) / 2, LEVEL_HEIGHT / 2 - SEAM / 2, z),
    ];
    if (holeBottom > 0.001) {
        pieces.push(box(holeWidth, holeBottom, WALL_THICKNESS, 0, holeBottom / 2, z));
    }
    if (holeTop < LEVEL_HEIGHT - 0.001) {
        pieces.push(box(holeWidth, LEVEL_HEIGHT - holeTop, WALL_THICKNESS, 0, (LEVEL_HEIGHT + holeTop) / 2, z));
    }
    return [part(surface, pieces)];
}

function frame(width: number, bottom: number, top: number, thickness: number): THREE.BufferGeometry[] {
    const z = -HALF + WALL_THICKNESS / 2;
    const height = top - bottom;
    return [
        box(thickness, height, WALL_THICKNESS * 1.15, -width / 2 + thickness / 2, bottom + height / 2, z),
        box(thickness, height, WALL_THICKNESS * 1.15, width / 2 - thickness / 2, bottom + height / 2, z),
        box(width, thickness, WALL_THICKNESS * 1.15, 0, top - thickness / 2, z),
        box(width, thickness, WALL_THICKNESS * 1.15, 0, bottom + thickness / 2, z),
    ];
}

function profile(points: Array<[number, number]>): THREE.Shape {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
    shape.closePath();
    return shape;
}

function prismAlongX(points: Array<[number, number]>, width: number): THREE.BufferGeometry {
    const geometry = new THREE.ExtrudeGeometry(profile(points), { depth: width, bevelEnabled: false });
    geometry.translate(0, 0, -width / 2);
    geometry.rotateY(-Math.PI / 2);
    geometry.translate(0, -SEAM, 0);
    return geometry;
}

function plateOnEdge(points: Array<[number, number]>, thickness: number): THREE.BufferGeometry {
    const geometry = new THREE.ExtrudeGeometry(profile(points), { depth: thickness, bevelEnabled: false });
    geometry.translate(0, 0, -HALF);
    return geometry;
}

function sidePanel(points: Array<[number, number]>, thickness: number, x: number): THREE.BufferGeometry {
    const geometry = new THREE.ExtrudeGeometry(profile(points), { depth: thickness, bevelEnabled: false });
    geometry.rotateY(Math.PI / 2);
    geometry.translate(x - thickness / 2, 0, 0);
    return geometry;
}

function roofSlopeParts(surface: SurfaceId): BuildPart[] {
    const deck = prismAlongX([[-HALF, 0], [HALF, 0], [-HALF, LEVEL_HEIGHT]], CELL_SIZE);
    const slope = Math.atan2(LEVEL_HEIGHT, CELL_SIZE);
    const courses: THREE.BufferGeometry[] = [];

    for (let i = 0; i < 5; i++) {
        const t = (i + 0.5) / 5;
        const z = HALF - t * CELL_SIZE;
        const y = t * LEVEL_HEIGHT;
        courses.push(tiltedBox(CELL_SIZE, 0.05, CELL_SIZE / 5, 0, y + 0.03, z, slope, 0, 0));
    }

    const eave = box(CELL_SIZE, 0.14, 0.36, 0, 0.07, HALF - 0.12);
    return [part(surface, [deck, eave, ...courses])];
}

function roofRidgeParts(surface: SurfaceId): BuildPart[] {
    const body = prismAlongX([[-HALF, 0], [HALF, 0], [0, LEVEL_HEIGHT / 2]], CELL_SIZE);
    const cap = box(0.28, 0.1, CELL_SIZE, 0, LEVEL_HEIGHT / 2 - 0.02, 0);
    return [part(surface, [body, cap])];
}

function roofGableParts(surface: SurfaceId): BuildPart[] {
    return [part(surface, [plateOnEdge([[-HALF, 0], [HALF, 0], [HALF, LEVEL_HEIGHT]], WALL_THICKNESS)])];
}

export function stairSurfaceHeight(localZ: number, rise: number): number {
    const travel = (HALF - localZ) / STAIR_FLIGHT + 0.5 / STAIR_STEPS;
    return rise * THREE.MathUtils.clamp(travel, 0, 1);
}

function stairParts(tread: SurfaceId, rail: SurfaceId): BuildPart[] {
    const rise = LEVEL_HEIGHT / STAIR_STEPS;
    const run = STAIR_FLIGHT / STAIR_STEPS;
    const width = CELL_SIZE * 0.9;
    const landingZ = -HALF + STAIR_LANDING / 2;
    const body: THREE.BufferGeometry[] = [];

    for (let i = 0; i < STAIR_STEPS; i++) {
        const top = (i + 1) * rise;
        const z = HALF - run / 2 - i * run;

        body.push(box(width, 0.06, run + 0.05, 0, top - 0.03, z));
        body.push(box(width * 0.99, rise, run * 0.36, 0, top - rise / 2, z - run * 0.32));
        body.push(box(width * 0.99, Math.max(0.04, top - rise), run * 0.92, 0, (top - rise) / 2, z - run * 0.04));
    }

    body.push(box(width, 0.06, STAIR_LANDING + 0.05, 0, LEVEL_HEIGHT - 0.03, landingZ));
    body.push(box(width * 0.99, LEVEL_HEIGHT - 0.06, STAIR_LANDING, 0, (LEVEL_HEIGHT - 0.06) / 2, landingZ));

    const stringers: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
        stringers.push(sidePanel(
            [[-HALF, 0], [HALF, 0], [HALF, LEVEL_HEIGHT], [HALF - STAIR_LANDING - 0.12, LEVEL_HEIGHT]],
            0.09,
            side * (width / 2 + 0.045)
        ));
    }

    const railLength = Math.sqrt(STAIR_FLIGHT * STAIR_FLIGHT + LEVEL_HEIGHT * LEVEL_HEIGHT);
    const railAngle = Math.atan2(LEVEL_HEIGHT, STAIR_FLIGHT);
    const rails: THREE.BufferGeometry[] = [];

    for (const side of [-1, 1]) {
        const x = side * (width / 2 + 0.05);
        rails.push(tiltedBox(0.07, 0.07, railLength, x, 0.95 + LEVEL_HEIGHT / 2, STAIR_LANDING / 2, railAngle, 0, 0));
        rails.push(box(0.07, 0.07, STAIR_LANDING + 0.06, x, LEVEL_HEIGHT + 0.95, landingZ));

        for (let i = 0; i < STAIR_STEPS; i += 2) {
            const z = HALF - run / 2 - i * run;
            const base = stairSurfaceHeight(z, LEVEL_HEIGHT);
            rails.push(box(0.05, 0.98, 0.05, x, base + 0.49, z));
        }
        rails.push(box(0.05, 0.98, 0.05, x, LEVEL_HEIGHT + 0.49, landingZ));
    }

    return [part(tread, [...body, ...stringers]), part(rail, rails)];
}

export const DOOR_LEAF = {
    width: 1.34,
    height: 2.15,
    thickness: 0.07,
    hingeX: -0.68,
    z: -HALF + WALL_THICKNESS / 2,
    surface: "plank" as SurfaceId,
    openAngle: Math.PI * 0.52,
};

let doorLeafGeometry: THREE.BufferGeometry | null = null;

export function getDoorLeafGeometry(): THREE.BufferGeometry {
    if (!doorLeafGeometry) {
        const leaf = box(DOOR_LEAF.width, DOOR_LEAF.height, DOOR_LEAF.thickness, DOOR_LEAF.width / 2, DOOR_LEAF.height / 2, 0);
        const upper = box(DOOR_LEAF.width * 0.6, DOOR_LEAF.height * 0.32, 0.02, DOOR_LEAF.width / 2, DOOR_LEAF.height * 0.68, DOOR_LEAF.thickness / 2);
        const lower = box(DOOR_LEAF.width * 0.6, DOOR_LEAF.height * 0.26, 0.02, DOOR_LEAF.width / 2, DOOR_LEAF.height * 0.26, DOOR_LEAF.thickness / 2);
        doorLeafGeometry = applyLocalUv(merge([leaf, upper, lower]), DOOR_LEAF.surface);
    }
    return doorLeafGeometry;
}

function chairParts(): BuildPart[] {
    const wood: THREE.BufferGeometry[] = [
        box(0.84, 0.07, 0.84, 0, 0.5, 0),
        box(0.84, 0.1, 0.08, 0, 1.28, -0.38),
        box(0.84, 0.1, 0.08, 0, 1.02, -0.38),
        box(0.09, 0.86, 0.09, -0.38, 0.93, -0.38),
        box(0.09, 0.86, 0.09, 0.38, 0.93, -0.38),
    ];
    for (const dx of [-0.35, 0.35]) {
        for (const dz of [-0.35, 0.35]) {
            wood.push(cylinder(0.05, 0.06, 0.5, 6, dx, 0.25, dz));
        }
    }
    return [part("plank", wood), part("fabric", [box(0.8, 0.09, 0.8, 0, 0.58, 0)])];
}

function tableParts(): BuildPart[] {
    const wood: THREE.BufferGeometry[] = [
        box(1.72, 0.09, 1.72, 0, 0.8, 0),
        box(1.56, 0.07, 1.56, 0, 0.72, 0),
        box(1.5, 0.06, 0.1, 0, 0.66, -0.7),
        box(1.5, 0.06, 0.1, 0, 0.66, 0.7),
    ];
    for (const dx of [-0.68, 0.68]) {
        for (const dz of [-0.68, 0.68]) {
            wood.push(cylinder(0.06, 0.09, 0.72, 8, dx, 0.36, dz));
        }
    }
    return [part("plank", wood)];
}

function bedParts(): BuildPart[] {
    const wood: THREE.BufferGeometry[] = [
        box(1.7, 0.2, 1.9, 0, 0.3, 0),
        box(1.72, 0.92, 0.11, 0, 0.78, -0.96),
        box(1.72, 0.44, 0.11, 0, 0.54, 0.96),
    ];
    for (const dx of [-0.76, 0.76]) {
        for (const dz of [-0.86, 0.86]) {
            wood.push(box(0.13, 0.2, 0.13, dx, 0.1, dz));
        }
    }
    return [
        part("plank", wood),
        part("fabric", [
            box(1.62, 0.26, 1.76, 0, 0.53, 0),
            shapedBlob(0.5, 1, 1, 0.28, 0.52, 0, 0.72, -0.62),
            box(1.6, 0.06, 1.0, 0, 0.67, 0.36),
        ]),
    ];
}

function sofaParts(): BuildPart[] {
    return [
        part("plank", [
            box(1.9, 0.16, 0.95, 0, 0.14, 0),
            box(0.1, 0.16, 0.1, -0.85, 0.05, 0.4),
            box(0.1, 0.16, 0.1, 0.85, 0.05, 0.4),
        ]),
        part("fabric", [
            box(1.86, 0.28, 0.9, 0, 0.38, 0.02),
            box(0.88, 0.14, 0.84, -0.46, 0.55, 0.04),
            box(0.88, 0.14, 0.84, 0.46, 0.55, 0.04),
            box(1.86, 0.78, 0.22, 0, 0.75, -0.36),
            shapedBlob(0.36, 1, 0.55, 0.62, 1.1, -0.78, 0.6, 0),
            shapedBlob(0.36, 1, 0.55, 0.62, 1.1, 0.78, 0.6, 0),
        ]),
    ];
}

function shelfParts(): BuildPart[] {
    const wood: THREE.BufferGeometry[] = [
        box(1.6, 0.08, 0.4, 0, 0.05, 0),
        box(0.08, 2.0, 0.4, -0.76, 1.0, 0),
        box(0.08, 2.0, 0.4, 0.76, 1.0, 0),
        box(1.6, 2.0, 0.04, 0, 1.0, -0.2),
        box(1.6, 0.09, 0.44, 0, 2.02, 0),
    ];
    for (let i = 1; i <= 3; i++) {
        wood.push(box(1.52, 0.06, 0.4, 0, i * 0.5, 0));
    }

    const books: THREE.BufferGeometry[] = [];
    for (let shelf = 0; shelf < 3; shelf++) {
        const y = shelf * 0.5 + 0.03;
        for (let i = 0; i < 7; i++) {
            const height = 0.26 + ((i * 7 + shelf * 3) % 4) * 0.04;
            books.push(box(0.08, height, 0.26, -0.6 + i * 0.14, y + height / 2, 0.02));
        }
    }

    return [part("plank", wood), part("fabric", books)];
}

function plantParts(): BuildPart[] {
    const leaves: THREE.BufferGeometry[] = [];

    for (let i = 0; i < 9; i++) {
        const angle = (i / 9) * Math.PI * 2;
        const spread = 0.3 + (i % 3) * 0.08;
        leaves.push(shapedBlob(
            0.2, 0,
            1.5, 0.32, 0.62,
            Math.cos(angle) * spread, 1.0 + (i % 3) * 0.17, Math.sin(angle) * spread,
            -angle
        ));
    }
    leaves.push(shapedBlob(0.24, 0, 1, 0.6, 1, 0, 1.4, 0));

    return [
        part("clay", [cylinder(0.32, 0.22, 0.5, 12, 0, 0.25, 0), ring(0.33, 0.035, 12, 0, 0.48, 0)]),
        part("soil", [plate(0.29, 0.06, 12, 0, 0.49, 0)]),
        part("plank", [cylinder(0.045, 0.055, 0.6, 6, 0, 0.78, 0)]),
        part("leaf", leaves),
    ];
}

function spawnBeaconParts(): BuildPart[] {
    const stone: THREE.BufferGeometry[] = [
        box(1.0, 0.16, 1.0, 0, 0.08, 0),
        box(0.78, 0.12, 0.78, 0, 0.22, 0),
    ];

    const metal: THREE.BufferGeometry[] = [
        cylinder(0.15, 0.22, 1.5, 8, 0, 1.03, 0),
        ring(0.27, 0.035, 12, 0, 0.62, 0),
        ring(0.21, 0.03, 12, 0, 1.72, 0),
    ];
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        metal.push(box(0.08, 0.86, 0.08, Math.cos(angle) * 0.33, 0.63, Math.sin(angle) * 0.33));
    }

    const glow: THREE.BufferGeometry[] = [
        blob(0.29, 1, 0, 2.05, 0),
        ring(0.44, 0.045, 14, 0, 0.33, 0),
        hoop(0.4, 0.035, 16, 0, 2.05, 0),
    ];

    return [part("stone", stone), part("metal", metal), part("glow", glow)];
}

function storageCrateParts(): BuildPart[] {
    const wood: THREE.BufferGeometry[] = [
        box(1.24, 0.84, 0.94, 0, 0.42, 0),
        box(1.32, 0.14, 1.02, 0, 0.91, 0),
    ];
    for (const dx of [-0.56, 0.56]) {
        for (const dz of [-0.41, 0.41]) {
            wood.push(box(0.12, 0.88, 0.12, dx, 0.44, dz));
        }
    }

    const metal: THREE.BufferGeometry[] = [
        box(1.28, 0.08, 0.98, 0, 0.26, 0),
        box(1.28, 0.08, 0.98, 0, 0.64, 0),
        box(0.22, 0.2, 0.09, 0, 0.84, 0.5),
        box(0.14, 0.16, 0.07, 0, 0.5, 0.5),
    ];

    const glow: THREE.BufferGeometry[] = [
        box(0.36, 0.045, 0.045, 0, 0.98, 0.28),
        box(0.045, 0.34, 0.045, 0, 0.98, 0.28),
        box(0.36, 0.045, 0.045, 0, 0.98, -0.28),
    ];

    return [part("plank", wood), part("metal", metal), part("glow", glow)];
}

function posterParts(width: number, height: number, y: number): BuildPart[] {
    const z = -HALF + WALL_THICKNESS + 0.03;
    return [
        part("plank", [
            box(width + 0.14, 0.07, 0.06, 0, y + height / 2 + 0.035, z),
            box(width + 0.14, 0.07, 0.06, 0, y - height / 2 - 0.035, z),
            box(0.07, height + 0.14, 0.06, -width / 2 - 0.035, y, z),
            box(0.07, height + 0.14, 0.06, width / 2 + 0.035, y, z),
        ]),
        part("canvas", [box(width, height, 0.035, 0, y, z)]),
    ];
}

function billboardParts(): BuildPart[] {
    return [
        part("metal", [
            cylinder(0.09, 0.11, 1.1, 8, -0.7, 0.55, 0),
            cylinder(0.09, 0.11, 1.1, 8, 0.7, 0.55, 0),
            box(0.06, 0.06, 0.5, -0.7, 1.24, 0.2),
            box(0.06, 0.06, 0.5, 0.7, 1.24, 0.2),
        ]),
        part("plank", [
            box(1.86, 0.1, 0.12, 0, 2.38, 0),
            box(1.86, 0.1, 0.12, 0, 1.02, 0),
            box(0.1, 1.44, 0.12, -0.88, 1.7, 0),
            box(0.1, 1.44, 0.12, 0.88, 1.7, 0),
        ]),
        part("canvas", [box(1.7, 1.26, 0.06, 0, 1.7, 0)]),
    ];
}

function fenceParts(surface: SurfaceId): BuildPart[] {
    const z = -HALF + WALL_THICKNESS / 2;
    const pieces: THREE.BufferGeometry[] = [
        box(CELL_SIZE, 0.07, 0.06, 0, 1.0, z),
        box(CELL_SIZE, 0.07, 0.06, 0, 0.58, z),
    ];
    for (let i = 0; i < 7; i++) {
        const x = -HALF + 0.16 + i * 0.28;
        pieces.push(box(0.08, 1.16, 0.05, x, 0.6, z));
        pieces.push(cone(0.06, 0.1, 4, x, 1.23, z));
    }
    pieces.push(box(0.14, 1.32, 0.14, -HALF + 0.07, 0.66, z));
    pieces.push(box(0.14, 1.32, 0.14, HALF - 0.07, 0.66, z));
    return [part(surface, pieces)];
}

function railingParts(): BuildPart[] {
    const z = -HALF + WALL_THICKNESS / 2;
    const pieces: THREE.BufferGeometry[] = [
        box(CELL_SIZE, 0.06, 0.08, 0, 1.06, z),
        box(CELL_SIZE, 0.05, 0.05, 0, 0.12, z),
    ];
    for (let i = 0; i < 9; i++) {
        pieces.push(cylinder(0.025, 0.025, 0.94, 6, -HALF + 0.12 + i * 0.22, 0.6, z));
    }
    pieces.push(box(0.1, 1.12, 0.1, -HALF + 0.05, 0.56, z));
    pieces.push(box(0.1, 1.12, 0.1, HALF - 0.05, 0.56, z));
    return [part("metal", pieces)];
}

function hedgeParts(): BuildPart[] {
    const z = -HALF + WALL_THICKNESS / 2;
    const bushes: THREE.BufferGeometry[] = [box(CELL_SIZE, 0.98, 0.58, 0, 0.49, z)];
    for (let i = 0; i < 7; i++) {
        bushes.push(shapedBlob(
            0.24, 0, 1.2, 0.8, 1.1,
            -HALF + 0.14 + i * 0.29, 0.98, z + (i % 2 === 0 ? 0.07 : -0.07)
        ));
    }
    return [part("hedge", bushes)];
}

function pillarParts(): BuildPart[] {
    const flutes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        flutes.push(cylinder(0.045, 0.05, LEVEL_HEIGHT - 0.5, 4, Math.cos(angle) * 0.26, LEVEL_HEIGHT / 2, Math.sin(angle) * 0.26));
    }
    return [
        part("marble", [cylinder(0.24, 0.28, LEVEL_HEIGHT - 0.34, 14, 0, LEVEL_HEIGHT / 2, 0), ...flutes]),
        part("stone", [
            box(0.82, 0.16, 0.82, 0, 0.08, 0),
            box(0.7, 0.1, 0.7, 0, 0.21, 0),
            box(0.7, 0.1, 0.7, 0, LEVEL_HEIGHT - 0.21, 0),
            box(0.82, 0.16, 0.82, 0, LEVEL_HEIGHT - 0.08, 0),
        ]),
    ];
}

function asphaltBase(): THREE.BufferGeometry[] {
    return [
        box(CELL_SIZE, 0.1 + SEAM, CELL_SIZE, 0, 0.05 - SEAM / 2, 0),
        box(CELL_SIZE, 0.02, 0.06, 0, 0.1, -HALF + 0.04),
        box(CELL_SIZE, 0.02, 0.06, 0, 0.1, HALF - 0.04),
    ];
}

function roadParts(marking: "none" | "dashed" | "double"): BuildPart[] {
    const parts: BuildPart[] = [part("asphalt", asphaltBase())];
    const lines: THREE.BufferGeometry[] = [];

    if (marking === "dashed") {
        for (const dz of [-0.56, 0.56]) {
            lines.push(box(0.13, 0.022, 0.72, 0, 0.107, dz));
        }
    } else if (marking === "double") {
        lines.push(box(0.1, 0.022, CELL_SIZE, -0.09, 0.107, 0));
        lines.push(box(0.1, 0.022, CELL_SIZE, 0.09, 0.107, 0));
    }

    if (lines.length > 0) parts.push(part("roadline", lines));
    return parts;
}

function roadEdgeParts(): BuildPart[] {
    return [
        part("asphalt", asphaltBase()),
        part("roadline", [box(0.11, 0.022, CELL_SIZE, -HALF + 0.24, 0.107, 0)]),
    ];
}

function crossingParts(): BuildPart[] {
    const stripes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
        stripes.push(box(0.24, 0.022, CELL_SIZE * 0.88, -0.8 + i * 0.4, 0.107, 0));
    }
    return [part("asphalt", asphaltBase()), part("roadline", stripes)];
}

function manholeParts(): BuildPart[] {
    return [
        part("asphalt", asphaltBase()),
        part("metal", [
            plate(0.36, 0.04, 16, 0, 0.11, 0),
            ring(0.28, 0.02, 16, 0, 0.13, 0),
        ]),
    ];
}

function curbParts(): BuildPart[] {
    const z = -HALF + 0.13;
    const blocks: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
        blocks.push(box(CELL_SIZE / 3 - 0.03, 0.26, 0.26, -CELL_SIZE / 3 + i * (CELL_SIZE / 3), 0.13, z));
    }
    return [part("concrete", [...blocks, box(CELL_SIZE, 0.07, 0.32, 0, 0.035, z + 0.27)])];
}

function steppingStonesParts(): BuildPart[] {
    const stones: THREE.BufferGeometry[] = [];
    const spots: Array<[number, number, number]> = [
        [-0.62, -0.58, 0.36], [0.1, -0.44, 0.4], [0.6, 0.02, 0.34],
        [-0.2, 0.24, 0.42], [-0.66, 0.62, 0.3], [0.44, 0.68, 0.32],
    ];

    for (const [x, z, radius] of spots) {
        const stone = new THREE.CylinderGeometry(radius, radius * 0.92, 0.12, 7);
        stone.rotateY(x * 3.1 + z);
        stone.translate(x, 0.06, z);
        stones.push(stone);
    }

    return [part("grass", [box(CELL_SIZE, 0.06 + SEAM, CELL_SIZE, 0, 0.03 - SEAM / 2, 0)]), part("stone", stones)];
}

function gravelPathParts(): BuildPart[] {
    return [
        part("gravel", [box(CELL_SIZE, 0.08 + SEAM, CELL_SIZE, 0, 0.04 - SEAM / 2, 0)]),
        part("stone", [
            box(CELL_SIZE, 0.12, 0.1, 0, 0.06, -HALF + 0.05),
            box(CELL_SIZE, 0.12, 0.1, 0, 0.06, HALF - 0.05),
        ]),
    ];
}

function boardwalkParts(): BuildPart[] {
    const planks: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
        planks.push(box(CELL_SIZE, 0.07, CELL_SIZE / 6 - 0.035, 0, 0.05, -HALF + CELL_SIZE / 12 + i * (CELL_SIZE / 6)));
    }
    return [
        part("plank", planks),
        part("plank", [box(CELL_SIZE, 0.06, 0.12, 0, 0.01, -HALF + 0.2), box(CELL_SIZE, 0.06, 0.12, 0, 0.01, HALF - 0.2)]),
    ];
}

function benchParts(): BuildPart[] {
    const wood: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
        wood.push(box(1.7, 0.06, 0.13, 0, 0.46, -0.24 + i * 0.16));
    }
    for (let i = 0; i < 3; i++) {
        wood.push(tiltedBox(1.7, 0.06, 0.13, 0, 0.68 + i * 0.17, -0.36 - i * 0.05, -0.28, 0, 0));
    }

    const metal: THREE.BufferGeometry[] = [];
    for (const dx of [-0.72, 0.72]) {
        metal.push(box(0.07, 0.44, 0.08, dx, 0.22, -0.2));
        metal.push(box(0.07, 0.44, 0.08, dx, 0.22, 0.22));
        metal.push(box(0.07, 0.1, 0.62, dx, 0.44, 0));
        metal.push(tiltedBox(0.07, 0.62, 0.08, dx, 0.74, -0.4, -0.28, 0, 0));
    }

    return [part("plank", wood), part("metal", metal)];
}

function trashBinParts(): BuildPart[] {
    const ribs: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
        ribs.push(ring(0.28, 0.02, 12, 0, 0.24 + i * 0.24, 0));
    }
    return [
        part("metal", [
            cylinder(0.28, 0.24, 0.82, 12, 0, 0.41, 0),
            ...ribs,
            plate(0.31, 0.06, 12, 0, 0.85, 0),
            cylinder(0.05, 0.05, 0.16, 6, 0, 0.94, 0),
        ]),
    ];
}

function bollardParts(): BuildPart[] {
    return [
        part("metal", [
            cylinder(0.11, 0.14, 0.92, 10, 0, 0.46, 0),
            plate(0.17, 0.06, 10, 0, 0.03, 0),
            blob(0.12, 1, 0, 0.94, 0),
        ]),
        part("roadline", [ring(0.115, 0.02, 10, 0, 0.78, 0)]),
    ];
}

function hydrantParts(): BuildPart[] {
    return [
        part("clay", [
            cylinder(0.14, 0.17, 0.62, 10, 0, 0.31, 0),
            plate(0.22, 0.07, 10, 0, 0.035, 0),
            blob(0.15, 1, 0, 0.64, 0),
            cylinder(0.05, 0.05, 0.14, 6, 0, 0.74, 0),
            bar(0.07, 0.36, 8, 0, 0.42, 0, 0, Math.PI / 2),
        ]),
    ];
}

function streetSignParts(): BuildPart[] {
    return [
        part("metal", [cylinder(0.045, 0.055, 2.3, 8, 0, 1.15, 0), plate(0.14, 0.05, 8, 0, 0.025, 0)]),
        part("roadline", [box(0.9, 0.24, 0.04, 0.4, 2.16, 0), box(0.72, 0.2, 0.04, -0.32, 1.84, 0)]),
    ];
}

function planterParts(): BuildPart[] {
    const flowers: THREE.BufferGeometry[] = [];
    const petals: THREE.BufferGeometry[] = [];

    for (let i = 0; i < 5; i++) {
        const x = -0.6 + i * 0.3;
        const z = (i % 2) * 0.16 - 0.08;
        flowers.push(shapedBlob(0.19, 0, 1.2, 0.8, 1.1, x, 0.68, z));
        petals.push(blob(0.09, 0, x + 0.06, 0.82, z + 0.05));
    }

    return [
        part("concrete", [
            box(1.7, 0.62, 0.7, 0, 0.31, 0),
            box(1.78, 0.1, 0.78, 0, 0.63, 0),
            box(1.78, 0.1, 0.78, 0, 0.05, 0),
        ]),
        part("soil", [box(1.56, 0.1, 0.56, 0, 0.62, 0)]),
        part("hedge", flowers),
        part("petalRose", petals),
    ];
}

function flowerHead(
    petal: THREE.BufferGeometry[], core: THREE.BufferGeometry[],
    x: number, y: number, z: number, size: number, count: number, spin: number
) {
    for (let i = 0; i < count; i++) {
        const angle = spin + (i / count) * Math.PI * 2;
        const geometry = new THREE.ConeGeometry(size * 0.42, size * 1.15, 4);
        geometry.scale(1, 1, 0.45);
        geometry.rotateX(Math.PI * 0.42);
        geometry.rotateY(angle);
        geometry.translate(
            x + Math.cos(angle) * size * 0.5,
            y + size * 0.12,
            z + Math.sin(angle) * size * 0.5
        );
        petal.push(geometry);
    }
    core.push(blob(size * 0.32, 0, x, y + size * 0.16, z));
}

function flowerBedParts(petal: SurfaceId): BuildPart[] {
    const stems: THREE.BufferGeometry[] = [];
    const petals: THREE.BufferGeometry[] = [];
    const cores: THREE.BufferGeometry[] = [];

    for (let i = 0; i < 11; i++) {
        const angle = (i / 11) * Math.PI * 2 * 2.4;
        const radius = 0.2 + (i % 4) * 0.17;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const height = 0.3 + (i % 3) * 0.1;

        stems.push(cylinder(0.018, 0.026, height, 4, x, 0.2 + height / 2, z));
        stems.push(shapedBlob(0.09, 0, 1.6, 0.3, 0.8, x + 0.08, 0.24 + height * 0.4, z, angle));
        flowerHead(petals, cores, x, 0.2 + height, z, 0.13, 5, angle);
    }

    return [
        part("soil", [box(CELL_SIZE * 0.92, 0.2 + SEAM, CELL_SIZE * 0.92, 0, 0.1 - SEAM / 2, 0)]),
        part("plank", [
            box(CELL_SIZE, 0.3, 0.1, 0, 0.15, -HALF + 0.05),
            box(CELL_SIZE, 0.3, 0.1, 0, 0.15, HALF - 0.05),
            box(0.1, 0.3, CELL_SIZE, -HALF + 0.05, 0.15, 0),
            box(0.1, 0.3, CELL_SIZE, HALF - 0.05, 0.15, 0),
            box(0.16, 0.36, 0.16, -HALF + 0.08, 0.18, -HALF + 0.08),
            box(0.16, 0.36, 0.16, HALF - 0.08, 0.18, -HALF + 0.08),
            box(0.16, 0.36, 0.16, -HALF + 0.08, 0.18, HALF - 0.08),
            box(0.16, 0.36, 0.16, HALF - 0.08, 0.18, HALF - 0.08),
        ]),
        part("leaf", stems),
        part(petal, petals),
        part("petalGold", cores),
    ];
}

function flowerClusterParts(petal: SurfaceId): BuildPart[] {
    const stems: THREE.BufferGeometry[] = [];
    const petals: THREE.BufferGeometry[] = [];
    const cores: THREE.BufferGeometry[] = [];

    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const radius = 0.09 + (i % 3) * 0.11;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const height = 0.34 + (i % 3) * 0.13;

        stems.push(cylinder(0.018, 0.026, height, 4, x, height / 2, z));
        stems.push(shapedBlob(0.13, 0, 1.7, 0.28, 0.9, x * 1.9, 0.07, z * 1.9, angle));
        flowerHead(petals, cores, x, height, z, 0.15, 6, angle);
    }

    return [part("leaf", stems), part(petal, petals), part("petalGold", cores)];
}

function sunflowerParts(): BuildPart[] {
    const stems: THREE.BufferGeometry[] = [];
    const petals: THREE.BufferGeometry[] = [];
    const cores: THREE.BufferGeometry[] = [];

    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const x = Math.cos(angle) * 0.2;
        const z = Math.sin(angle) * 0.2;
        const height = 1.5 + (i % 2) * 0.35;

        stems.push(cylinder(0.035, 0.05, height, 5, x, height / 2, z));
        stems.push(shapedBlob(0.22, 0, 1.4, 0.22, 0.9, x + 0.16, height * 0.55, z, angle));
        stems.push(shapedBlob(0.2, 0, 1.4, 0.22, 0.9, x - 0.14, height * 0.35, z, angle + 1.2));
        flowerHead(petals, cores, x, height, z, 0.3, 10, angle);
    }

    return [part("leaf", stems), part("petalGold", petals), part("bark", cores)];
}

function bushParts(): BuildPart[] {
    return [part("hedge", [
        shapedBlob(0.44, 1, 1, 0.85, 1, 0, 0.4, 0),
        shapedBlob(0.3, 0, 1.1, 0.8, 1, -0.34, 0.26, 0.16),
        shapedBlob(0.28, 0, 1, 0.85, 1.1, 0.3, 0.28, -0.18),
        shapedBlob(0.24, 0, 1, 0.9, 1, 0.06, 0.64, 0.2),
        shapedBlob(0.2, 0, 1, 0.9, 1, -0.2, 0.6, -0.2),
    ])];
}

function topiaryParts(): BuildPart[] {
    return [
        part("clay", [cylinder(0.34, 0.26, 0.44, 12, 0, 0.22, 0), ring(0.35, 0.035, 12, 0, 0.42, 0)]),
        part("bark", [cylinder(0.06, 0.07, 0.7, 6, 0, 0.72, 0)]),
        part("hedge", [
            blob(0.36, 1, 0, 1.0, 0),
            blob(0.28, 1, 0, 1.5, 0),
            blob(0.2, 1, 0, 1.86, 0),
        ]),
    ];
}

function treeTrunk(height: number, bottom: number, top: number, lean: number): THREE.BufferGeometry[] {
    const segments = 4;
    const pieces: THREE.BufferGeometry[] = [];
    let x = 0;
    let z = 0;

    for (let i = 0; i < segments; i++) {
        const t0 = i / segments;
        const t1 = (i + 1) / segments;
        const r0 = THREE.MathUtils.lerp(bottom, top, t0);
        const r1 = THREE.MathUtils.lerp(bottom, top, t1);
        const dx = Math.sin(i * 1.7) * lean;
        const dz = Math.cos(i * 2.3) * lean;

        pieces.push(cylinder(r1, r0, height / segments + 0.03, 7, x + dx / 2, height * (t0 + t1) / 2, z + dz / 2));
        x += dx;
        z += dz;
    }

    return pieces;
}

function oakParts(): BuildPart[] {
    const trunk = treeTrunk(2.3, 0.28, 0.15, 0.06);
    trunk.push(tiltedBox(0.11, 0.95, 0.11, 0.3, 2.35, 0.12, 0, 0.4, -0.55));
    trunk.push(tiltedBox(0.1, 0.85, 0.1, -0.28, 2.28, -0.14, 0, -0.6, 0.5));
    trunk.push(tiltedBox(0.09, 0.7, 0.09, 0.05, 2.5, -0.3, 0.5, 0, 0.1));

    const canopy: THREE.BufferGeometry[] = [
        shapedBlob(0.95, 1, 1.1, 0.85, 1.1, 0, 3.15, 0),
        shapedBlob(0.66, 1, 1, 0.9, 1, 0.72, 2.78, 0.26),
        shapedBlob(0.62, 1, 1, 0.9, 1, -0.66, 2.86, -0.32),
        shapedBlob(0.56, 1, 1, 0.95, 1, 0.16, 3.78, -0.36),
        shapedBlob(0.48, 0, 1, 0.9, 1, -0.4, 3.6, 0.44),
    ];

    return [part("bark", trunk), part("leaf", canopy)];
}

function mapleParts(): BuildPart[] {
    const trunk = treeTrunk(2.1, 0.24, 0.13, 0.05);
    trunk.push(tiltedBox(0.09, 0.8, 0.09, 0.24, 2.2, 0.1, 0, 0.5, -0.5));
    trunk.push(tiltedBox(0.09, 0.8, 0.09, -0.22, 2.2, -0.12, 0, -0.5, 0.5));

    const canopy: THREE.BufferGeometry[] = [
        shapedBlob(0.86, 1, 1.15, 0.8, 1.15, 0, 2.95, 0),
        shapedBlob(0.6, 1, 1, 0.85, 1, 0.62, 2.6, -0.3),
        shapedBlob(0.56, 1, 1, 0.85, 1, -0.6, 2.68, 0.28),
        shapedBlob(0.48, 0, 1, 0.9, 1, 0.1, 3.5, 0.2),
    ];

    return [part("bark", trunk), part("leafAutumn", canopy)];
}

function pineParts(): BuildPart[] {
    const trunk = treeTrunk(2.0, 0.2, 0.1, 0.02);
    const canopy: THREE.BufferGeometry[] = [];

    for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const radius = THREE.MathUtils.lerp(1.05, 0.34, t);
        const height = THREE.MathUtils.lerp(1.5, 1.0, t);
        canopy.push(cone(radius, height, 9, 0, 1.5 + i * 0.65, 0));
    }

    return [part("bark", trunk), part("leafPine", canopy)];
}

function birchParts(): BuildPart[] {
    const trunk = treeTrunk(3.0, 0.16, 0.09, 0.04);
    trunk.push(tiltedBox(0.07, 0.75, 0.07, 0.2, 2.9, 0.06, 0, 0.4, -0.5));

    const marks: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
        marks.push(box(0.13, 0.05, 0.05, Math.sin(i * 2.1) * 0.06, 0.4 + i * 0.42, -0.11 + Math.cos(i * 1.7) * 0.04));
    }

    const canopy: THREE.BufferGeometry[] = [
        shapedBlob(0.62, 1, 1.05, 0.9, 1.05, 0, 3.55, 0),
        shapedBlob(0.45, 1, 1, 0.9, 1, 0.44, 3.2, 0.2),
        shapedBlob(0.42, 1, 1, 0.9, 1, -0.4, 3.28, -0.22),
        shapedBlob(0.36, 0, 1, 0.9, 1, 0.06, 4.05, -0.16),
    ];

    return [part("plaster", trunk), part("bark", marks), part("leaf", canopy)];
}

function palmParts(): BuildPart[] {
    const trunk: THREE.BufferGeometry[] = [];
    const segments = 8;
    let x = 0;

    for (let i = 0; i < segments; i++) {
        const t = i / segments;
        const radius = THREE.MathUtils.lerp(0.22, 0.13, t);
        x += t * 0.08;
        trunk.push(cylinder(radius * 0.94, radius, 0.46, 8, x, 0.23 + i * 0.44, 0));
    }

    const fronds: THREE.BufferGeometry[] = [];
    const topY = 0.23 + segments * 0.44;

    for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2;
        const frond = new THREE.ConeGeometry(0.22, 1.7, 4);
        frond.scale(1, 1, 0.25);
        frond.rotateX(Math.PI * 0.5);
        frond.rotateZ(0.35);
        frond.rotateY(angle);
        frond.translate(x + Math.cos(angle) * 0.85, topY + 0.1, Math.sin(angle) * 0.85);
        fronds.push(frond);
    }

    return [
        part("bark", trunk),
        part("leaf", fronds),
        part("clay", [blob(0.14, 0, x + 0.12, topY - 0.05, 0.1), blob(0.12, 0, x - 0.1, topY - 0.08, -0.12)]),
    ];
}

function rockParts(): BuildPart[] {
    return [part("stone", [
        shapedBlob(0.52, 0, 1.1, 0.85, 1, 0, 0.32, 0, 0.6),
        shapedBlob(0.32, 0, 1, 0.8, 1.1, 0.48, 0.2, 0.24, 1.4),
        shapedBlob(0.24, 0, 1.1, 0.75, 1, -0.42, 0.16, -0.28, 2.2),
    ])];
}

function pondParts(): BuildPart[] {
    const bank: THREE.BufferGeometry[] = [box(CELL_SIZE, 0.18 + SEAM, CELL_SIZE, 0, 0.09 - SEAM / 2, 0)];
    for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        bank.push(shapedBlob(
            0.16, 0, 1.2, 0.7, 1,
            Math.cos(angle) * 0.86, 0.16, Math.sin(angle) * 0.86, angle
        ));
    }

    return [
        part("gravel", [box(CELL_SIZE, 0.16, CELL_SIZE, 0, 0.06, 0)]),
        part("stone", bank),
        part("water", [box(CELL_SIZE * 0.88, 0.06, CELL_SIZE * 0.88, 0, 0.15, 0)]),
    ];
}

function fountainParts(): BuildPart[] {
    const basin: THREE.BufferGeometry[] = [
        cylinder(0.92, 0.98, 0.5, 20, 0, 0.25, 0),
        ring(0.9, 0.07, 20, 0, 0.52, 0),
        cylinder(0.26, 0.3, 0.9, 12, 0, 0.62, 0),
        plate(0.44, 0.08, 14, 0, 1.06, 0),
        cylinder(0.1, 0.13, 0.5, 10, 0, 1.32, 0),
        plate(0.26, 0.07, 12, 0, 1.58, 0),
    ];

    const water: THREE.BufferGeometry[] = [
        plate(0.84, 0.16, 20, 0, 0.4, 0),
        plate(0.4, 0.05, 14, 0, 1.12, 0),
        cylinder(0.05, 0.07, 0.36, 6, 0, 1.78, 0),
    ];

    return [part("stone", basin), part("water", water)];
}

function gardenArchParts(): BuildPart[] {
    const wood: THREE.BufferGeometry[] = [];
    const z = -HALF + WALL_THICKNESS / 2;

    for (const side of [-1, 1]) {
        const x = side * (HALF - 0.16);
        wood.push(box(0.12, 2.3, 0.12, x, 1.15, z - 0.16));
        wood.push(box(0.12, 2.3, 0.12, x, 1.15, z + 0.16));
        for (let i = 0; i < 4; i++) {
            wood.push(box(0.07, 0.07, 0.44, x, 0.5 + i * 0.55, z));
        }
    }

    for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const angle = Math.PI * t;
        wood.push(tiltedBox(
            0.4, 0.1, 0.1,
            Math.cos(angle) * (HALF - 0.16), 2.3 + Math.sin(angle) * 0.34, z,
            0, 0, -angle + Math.PI / 2
        ));
    }
    wood.push(box(CELL_SIZE - 0.2, 0.09, 0.09, 0, 2.3, z - 0.2));
    wood.push(box(CELL_SIZE - 0.2, 0.09, 0.09, 0, 2.3, z + 0.2));

    const vines: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI;
        vines.push(shapedBlob(
            0.2, 0, 1.1, 0.7, 1,
            Math.cos(angle) * (HALF - 0.2), 2.36 + Math.sin(angle) * 0.4, z + (i % 2 ? 0.16 : -0.16),
            angle
        ));
    }

    return [part("plank", wood), part("hedge", vines)];
}

function lawnParts(): BuildPart[] {
    const tufts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 14; i++) {
        const angle = i * 2.399;
        const radius = 0.14 + (i % 5) * 0.17;
        tufts.push(shapedBlob(
            0.11, 0, 0.7, 1.5, 0.7,
            Math.cos(angle) * radius, 0.12, Math.sin(angle) * radius, angle
        ));
    }
    return [
        part("grass", [box(CELL_SIZE, 0.08 + SEAM, CELL_SIZE, 0, 0.04 - SEAM / 2, 0)]),
        part("hedge", tufts),
    ];
}

function vegetableBedParts(): BuildPart[] {
    const rows: THREE.BufferGeometry[] = [];
    const crops: THREE.BufferGeometry[] = [];

    for (let r = 0; r < 3; r++) {
        const z = -0.58 + r * 0.58;
        rows.push(box(CELL_SIZE * 0.86, 0.12, 0.34, 0, 0.24, z));
        for (let i = 0; i < 4; i++) {
            const x = -0.66 + i * 0.44;
            crops.push(shapedBlob(0.15, 0, 1.1, 0.9, 1.1, x, 0.36, z, i + r));
        }
    }

    return [
        part("soil", [box(CELL_SIZE * 0.94, 0.18 + SEAM, CELL_SIZE * 0.94, 0, 0.09 - SEAM / 2, 0), ...rows]),
        part("plank", [
            box(CELL_SIZE, 0.26, 0.09, 0, 0.13, -HALF + 0.045),
            box(CELL_SIZE, 0.26, 0.09, 0, 0.13, HALF - 0.045),
            box(0.09, 0.26, CELL_SIZE, -HALF + 0.045, 0.13, 0),
            box(0.09, 0.26, CELL_SIZE, HALF - 0.045, 0.13, 0),
        ]),
        part("hedge", crops),
    ];
}

function streetLampParts(): BuildPart[] {
    const arm: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
        const t = i / 3;
        const angle = (Math.PI / 2) * t;
        arm.push(tiltedBox(
            0.09, 0.09, 0.24,
            0, 3.62 + Math.sin(angle) * 0.16, -0.14 - t * 0.34,
            angle * 0.5, 0, 0
        ));
    }

    return [
        part("concrete", [cylinder(0.24, 0.34, 0.3, 10, 0, 0.15, 0)]),
        part("metal", [
            cylinder(0.09, 0.16, 3.5, 10, 0, 1.9, 0),
            ring(0.17, 0.03, 10, 0, 0.36, 0),
            ...arm,
            box(0.36, 0.12, 0.5, 0, 3.66, -0.56),
        ]),
        part("glow", [box(0.3, 0.08, 0.42, 0, 3.56, -0.56)]),
    ];
}

function classicLampParts(): BuildPart[] {
    const panes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        panes.push(box(0.05, 0.52, 0.05, Math.cos(angle) * 0.19, 3.28, Math.sin(angle) * 0.19));
    }

    return [
        part("stone", [cylinder(0.26, 0.34, 0.36, 10, 0, 0.18, 0)]),
        part("metal", [
            cylinder(0.07, 0.12, 2.7, 10, 0, 1.5, 0),
            ring(0.15, 0.03, 10, 0, 0.42, 0),
            plate(0.28, 0.06, 8, 0, 2.96, 0),
            ...panes,
            cone(0.3, 0.34, 8, 0, 3.72, 0),
            blob(0.06, 0, 0, 3.94, 0),
        ]),
        part("glow", [blob(0.19, 1, 0, 3.28, 0)]),
    ];
}

function gardenLampParts(): BuildPart[] {
    return [
        part("metal", [
            cylinder(0.15, 0.2, 0.12, 8, 0, 0.06, 0),
            cylinder(0.045, 0.055, 1.0, 8, 0, 0.6, 0),
            plate(0.2, 0.04, 8, 0, 1.02, 0),
            cone(0.24, 0.26, 8, 0, 1.36, 0),
            blob(0.04, 0, 0, 1.5, 0),
        ]),
        part("glow", [cylinder(0.16, 0.18, 0.2, 8, 0, 1.14, 0)]),
    ];
}

function wallLampParts(): BuildPart[] {
    const z = -HALF + WALL_THICKNESS + 0.04;
    return [
        part("metal", [
            box(0.16, 0.3, 0.05, 0, 2.05, z),
            bar(0.03, 0.34, 6, 0, 2.18, z + 0.16, Math.PI / 2.6),
            cone(0.22, 0.24, 8, 0, 2.36, z + 0.3),
        ]),
        part("glow", [blob(0.13, 1, 0, 2.14, z + 0.3)]),
    ];
}

function chandelierParts(): BuildPart[] {
    const arms: THREE.BufferGeometry[] = [
        cylinder(0.025, 0.025, 0.5, 6, 0, LEVEL_HEIGHT - 0.25, 0),
        plate(0.09, 0.06, 8, 0, LEVEL_HEIGHT - 0.02, 0),
        ring(0.4, 0.03, 14, 0, LEVEL_HEIGHT - 0.6, 0),
    ];
    const bulbs: THREE.BufferGeometry[] = [];

    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const x = Math.cos(angle) * 0.4;
        const z = Math.sin(angle) * 0.4;
        arms.push(cylinder(0.02, 0.02, 0.16, 5, x, LEVEL_HEIGHT - 0.68, z));
        arms.push(cone(0.09, 0.14, 6, x, LEVEL_HEIGHT - 0.5, z));
        bulbs.push(shapedBlob(0.09, 1, 1, 1.3, 1, x, LEVEL_HEIGHT - 0.8, z));
    }

    return [part("metal", arms), part("glow", bulbs)];
}

function floorLampParts(): BuildPart[] {
    return [
        part("metal", [
            plate(0.26, 0.05, 12, 0, 0.03, 0),
            cylinder(0.035, 0.045, 1.85, 8, 0, 0.95, 0),
        ]),
        part("fabric", [tube(0.3, 0.42, 0.46, 16).translate(0, 2.1, 0)]),
        part("glow", [shapedBlob(0.13, 1, 1, 1.4, 1, 0, 1.98, 0)]),
    ];
}

function torchParts(): BuildPart[] {
    const z = -HALF + WALL_THICKNESS + 0.05;
    return [
        part("metal", [
            box(0.13, 0.26, 0.05, 0, 1.9, z),
            hoop(0.09, 0.02, 8, 0, 2.32, z + 0.11),
        ]),
        part("plank", [bar(0.045, 0.5, 6, 0, 2.24, z + 0.1, -0.3)]),
        part("glow", [shapedBlob(0.14, 1, 1, 1.5, 1, 0, 2.5, z + 0.14)]),
    ];
}

function campfireParts(): BuildPart[] {
    const stones: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
        const angle = (i / 9) * Math.PI * 2;
        stones.push(shapedBlob(0.17, 0, 1.1, 0.8, 1, Math.cos(angle) * 0.52, 0.11, Math.sin(angle) * 0.52, angle));
    }

    const logs: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI;
        logs.push(tiltedBox(0.11, 0.76, 0.11, 0, 0.22, 0, Math.PI / 2.4, angle, 0));
    }

    return [
        part("stone", stones),
        part("bark", logs),
        part("glow", [
            shapedBlob(0.22, 1, 1, 1.7, 1, 0, 0.42, 0),
            shapedBlob(0.13, 0, 1, 1.6, 1, 0.1, 0.62, -0.06),
        ]),
    ];
}

const ENTRIES: BuildEntry[] = [
    { id: "floor-plank", name: "Wood Floor", icon: "🪵", category: "structure", slot: "tile", layer: "floor", blocking: false, walkableTop: 0.12, build: () => slab("plank", 0.12, 0) },
    { id: "floor-parquet", name: "Parquet Floor", icon: "🟫", category: "structure", slot: "tile", layer: "floor", blocking: false, walkableTop: 0.12, build: () => slab("parquet", 0.12, 0) },
    { id: "floor-marble", name: "Marble Floor", icon: "⬜", category: "structure", slot: "tile", layer: "floor", blocking: false, walkableTop: 0.12, build: () => pavedSlab("marble", 0.1, "stone") },
    { id: "floor-stone", name: "Stone Floor", icon: "🪨", category: "structure", slot: "tile", layer: "floor", blocking: false, walkableTop: 0.12, build: () => pavedSlab("stone", 0.1, "concrete") },
    { id: "floor-concrete", name: "Concrete Floor", icon: "🔲", category: "structure", slot: "tile", layer: "floor", blocking: false, walkableTop: 0.12, build: () => slab("concrete", 0.12, 0) },

    { id: "wall-plaster", name: "Plaster Wall", icon: "🧱", category: "structure", slot: "edge", layer: "floor", blocking: true, walkableTop: null, build: () => [part("plaster", [wallBody(LEVEL_HEIGHT, 0)]), wallTrim("plank", LEVEL_HEIGHT)] },
    { id: "wall-brick", name: "Brick Wall", icon: "🟥", category: "structure", slot: "edge", layer: "floor", blocking: true, walkableTop: null, build: () => [part("brick", [wallBody(LEVEL_HEIGHT, 0)]), wallTrim("concrete", LEVEL_HEIGHT)] },
    { id: "wall-stone", name: "Stone Wall", icon: "⬛", category: "structure", slot: "edge", layer: "floor", blocking: true, walkableTop: null, build: () => [part("stone", [wallBody(LEVEL_HEIGHT, 0)])] },
    { id: "wall-plank", name: "Timber Wall", icon: "🪧", category: "structure", slot: "edge", layer: "floor", blocking: true, walkableTop: null, build: () => [part("plank", [wallBody(LEVEL_HEIGHT, 0)]), wallTrim("plank", LEVEL_HEIGHT)] },
    { id: "wall-half", name: "Half Wall", icon: "▂", category: "structure", slot: "edge", layer: "floor", blocking: true, walkableTop: null, blockHeight: LEVEL_HEIGHT * 0.45, build: () => [part("plaster", [wallBody(LEVEL_HEIGHT * 0.45, 0)]), part("plank", [box(CELL_SIZE, 0.09, WALL_THICKNESS * 1.6, 0, LEVEL_HEIGHT * 0.45, -HALF + WALL_THICKNESS / 2)])] },
    { id: "railing", name: "Railing", icon: "🛡️", category: "structure", slot: "edge", layer: "floor", blocking: true, walkableTop: null, blockHeight: 1.1, build: railingParts },
    { id: "pillar", name: "Pillar", icon: "🏛️", category: "structure", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockRadius: 0.42, build: pillarParts },
    { id: "ceiling", name: "Ceiling", icon: "⬛", category: "structure", slot: "tile", layer: "ceiling", blocking: false, walkableTop: LEVEL_HEIGHT, build: () => slab("plaster", 0.14, LEVEL_HEIGHT - 0.14) },
    { id: "stairs", name: "Wooden Stairs", icon: "🪜", category: "structure", slot: "tile", layer: "stairs", blocking: false, walkableTop: LEVEL_HEIGHT, ramp: true, build: () => stairParts("plank", "metal") },
    { id: "stairs-stone", name: "Stone Stairs", icon: "🧗", category: "structure", slot: "tile", layer: "stairs", blocking: false, walkableTop: LEVEL_HEIGHT, ramp: true, build: () => stairParts("stone", "metal") },

    { id: "door", name: "Door", icon: "🚪", category: "openings", slot: "edge", layer: "floor", blocking: true, walkableTop: null, hinged: true, opening: { width: 1.4, bottom: 0, top: 2.2 }, build: () => [...wallWithHole("plaster", 1.4, 0, 2.2), part("plank", frame(1.5, 0, 2.3, 0.1))] },
    { id: "arch", name: "Archway", icon: "⛩️", category: "openings", slot: "edge", layer: "floor", blocking: true, walkableTop: null, opening: { width: 1.6, bottom: 0, top: 2.45 }, build: () => wallWithHole("plaster", 1.6, 0, 2.45) },
    { id: "window", name: "Window", icon: "🪟", category: "openings", slot: "edge", layer: "floor", blocking: true, walkableTop: null, build: () => [...wallWithHole("plaster", 1.2, 0.9, 2.2), part("plank", [...frame(1.3, 0.85, 2.25, 0.1), box(1.36, 0.07, 0.34, 0, 0.88, -HALF + WALL_THICKNESS), box(0.06, 1.3, 0.05, 0, 1.55, -HALF + WALL_THICKNESS / 2)]), part("glass", [box(1.2, 1.3, 0.04, 0, 1.55, -HALF + WALL_THICKNESS / 2)])] },
    { id: "window-round", name: "Round Window", icon: "⭕", category: "openings", slot: "edge", layer: "floor", blocking: true, walkableTop: null, build: () => [...wallWithHole("brick", 1.0, 1.1, 2.1), part("plank", [hoop(0.53, 0.06, 18, 0, 1.6, -HALF + WALL_THICKNESS / 2), box(1.04, 0.05, 0.06, 0, 1.6, -HALF + WALL_THICKNESS / 2)]), part("glass", [disc(0.5, 0.06, 18, 0, 1.6, -HALF + WALL_THICKNESS / 2)])] },

    { id: "roof-slope", name: "Shingle Slope", icon: "🏠", category: "roofing", slot: "tile", layer: "roof", blocking: false, walkableTop: null, build: () => roofSlopeParts("shingle") },
    { id: "roof-clay", name: "Clay Slope", icon: "🧡", category: "roofing", slot: "tile", layer: "roof", blocking: false, walkableTop: null, build: () => roofSlopeParts("clay") },
    { id: "roof-thatch", name: "Thatch Slope", icon: "🌾", category: "roofing", slot: "tile", layer: "roof", blocking: false, walkableTop: null, build: () => roofSlopeParts("thatch") },
    { id: "roof-ridge", name: "Ridge Cap", icon: "⛰️", category: "roofing", slot: "tile", layer: "roof", blocking: false, walkableTop: null, build: () => roofRidgeParts("clay") },
    { id: "roof-gable", name: "Gable End", icon: "🔺", category: "roofing", slot: "edge", layer: "roof", blocking: false, walkableTop: null, build: () => roofGableParts("plaster") },
    { id: "roof-flat", name: "Flat Roof", icon: "▪️", category: "roofing", slot: "tile", layer: "roof", blocking: false, walkableTop: null, build: () => slab("concrete", 0.18, 0) },

    { id: "road", name: "Road", icon: "🛣️", category: "outdoor", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.1, build: () => roadParts("none") },
    { id: "road-line", name: "Road + Dashes", icon: "🚏", category: "outdoor", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.1, build: () => roadParts("dashed") },
    { id: "road-double", name: "Road + Divider", icon: "🛤️", category: "outdoor", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.1, build: () => roadParts("double") },
    { id: "road-edge", name: "Road Shoulder", icon: "🚧", category: "outdoor", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.1, build: roadEdgeParts },
    { id: "road-crossing", name: "Crosswalk", icon: "🦓", category: "outdoor", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.1, build: crossingParts },
    { id: "road-manhole", name: "Manhole", icon: "⚫", category: "outdoor", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.1, build: manholeParts },
    { id: "curb", name: "Curb", icon: "🧱", category: "outdoor", slot: "edge", layer: "ground", blocking: false, walkableTop: null, build: curbParts },
    { id: "path-stone", name: "Cobble Path", icon: "🪨", category: "outdoor", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.08, build: () => slab("cobble", 0.08, 0) },
    { id: "path-concrete", name: "Sidewalk", icon: "🚶", category: "outdoor", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.09, build: () => pavedSlab("concrete", 0.07, "gravel") },
    { id: "path-gravel", name: "Gravel Path", icon: "◻️", category: "outdoor", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.08, build: gravelPathParts },
    { id: "path-marble", name: "Marble Path", icon: "🀫", category: "outdoor", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.09, build: () => pavedSlab("marble", 0.07, "concrete") },
    { id: "path-plank", name: "Boardwalk", icon: "🪵", category: "outdoor", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.09, build: boardwalkParts },
    { id: "path-step", name: "Stepping Stones", icon: "🐾", category: "outdoor", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.09, build: steppingStonesParts },
    { id: "fence-wood", name: "Wooden Fence", icon: "🚧", category: "outdoor", slot: "edge", layer: "floor", blocking: true, walkableTop: null, blockHeight: 1.2, build: () => fenceParts("plank") },
    { id: "fence-metal", name: "Iron Fence", icon: "⛓️", category: "outdoor", slot: "edge", layer: "floor", blocking: true, walkableTop: null, blockHeight: 1.2, build: () => fenceParts("metal") },
    { id: "bench", name: "Bench", icon: "🪑", category: "outdoor", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 0.5, build: benchParts },
    { id: "trash-bin", name: "Litter Bin", icon: "🗑️", category: "outdoor", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 0.95, blockRadius: 0.34, build: trashBinParts },
    { id: "bollard", name: "Bollard", icon: "📍", category: "outdoor", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 1.0, blockRadius: 0.2, build: bollardParts },
    { id: "hydrant", name: "Hydrant", icon: "🚒", category: "outdoor", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 0.8, blockRadius: 0.24, build: hydrantParts },
    { id: "street-sign", name: "Street Sign", icon: "🚸", category: "outdoor", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 2.3, blockRadius: 0.16, build: streetSignParts },
    { id: "planter", name: "Street Planter", icon: "🌺", category: "outdoor", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 0.7, build: planterParts },

    { id: "lawn", name: "Lawn", icon: "🟩", category: "garden", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.08, build: lawnParts },
    { id: "soil-bed", name: "Bare Soil", icon: "🟤", category: "garden", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.08, build: () => slab("soil", 0.08, 0) },
    { id: "flowerbed-rose", name: "Rose Bed", icon: "🌹", category: "garden", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.2, build: () => flowerBedParts("petalRose") },
    { id: "flowerbed-gold", name: "Marigold Bed", icon: "🌼", category: "garden", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.2, build: () => flowerBedParts("petalGold") },
    { id: "flowerbed-violet", name: "Lavender Bed", icon: "🪻", category: "garden", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.2, build: () => flowerBedParts("petalViolet") },
    { id: "flowerbed-white", name: "Jasmine Bed", icon: "🤍", category: "garden", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.2, build: () => flowerBedParts("petalWhite") },
    { id: "veg-bed", name: "Vegetable Bed", icon: "🥬", category: "garden", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.18, build: vegetableBedParts },
    { id: "flowers-rose", name: "Rose Cluster", icon: "🌷", category: "garden", slot: "object", layer: "floor", blocking: false, walkableTop: null, build: () => flowerClusterParts("petalRose") },
    { id: "flowers-gold", name: "Daisy Cluster", icon: "🌸", category: "garden", slot: "object", layer: "floor", blocking: false, walkableTop: null, build: () => flowerClusterParts("petalGold") },
    { id: "flowers-violet", name: "Violet Cluster", icon: "💐", category: "garden", slot: "object", layer: "floor", blocking: false, walkableTop: null, build: () => flowerClusterParts("petalViolet") },
    { id: "flowers-white", name: "White Cluster", icon: "🕊️", category: "garden", slot: "object", layer: "floor", blocking: false, walkableTop: null, build: () => flowerClusterParts("petalWhite") },
    { id: "sunflowers", name: "Sunflowers", icon: "🌻", category: "garden", slot: "object", layer: "floor", blocking: false, walkableTop: null, build: sunflowerParts },
    { id: "bush", name: "Bush", icon: "🌿", category: "garden", slot: "object", layer: "floor", blocking: false, walkableTop: null, build: bushParts },
    { id: "topiary", name: "Topiary", icon: "🎄", category: "garden", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 1.6, blockRadius: 0.4, build: topiaryParts },
    { id: "hedge", name: "Hedge Row", icon: "🍀", category: "garden", slot: "edge", layer: "floor", blocking: true, walkableTop: null, blockHeight: 1.15, build: hedgeParts },
    { id: "garden-arch", name: "Garden Arch", icon: "🌸", category: "garden", slot: "edge", layer: "floor", blocking: true, walkableTop: null, opening: { width: 1.4, bottom: 0, top: 2.3 }, blockHeight: 2.6, build: gardenArchParts },
    { id: "tree-oak", name: "Oak Tree", icon: "🌳", category: "garden", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 2.4, blockRadius: 0.4, build: oakParts },
    { id: "tree-maple", name: "Maple Tree", icon: "🍁", category: "garden", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 2.2, blockRadius: 0.36, build: mapleParts },
    { id: "tree-pine", name: "Pine Tree", icon: "🌲", category: "garden", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 2.2, blockRadius: 0.34, build: pineParts },
    { id: "tree-birch", name: "Birch Tree", icon: "🎋", category: "garden", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 2.6, blockRadius: 0.28, build: birchParts },
    { id: "tree-palm", name: "Palm Tree", icon: "🌴", category: "garden", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 3.4, blockRadius: 0.3, build: palmParts },
    { id: "rock", name: "Boulder", icon: "🗿", category: "garden", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 0.8, build: rockParts },
    { id: "pond", name: "Pond", icon: "💧", category: "garden", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.16, build: pondParts },
    { id: "fountain", name: "Fountain", icon: "⛲", category: "garden", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 1.7, blockRadius: 1.0, build: fountainParts },

    { id: "street-lamp", name: "Street Lamp", icon: "🏮", category: "lighting", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 3.9, blockRadius: 0.25, light: { color: 0xffdba8, intensity: 30, distance: 18, x: 0, y: 3.4, z: -0.56, nightOnly: true }, build: streetLampParts },
    { id: "classic-lamp", name: "Classic Lamp", icon: "🕯️", category: "lighting", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 3.6, blockRadius: 0.25, light: { color: 0xffd7a0, intensity: 24, distance: 15, x: 0, y: 3.28, z: 0, nightOnly: true }, build: classicLampParts },
    { id: "garden-lamp", name: "Garden Lantern", icon: "🔦", category: "lighting", slot: "object", layer: "floor", blocking: false, walkableTop: null, light: { color: 0xffd08a, intensity: 11, distance: 9, x: 0, y: 1.14, z: 0 }, build: gardenLampParts },
    { id: "wall-lamp", name: "Wall Sconce", icon: "💡", category: "lighting", slot: "edge", layer: "floor", blocking: false, walkableTop: null, attachesToWall: true, light: { color: 0xffe0b0, intensity: 9, distance: 9, x: 0, y: 2.14, z: -HALF + WALL_THICKNESS + 0.34 }, build: wallLampParts },
    { id: "torch", name: "Wall Torch", icon: "🔥", category: "lighting", slot: "edge", layer: "floor", blocking: false, walkableTop: null, attachesToWall: true, light: { color: 0xff9a4a, intensity: 12, distance: 10, x: 0, y: 2.5, z: -HALF + WALL_THICKNESS + 0.19, flicker: 0.28 }, build: torchParts },
    { id: "campfire", name: "Campfire", icon: "🔥", category: "lighting", slot: "object", layer: "floor", blocking: false, walkableTop: null, light: { color: 0xff8a3c, intensity: 16, distance: 12, x: 0, y: 0.7, z: 0, flicker: 0.35 }, build: campfireParts },
    { id: "chandelier", name: "Chandelier", icon: "✨", category: "lighting", slot: "object", layer: "ceiling", blocking: false, walkableTop: null, light: { color: 0xfff0cf, intensity: 16, distance: 12, x: 0, y: LEVEL_HEIGHT - 0.85, z: 0 }, build: chandelierParts },
    { id: "lamp", name: "Floor Lamp", icon: "🛋️", category: "lighting", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 1.2, blockRadius: 0.3, light: { color: 0xffe4bc, intensity: 11, distance: 10, x: 0, y: 1.98, z: 0 }, build: floorLampParts },

    { id: "chair", name: "Chair", icon: "🪑", category: "furniture", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 0.6, build: chairParts },
    { id: "table", name: "Table", icon: "🍽️", category: "furniture", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 0.9, build: tableParts },
    { id: "bed", name: "Bed", icon: "🛏️", category: "furniture", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 0.7, build: bedParts },
    { id: "sofa", name: "Sofa", icon: "🛋️", category: "furniture", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 0.9, build: sofaParts },
    { id: "shelf", name: "Shelf", icon: "📚", category: "furniture", slot: "object", layer: "floor", blocking: true, walkableTop: null, build: shelfParts },
    { id: "plant", name: "Potted Plant", icon: "🪴", category: "furniture", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 1.4, blockRadius: 0.36, build: plantParts },

    { id: "poster", name: "Poster", icon: "🖼️", category: "decor", slot: "edge", layer: "floor", blocking: false, walkableTop: null, attachesToWall: true, paint: { width: 1.3, height: 0.9, y: 1.7, z: -HALF + WALL_THICKNESS + 0.055 }, build: () => posterParts(1.3, 0.9, 1.7) },
    { id: "poster-tall", name: "Tall Poster", icon: "🖌️", category: "decor", slot: "edge", layer: "floor", blocking: false, walkableTop: null, attachesToWall: true, paint: { width: 0.9, height: 1.4, y: 1.6, z: -HALF + WALL_THICKNESS + 0.055 }, build: () => posterParts(0.9, 1.4, 1.6) },
    { id: "poster-wide", name: "Wide Canvas", icon: "🎨", category: "decor", slot: "edge", layer: "floor", blocking: false, walkableTop: null, attachesToWall: true, paint: { width: 1.76, height: 0.86, y: 1.75, z: -HALF + WALL_THICKNESS + 0.055 }, build: () => posterParts(1.76, 0.86, 1.75) },
    { id: "billboard", name: "Billboard", icon: "📋", category: "decor", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 2.4, paint: { width: 1.7, height: 1.26, y: 1.7, z: 0.045 }, build: billboardParts },

    { id: SPAWN_BEACON_PIECE, name: "Spawn Beacon", icon: "🌟", category: "decor", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 2.4, blockRadius: 0.5, light: { color: 0x8ad4ff, intensity: 14, distance: 13, x: 0, y: 2.05, z: 0 }, interact: { id: SPAWN_BEACON_INTERACTION, y: 1.4 }, build: spawnBeaconParts },
    { id: STORAGE_CRATE_PIECE, name: "Storage Crate", icon: "📦", category: "furniture", slot: "object", layer: "floor", blocking: true, walkableTop: null, blockHeight: 1.05, blockRadius: 0.68, interact: { id: STORAGE_INTERACTION, keyed: true, y: 0.9 }, build: storageCrateParts },
];

export const LIMITED_BUILD_PIECES = {
    beacon: SPAWN_BEACON_PIECE,
    storage: STORAGE_CRATE_PIECE,
} as const;

const byId = new Map<string, BuildEntry>(ENTRIES.map((entry) => [entry.id, entry]));
const partsCache = new Map<string, BuildPart[]>();

export function getBuildEntries(): BuildEntry[] {
    return ENTRIES;
}

export function getBuildEntry(id: string): BuildEntry | undefined {
    return byId.get(id);
}

export function getBuildParts(id: string): BuildPart[] {
    const cached = partsCache.get(id);
    if (cached) return cached;

    const entry = byId.get(id);
    if (!entry) return [];

    const parts = entry.build();
    partsCache.set(id, parts);
    return parts;
}

export function getBuildMaterial(surface: SurfaceId): THREE.MeshStandardMaterial {
    return getSurfaceMaterial(surface);
}

export function disposeBuildCatalog() {
    partsCache.forEach((parts) => parts.forEach((entry) => entry.geometry.dispose()));
    partsCache.clear();
    doorLeafGeometry?.dispose();
    doorLeafGeometry = null;
}
