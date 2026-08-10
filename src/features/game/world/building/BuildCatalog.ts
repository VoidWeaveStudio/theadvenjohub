// src/features/game/world/building/BuildCatalog.ts
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { getSurfaceMaterial, type SurfaceId } from "./buildTextures";

export const CELL_SIZE = 2;
export const LEVEL_HEIGHT = 3;
export const WALL_THICKNESS = 0.18;
export const HALF = CELL_SIZE / 2;

export type BuildSlot = "tile" | "edge" | "object";
export type BuildLayer = "floor" | "ceiling" | "roof" | "ground";
export type BuildCategory = "structure" | "openings" | "roofing" | "outdoor" | "furniture" | "decor";

export interface BuildPart {
    geometry: THREE.BufferGeometry;
    surface: SurfaceId;
}

export interface BuildEntry {
    id: string;
    name: string;
    icon: string;
    category: BuildCategory;
    slot: BuildSlot;
    layer: BuildLayer;
    blocking: boolean;
    walkableTop: number | null;
    build: () => BuildPart[];
}

function box(width: number, height: number, depth: number, x: number, y: number, z: number): THREE.BufferGeometry {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    geometry.translate(x, y, z);
    return geometry;
}

function cylinder(radiusTop: number, radiusBottom: number, height: number, segments: number, x: number, y: number, z: number): THREE.BufferGeometry {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
    geometry.translate(x, y, z);
    return geometry;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
    if (parts.length === 1) return parts[0];
    const merged = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    return merged ?? new THREE.BufferGeometry();
}

function part(surface: SurfaceId, geometries: THREE.BufferGeometry[]): BuildPart {
    return { surface, geometry: merge(geometries) };
}

function slab(surface: SurfaceId, thickness: number, y: number): BuildPart[] {
    return [part(surface, [box(CELL_SIZE, thickness, CELL_SIZE, 0, y + thickness / 2, 0)])];
}

function wallBody(surface: SurfaceId, height: number, baseY: number): THREE.BufferGeometry {
    return box(CELL_SIZE, height, WALL_THICKNESS, 0, baseY + height / 2, -HALF + WALL_THICKNESS / 2);
}

function wallWithHole(surface: SurfaceId, holeWidth: number, holeBottom: number, holeTop: number): BuildPart[] {
    const sideWidth = (CELL_SIZE - holeWidth) / 2;
    const z = -HALF + WALL_THICKNESS / 2;
    const pieces: THREE.BufferGeometry[] = [
        box(sideWidth, LEVEL_HEIGHT, WALL_THICKNESS, -(CELL_SIZE - sideWidth) / 2, LEVEL_HEIGHT / 2, z),
        box(sideWidth, LEVEL_HEIGHT, WALL_THICKNESS, (CELL_SIZE - sideWidth) / 2, LEVEL_HEIGHT / 2, z),
    ];
    if (holeBottom > 0.001) {
        pieces.push(box(holeWidth, holeBottom, WALL_THICKNESS, 0, holeBottom / 2, z));
    }
    if (holeTop < LEVEL_HEIGHT - 0.001) {
        pieces.push(box(holeWidth, LEVEL_HEIGHT - holeTop, WALL_THICKNESS, 0, (LEVEL_HEIGHT + holeTop) / 2, z));
    }
    return [part(surface, pieces)];
}

function frame(surface: SurfaceId, width: number, bottom: number, top: number, thickness: number): THREE.BufferGeometry[] {
    const z = -HALF + WALL_THICKNESS / 2;
    const height = top - bottom;
    return [
        box(thickness, height, WALL_THICKNESS * 1.15, -width / 2 + thickness / 2, bottom + height / 2, z),
        box(thickness, height, WALL_THICKNESS * 1.15, width / 2 - thickness / 2, bottom + height / 2, z),
        box(width, thickness, WALL_THICKNESS * 1.15, 0, top - thickness / 2, z),
        box(width, thickness, WALL_THICKNESS * 1.15, 0, bottom + thickness / 2, z),
    ];
}

function stairParts(surface: SurfaceId, railSurface: SurfaceId): BuildPart[] {
    const steps = 8;
    const rise = LEVEL_HEIGHT / steps;
    const run = CELL_SIZE / steps;
    const treads: THREE.BufferGeometry[] = [];

    for (let i = 0; i < steps; i++) {
        treads.push(box(CELL_SIZE * 0.86, rise, run, 0, rise / 2 + i * rise, HALF - run / 2 - i * run));
    }

    const rails: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
        for (let i = 0; i < steps; i += 2) {
            rails.push(box(0.09, rise * 2.2, 0.09, side * CELL_SIZE * 0.4, rise * i + rise * 1.6, HALF - run / 2 - i * run));
        }
    }

    return [part(surface, treads), part(railSurface, rails)];
}

function roofSlopeParts(surface: SurfaceId): BuildPart[] {
    const slices = 6;
    const pieces: THREE.BufferGeometry[] = [];
    const step = CELL_SIZE / slices;

    for (let i = 0; i < slices; i++) {
        const height = ((i + 1) / slices) * LEVEL_HEIGHT * 0.72;
        pieces.push(box(CELL_SIZE, 0.16, step, 0, height, -HALF + step / 2 + i * step));
    }
    return [part(surface, pieces)];
}

function roofRidgeParts(surface: SurfaceId): BuildPart[] {
    const slices = 6;
    const pieces: THREE.BufferGeometry[] = [];
    const step = CELL_SIZE / slices;

    for (let i = 0; i < slices; i++) {
        const t = Math.abs(i - (slices - 1) / 2) / ((slices - 1) / 2);
        const height = (1 - t) * LEVEL_HEIGHT * 0.72;
        pieces.push(box(CELL_SIZE, 0.16, step, 0, height, -HALF + step / 2 + i * step));
    }
    return [part(surface, pieces)];
}

function chairParts(): BuildPart[] {
    const wood: THREE.BufferGeometry[] = [
        box(0.9, 0.1, 0.9, 0, 0.5, 0),
        box(0.9, 0.9, 0.1, 0, 0.95, -0.4),
    ];
    for (const dx of [-0.36, 0.36]) {
        for (const dz of [-0.36, 0.36]) {
            wood.push(box(0.1, 0.5, 0.1, dx, 0.25, dz));
        }
    }
    return [part("plank", wood), part("fabric", [box(0.82, 0.08, 0.82, 0, 0.58, 0)])];
}

function tableParts(): BuildPart[] {
    const wood: THREE.BufferGeometry[] = [box(1.7, 0.12, 1.7, 0, 0.78, 0)];
    for (const dx of [-0.7, 0.7]) {
        for (const dz of [-0.7, 0.7]) {
            wood.push(box(0.13, 0.72, 0.13, dx, 0.36, dz));
        }
    }
    return [part("plank", wood)];
}

function bedParts(): BuildPart[] {
    const wood: THREE.BufferGeometry[] = [
        box(1.7, 0.25, 1.9, 0, 0.28, 0),
        box(1.7, 0.9, 0.12, 0, 0.75, -0.95),
    ];
    for (const dx of [-0.75, 0.75]) {
        for (const dz of [-0.85, 0.85]) {
            wood.push(box(0.14, 0.18, 0.14, dx, 0.09, dz));
        }
    }
    return [
        part("plank", wood),
        part("fabric", [box(1.62, 0.22, 1.8, 0, 0.51, 0), box(1.0, 0.16, 0.42, 0, 0.68, -0.66)]),
    ];
}

function sofaParts(): BuildPart[] {
    return [
        part("plank", [box(1.9, 0.2, 0.95, 0, 0.16, 0)]),
        part("fabric", [
            box(1.86, 0.32, 0.9, 0, 0.42, 0),
            box(1.86, 0.7, 0.22, 0, 0.75, -0.36),
            box(0.22, 0.5, 0.9, -0.82, 0.6, 0),
            box(0.22, 0.5, 0.9, 0.82, 0.6, 0),
        ]),
    ];
}

function shelfParts(): BuildPart[] {
    const wood: THREE.BufferGeometry[] = [
        box(1.6, 0.1, 0.4, 0, 0.06, 0),
        box(0.1, 2.0, 0.4, -0.75, 1.0, 0),
        box(0.1, 2.0, 0.4, 0.75, 1.0, 0),
    ];
    for (let i = 1; i <= 3; i++) {
        wood.push(box(1.6, 0.08, 0.4, 0, i * 0.55, 0));
    }
    return [part("plank", wood)];
}

function lampParts(): BuildPart[] {
    return [
        part("metal", [cylinder(0.06, 0.22, 1.9, 12, 0, 0.95, 0)]),
        part("fabric", [cylinder(0.34, 0.46, 0.5, 16, 0, 2.15, 0)]),
    ];
}

function plantParts(): BuildPart[] {
    const leaves: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2;
        const leaf = box(0.16, 0.9, 0.5, Math.cos(angle) * 0.24, 1.15, Math.sin(angle) * 0.24);
        leaf.rotateY(angle);
        leaves.push(leaf);
    }
    return [
        part("stone", [cylinder(0.34, 0.26, 0.55, 14, 0, 0.28, 0)]),
        part("fabric", leaves),
    ];
}

function posterParts(): BuildPart[] {
    const z = -HALF + WALL_THICKNESS + 0.03;
    return [
        part("plank", [box(1.3, 0.9, 0.06, 0, 1.7, z)]),
        part("canvas", [box(1.15, 0.75, 0.04, 0, 1.7, z + 0.03)]),
    ];
}

function fenceParts(surface: SurfaceId): BuildPart[] {
    const z = -HALF + WALL_THICKNESS / 2;
    const pieces: THREE.BufferGeometry[] = [
        box(CELL_SIZE, 0.1, 0.1, 0, 0.95, z),
        box(CELL_SIZE, 0.1, 0.1, 0, 0.5, z),
    ];
    for (const dx of [-0.85, 0, 0.85]) {
        pieces.push(box(0.14, 1.15, 0.14, dx, 0.57, z));
    }
    return [part(surface, pieces)];
}

function pillarParts(): BuildPart[] {
    return [
        part("marble", [cylinder(0.26, 0.3, LEVEL_HEIGHT - 0.3, 16, 0, (LEVEL_HEIGHT - 0.3) / 2, 0)]),
        part("stone", [box(0.8, 0.16, 0.8, 0, 0.08, 0), box(0.8, 0.16, 0.8, 0, LEVEL_HEIGHT - 0.08, 0)]),
    ];
}

const ENTRIES: BuildEntry[] = [
    { id: "floor-plank", name: "Wood Floor", icon: "🪵", category: "structure", slot: "tile", layer: "floor", blocking: false, walkableTop: 0.12, build: () => slab("plank", 0.12, 0) },
    { id: "floor-parquet", name: "Parquet Floor", icon: "🟫", category: "structure", slot: "tile", layer: "floor", blocking: false, walkableTop: 0.12, build: () => slab("parquet", 0.12, 0) },
    { id: "floor-marble", name: "Marble Floor", icon: "⬜", category: "structure", slot: "tile", layer: "floor", blocking: false, walkableTop: 0.12, build: () => slab("marble", 0.12, 0) },
    { id: "floor-stone", name: "Stone Floor", icon: "🪨", category: "structure", slot: "tile", layer: "floor", blocking: false, walkableTop: 0.12, build: () => slab("stone", 0.12, 0) },

    { id: "wall-plaster", name: "Plaster Wall", icon: "🧱", category: "structure", slot: "edge", layer: "floor", blocking: true, walkableTop: null, build: () => [part("plaster", [wallBody("plaster", LEVEL_HEIGHT, 0)])] },
    { id: "wall-brick", name: "Brick Wall", icon: "🟥", category: "structure", slot: "edge", layer: "floor", blocking: true, walkableTop: null, build: () => [part("brick", [wallBody("brick", LEVEL_HEIGHT, 0)])] },
    { id: "wall-stone", name: "Stone Wall", icon: "⬛", category: "structure", slot: "edge", layer: "floor", blocking: true, walkableTop: null, build: () => [part("stone", [wallBody("stone", LEVEL_HEIGHT, 0)])] },
    { id: "wall-half", name: "Half Wall", icon: "▂", category: "structure", slot: "edge", layer: "floor", blocking: true, walkableTop: null, build: () => [part("plaster", [wallBody("plaster", LEVEL_HEIGHT * 0.45, 0)])] },
    { id: "pillar", name: "Pillar", icon: "🏛️", category: "structure", slot: "object", layer: "floor", blocking: true, walkableTop: null, build: pillarParts },
    { id: "ceiling", name: "Ceiling", icon: "⬛", category: "structure", slot: "tile", layer: "ceiling", blocking: false, walkableTop: null, build: () => slab("plaster", 0.14, LEVEL_HEIGHT - 0.14) },
    { id: "stairs", name: "Stairs", icon: "🪜", category: "structure", slot: "tile", layer: "floor", blocking: false, walkableTop: LEVEL_HEIGHT, build: () => stairParts("plank", "metal") },

    { id: "door", name: "Door", icon: "🚪", category: "openings", slot: "edge", layer: "floor", blocking: false, walkableTop: null, build: () => [...wallWithHole("plaster", 1.1, 0, 2.2), part("plank", frame("plank", 1.2, 0, 2.3, 0.1))] },
    { id: "arch", name: "Archway", icon: "⛩️", category: "openings", slot: "edge", layer: "floor", blocking: false, walkableTop: null, build: () => wallWithHole("plaster", 1.4, 0, 2.45) },
    { id: "window", name: "Window", icon: "🪟", category: "openings", slot: "edge", layer: "floor", blocking: true, walkableTop: null, build: () => [...wallWithHole("plaster", 1.2, 0.9, 2.2), part("plank", frame("plank", 1.3, 0.85, 2.25, 0.1)), part("glass", [box(1.2, 1.3, 0.04, 0, 1.55, -HALF + WALL_THICKNESS / 2)])] },
    { id: "window-round", name: "Round Window", icon: "⭕", category: "openings", slot: "edge", layer: "floor", blocking: true, walkableTop: null, build: () => [...wallWithHole("brick", 1.0, 1.1, 2.1), part("glass", [cylinder(0.5, 0.5, 0.05, 20, 0, 1.6, -HALF + WALL_THICKNESS / 2)])] },

    { id: "roof-slope", name: "Sloped Roof", icon: "🏠", category: "roofing", slot: "tile", layer: "roof", blocking: false, walkableTop: null, build: () => roofSlopeParts("shingle") },
    { id: "roof-ridge", name: "Ridge Roof", icon: "⛰️", category: "roofing", slot: "tile", layer: "roof", blocking: false, walkableTop: null, build: () => roofRidgeParts("shingle") },
    { id: "roof-thatch", name: "Thatch Roof", icon: "🌾", category: "roofing", slot: "tile", layer: "roof", blocking: false, walkableTop: null, build: () => roofSlopeParts("thatch") },
    { id: "roof-flat", name: "Flat Roof", icon: "▪️", category: "roofing", slot: "tile", layer: "roof", blocking: false, walkableTop: null, build: () => slab("stone", 0.18, 0) },

    { id: "path-stone", name: "Stone Path", icon: "🛤️", category: "outdoor", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.06, build: () => slab("cobble", 0.06, 0) },
    { id: "path-marble", name: "Marble Path", icon: "🀫", category: "outdoor", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.06, build: () => slab("marble", 0.06, 0) },
    { id: "path-plank", name: "Boardwalk", icon: "🪵", category: "outdoor", slot: "tile", layer: "ground", blocking: false, walkableTop: 0.06, build: () => slab("plank", 0.06, 0) },
    { id: "fence-wood", name: "Wooden Fence", icon: "🚧", category: "outdoor", slot: "edge", layer: "floor", blocking: true, walkableTop: null, build: () => fenceParts("plank") },
    { id: "fence-metal", name: "Iron Fence", icon: "⛓️", category: "outdoor", slot: "edge", layer: "floor", blocking: true, walkableTop: null, build: () => fenceParts("metal") },

    { id: "chair", name: "Chair", icon: "🪑", category: "furniture", slot: "object", layer: "floor", blocking: true, walkableTop: null, build: chairParts },
    { id: "table", name: "Table", icon: "🛋️", category: "furniture", slot: "object", layer: "floor", blocking: true, walkableTop: null, build: tableParts },
    { id: "bed", name: "Bed", icon: "🛏️", category: "furniture", slot: "object", layer: "floor", blocking: true, walkableTop: null, build: bedParts },
    { id: "sofa", name: "Sofa", icon: "🛋️", category: "furniture", slot: "object", layer: "floor", blocking: true, walkableTop: null, build: sofaParts },
    { id: "shelf", name: "Shelf", icon: "📚", category: "furniture", slot: "object", layer: "floor", blocking: true, walkableTop: null, build: shelfParts },
    { id: "lamp", name: "Floor Lamp", icon: "💡", category: "furniture", slot: "object", layer: "floor", blocking: true, walkableTop: null, build: lampParts },
    { id: "plant", name: "Potted Plant", icon: "🪴", category: "furniture", slot: "object", layer: "floor", blocking: true, walkableTop: null, build: plantParts },

    { id: "poster", name: "Poster", icon: "🖼️", category: "decor", slot: "edge", layer: "floor", blocking: false, walkableTop: null, build: posterParts },
];

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
}
