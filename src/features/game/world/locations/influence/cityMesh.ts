// src/features/game/world/locations/influence/cityMesh.ts
import * as THREE from "three";
import {
    CITY_BOUNDARY,
    CITY_BUILDINGS,
    CITY_CATHEDRAL,
    CITY_CATHEDRAL_COLUMNS,
    CITY_CATHEDRAL_DOOR,
    CITY_CATHEDRAL_BLOCKS,
    CITY_CATHEDRAL_WALLS,
    CITY_EDGE_RUINS,
    CITY_FLOOR_HEIGHT,
    CITY_LAMPS,
    CITY_PROPS,
    CityBuilding,
    CityRect,
} from "./cityLayout";

export const CITY_CHUNK = 44;
export const CITY_RIM_DROP = 46;
export const CITY_TEAR_HEIGHT = 58;
export const CATHEDRAL_HEIGHT = 31;
export const CATHEDRAL_TOWER_HEIGHT = 54;

const WALL_SEGMENT = 2.4;
const PLINTH_HEIGHT = 0.75;
const WINDOW_W = 1.05;
const WINDOW_H = 1.5;

const COLOURS = {
    plaster: [0x8c8175, 0x7d7266, 0x94897b, 0x6f6459],
    brick: [0x6d4436, 0x7a4c3a, 0x5f3b30],
    stone: [0x6b6660, 0x767068, 0x5d5852],
    timber: [0x3c2f25, 0x473729],
    roof: [0x3f342e, 0x4a3d34, 0x352b26],
    interior: 0x241f1b,
    plinth: 0x4a453f,
    lintel: 0x9a9086,
    window: 0x0a0b0d,
    cathedral: 0x968b7c,
    cathedralDark: 0x6e655a,
    rubble: 0x55504a,
    cobble: 0x6e675b,
    cobbleDark: 0x5c564c,
    ember: 0xd45f1e,
    lantern: 0xd9a25e,
    rim: 0x1d1a22,
    rimGlow: 0x6a3fd0,
};

export interface CityChunk {
    x: number;
    z: number;
    radius: number;
    geometry: THREE.BufferGeometry;
}

export interface CityMeshResult {
    chunks: CityChunk[];
    landmark: THREE.BufferGeometry;
    glass: THREE.BufferGeometry;
    ground: THREE.BufferGeometry;
    rim: THREE.BufferGeometry;
    colliders: THREE.Box3[];
    lampAnchors: THREE.Vector3[];
    brazierAnchors: THREE.Vector3[];
}

interface Batch {
    position: number[];
    normal: number[];
    color: number[];
}

function makeBatch(): Batch {
    return { position: [], normal: [], color: [] };
}

function toGeometry(batch: Batch): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(batch.position, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(batch.normal, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(batch.color, 3));
    geometry.computeBoundingSphere();
    return geometry;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();
const _colour = new THREE.Color();

function pushTri(
    batch: Batch,
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    colour: number,
    shade = 1
) {
    _a.set(cx - ax, cy - ay, cz - az);
    _b.set(bx - ax, by - ay, bz - az);
    _n.crossVectors(_a, _b);
    if (_n.lengthSq() < 1e-10) return;
    _n.normalize();

    _colour.setHex(colour).multiplyScalar(shade);

    batch.position.push(ax, ay, az, cx, cy, cz, bx, by, bz);
    for (let i = 0; i < 3; i++) {
        batch.normal.push(_n.x, _n.y, _n.z);
        batch.color.push(_colour.r, _colour.g, _colour.b);
    }
}

function pushQuad(
    batch: Batch,
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
    colour: number,
    shade = 1
) {
    pushTri(batch, ax, ay, az, bx, by, bz, cx, cy, cz, colour, shade);
    pushTri(batch, ax, ay, az, cx, cy, cz, dx, dy, dz, colour, shade);
}

function pushBox(
    batch: Batch,
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number,
    colour: number,
    shade = 1,
    skipBottom = true
) {
    pushQuad(batch, minX, maxY, minZ, maxX, maxY, minZ, maxX, maxY, maxZ, minX, maxY, maxZ, colour, shade);
    if (!skipBottom) {
        pushQuad(batch, minX, minY, maxZ, maxX, minY, maxZ, maxX, minY, minZ, minX, minY, minZ, colour, shade * 0.6);
    }
    pushQuad(batch, minX, minY, minZ, maxX, minY, minZ, maxX, maxY, minZ, minX, maxY, minZ, colour, shade * 0.86);
    pushQuad(batch, maxX, minY, maxZ, minX, minY, maxZ, minX, maxY, maxZ, maxX, maxY, maxZ, colour, shade * 0.94);
    pushQuad(batch, minX, minY, maxZ, minX, minY, minZ, minX, maxY, minZ, minX, maxY, maxZ, colour, shade * 0.9);
    pushQuad(batch, maxX, minY, minZ, maxX, minY, maxZ, maxX, maxY, maxZ, maxX, maxY, minZ, colour, shade * 0.9);
}

function rng(seed: number) {
    let state = (seed | 0) || 1;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) | 0;
        return ((state >>> 8) & 0xffffff) / 0xffffff;
    };
}

function pick<T>(list: readonly T[], random: () => number): T {
    return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

function pushRaggedWall(
    batch: Batch,
    rect: CityRect,
    height: number,
    ruin: number,
    random: () => number,
    body: number,
    withWindows: boolean,
    floors: number
) {
    const alongX = rect.maxX - rect.minX >= rect.maxZ - rect.minZ;
    const length = alongX ? rect.maxX - rect.minX : rect.maxZ - rect.minZ;
    const steps = Math.max(1, Math.min(20, Math.round(length / WALL_SEGMENT)));

    const lo = alongX ? rect.minX : rect.minZ;
    const hi = alongX ? rect.maxX : rect.maxZ;
    const nearFace = alongX ? rect.minZ : rect.minX;
    const farFace = alongX ? rect.maxZ : rect.maxX;

    const heights: number[] = [];
    for (let i = 0; i <= steps; i++) {
        const bite = ruin < 0.28 ? random() * 0.1 : random() * ruin * 0.62;
        heights.push(Math.max(0.85, height * (1 - bite)));
    }
    if (ruin > 0.5 && steps > 2) {
        const notch = 1 + Math.floor(random() * (steps - 1));
        heights[notch] = Math.max(0.7, heights[notch] * (0.35 + random() * 0.3));
    }

    const at = (index: number) => lo + ((hi - lo) * index) / steps;

    for (let i = 0; i < steps; i++) {
        const p0 = at(i);
        const p1 = at(i + 1);
        const h0 = heights[i];
        const h1 = heights[i + 1];
        const tint = 0.92 + random() * 0.16;

        if (alongX) {
            pushQuad(batch, p0, 0, nearFace, p1, 0, nearFace, p1, h1, nearFace, p0, h0, nearFace, body, 0.88 * tint);
            pushQuad(batch, p1, 0, farFace, p0, 0, farFace, p0, h0, farFace, p1, h1, farFace, body, 0.78 * tint);
            pushQuad(batch, p0, h0, nearFace, p1, h1, nearFace, p1, h1, farFace, p0, h0, farFace, body, 1.06 * tint);
        } else {
            pushQuad(batch, nearFace, 0, p1, nearFace, 0, p0, nearFace, h0, p0, nearFace, h1, p1, body, 0.9 * tint);
            pushQuad(batch, farFace, 0, p0, farFace, 0, p1, farFace, h1, p1, farFace, h0, p0, body, 0.82 * tint);
            pushQuad(batch, nearFace, h1, p1, nearFace, h0, p0, farFace, h0, p0, farFace, h1, p1, body, 1.06 * tint);
        }
    }

    if (alongX) {
        pushQuad(batch, lo, 0, farFace, lo, 0, nearFace, lo, heights[0], nearFace, lo, heights[0], farFace, body, 0.72);
        pushQuad(batch, hi, 0, nearFace, hi, 0, farFace, hi, heights[steps], farFace, hi, heights[steps], nearFace, body, 0.72);
    } else {
        pushQuad(batch, nearFace, 0, lo, farFace, 0, lo, farFace, heights[0], lo, nearFace, heights[0], lo, body, 0.72);
        pushQuad(batch, farFace, 0, hi, nearFace, 0, hi, nearFace, heights[steps], hi, farFace, heights[steps], hi, body, 0.72);
    }

    const plinth = Math.min(PLINTH_HEIGHT, height * 0.3);
    pushBox(
        batch,
        rect.minX - 0.16, 0, rect.minZ - 0.16,
        rect.maxX + 0.16, plinth, rect.maxZ + 0.16,
        COLOURS.plinth,
        0.95
    );

    if (!withWindows) return;

    const levels = Math.max(1, Math.min(floors, 5));
    for (let level = 0; level < levels; level++) {
        const sill = 1.15 + level * CITY_FLOOR_HEIGHT;
        if (sill + WINDOW_H > height - 0.5) break;

        const columns = Math.max(1, Math.floor(length / 3.1));
        for (let c = 0; c < columns; c++) {
            if (random() > 0.62) continue;
            const centre = lo + ((c + 0.5) * length) / columns;
            const half = WINDOW_W / 2;
            if (centre - half < lo + 0.3 || centre + half > hi - 0.3) continue;

            const broken = random() < ruin * 0.55;
            const top = sill + WINDOW_H * (broken ? 0.6 + random() * 0.4 : 1);

            if (alongX) {
                pushQuad(batch, centre - half, sill, nearFace - 0.04, centre + half, sill, nearFace - 0.04, centre + half, top, nearFace - 0.04, centre - half, top, nearFace - 0.04, COLOURS.window, 1);
                pushQuad(batch, centre + half, sill, farFace + 0.04, centre - half, sill, farFace + 0.04, centre - half, top, farFace + 0.04, centre + half, top, farFace + 0.04, COLOURS.window, 1);
                pushBox(batch, centre - half - 0.16, top, nearFace - 0.09, centre + half + 0.16, top + 0.22, farFace + 0.09, COLOURS.lintel, 0.9);
            } else {
                pushQuad(batch, nearFace - 0.04, sill, centre + half, nearFace - 0.04, sill, centre - half, nearFace - 0.04, top, centre - half, nearFace - 0.04, top, centre + half, COLOURS.window, 1);
                pushQuad(batch, farFace + 0.04, sill, centre - half, farFace + 0.04, sill, centre + half, farFace + 0.04, top, centre + half, farFace + 0.04, top, centre - half, COLOURS.window, 1);
                pushBox(batch, nearFace - 0.09, top, centre - half - 0.16, farFace + 0.09, top + 0.22, centre + half + 0.16, COLOURS.lintel, 0.9);
            }
        }
    }
}

function pushGableRoof(batch: Batch, building: CityBuilding, baseY: number, random: () => number) {
    const minX = building.x - building.w / 2 - 0.5;
    const maxX = building.x + building.w / 2 + 0.5;
    const minZ = building.z - building.d / 2 - 0.5;
    const maxZ = building.z + building.d / 2 + 0.5;
    const colour = pick(COLOURS.roof, random);
    const rise = Math.min(4.6, Math.max(1.8, Math.min(maxX - minX, maxZ - minZ) * 0.34));
    const ridgeY = baseY + rise;
    const alongX = maxX - minX >= maxZ - minZ;

    if (alongX) {
        const ridgeZ = (minZ + maxZ) / 2;
        pushQuad(batch, minX, baseY, minZ, maxX, baseY, minZ, maxX, ridgeY, ridgeZ, minX, ridgeY, ridgeZ, colour, 1.04);
        pushQuad(batch, maxX, baseY, maxZ, minX, baseY, maxZ, minX, ridgeY, ridgeZ, maxX, ridgeY, ridgeZ, colour, 0.86);
        pushTri(batch, minX, baseY, minZ, minX, ridgeY, ridgeZ, minX, baseY, maxZ, colour, 0.78);
        pushTri(batch, maxX, baseY, maxZ, maxX, ridgeY, ridgeZ, maxX, baseY, minZ, colour, 0.78);
    } else {
        const ridgeX = (minX + maxX) / 2;
        pushQuad(batch, minX, baseY, maxZ, minX, baseY, minZ, ridgeX, ridgeY, minZ, ridgeX, ridgeY, maxZ, colour, 1.04);
        pushQuad(batch, maxX, baseY, minZ, maxX, baseY, maxZ, ridgeX, ridgeY, maxZ, ridgeX, ridgeY, minZ, colour, 0.86);
        pushTri(batch, minX, baseY, minZ, ridgeX, ridgeY, minZ, maxX, baseY, minZ, colour, 0.78);
        pushTri(batch, maxX, baseY, maxZ, ridgeX, ridgeY, maxZ, minX, baseY, maxZ, colour, 0.78);
    }

    if (random() < 0.45) {
        const cx = minX + (maxX - minX) * (0.2 + random() * 0.6);
        const cz = minZ + (maxZ - minZ) * (0.2 + random() * 0.6);
        pushBox(batch, cx - 0.7, baseY, cz - 0.7, cx + 0.7, ridgeY + 1.6 + random() * 1.4, cz + 0.7, pick(COLOURS.brick, random), 0.95);
    }
}

function pushRubblePile(batch: Batch, x: number, z: number, radius: number, random: () => number) {
    const lumps = 3 + Math.floor(random() * 4);
    for (let i = 0; i < lumps; i++) {
        const angle = random() * Math.PI * 2;
        const spread = random() * radius;
        const px = x + Math.cos(angle) * spread;
        const pz = z + Math.sin(angle) * spread;
        const size = 0.5 + random() * 1.3;
        const height = 0.3 + random() * 1.1;
        pushBox(batch, px - size, 0, pz - size * 0.8, px + size * 0.9, height, pz + size, COLOURS.rubble, 0.85 + random() * 0.3);
    }
}

function buildingHeight(building: CityBuilding): number {
    return building.height;
}


function pushInterior(batch: Batch, building: CityBuilding, random: () => number) {
    const inset = 1.8;
    const minX = building.x - building.w / 2 + inset;
    const maxX = building.x + building.w / 2 - inset;
    const minZ = building.z - building.d / 2 + inset;
    const maxZ = building.z + building.d / 2 - inset;

    if (maxX - minX < 2 || maxZ - minZ < 2) return;

    const pieces = 3 + Math.floor(random() * 4);

    for (let i = 0; i < pieces; i++) {
        const px = minX + random() * (maxX - minX);
        const pz = minZ + random() * (maxZ - minZ);
        const roll = random();

        if (roll < 0.22) {
            const length = 1.5 + random() * 2.2;
            const along = random() < 0.5;
            pushBox(
                batch,
                px - (along ? length : 0.5), 0.06, pz - (along ? 0.5 : length),
                px + (along ? length : 0.5), 0.36 + random() * 0.2, pz + (along ? 0.5 : length),
                pick(COLOURS.timber, random),
                0.95
            );
            continue;
        }

        if (roll < 0.42) {
            const half = 0.6 + random() * 0.5;
            const top = 0.4 + random() * 0.28;
            pushBox(
                batch,
                px - half, top - 0.1, pz - half * 0.7,
                px + half, top, pz + half * 0.7,
                pick(COLOURS.timber, random),
                1
            );
            for (let leg = 0; leg < 2; leg++) {
                const lx = px + (leg === 0 ? -half * 0.7 : half * 0.7);
                pushBox(batch, lx - 0.08, 0, pz - 0.08, lx + 0.08, 0.3, pz + 0.08, COLOURS.timber[1], 0.9);
            }
            continue;
        }

        if (roll < 0.6) {
            pushRubblePile(batch, px, pz, 0.9 + random() * 0.8, random);
            continue;
        }

        if (roll < 0.76) {
            const size = 0.34 + random() * 0.22;
            const stack = 1 + Math.floor(random() * 2);
            for (let level = 0; level < stack; level++) {
                const drift = level * 0.14;
                pushBox(
                    batch,
                    px - size + drift, level * (size * 1.7), pz - size,
                    px + size + drift, (level + 1) * (size * 1.7), pz + size,
                    pick(COLOURS.timber, random),
                    0.98 + level * 0.06
                );
            }
            continue;
        }

        if (roll < 0.9) {
            const planks = 2 + Math.floor(random() * 3);
            for (let plank = 0; plank < planks; plank++) {
                const angle = random() * Math.PI;
                const length = 0.9 + random() * 1.4;
                const ex = px + Math.cos(angle) * length;
                const ez = pz + Math.sin(angle) * length;
                pushBox(
                    batch,
                    Math.min(px, ex) - 0.09, 0.04 + plank * 0.07, Math.min(pz, ez) - 0.09,
                    Math.max(px, ex) + 0.09, 0.14 + plank * 0.07, Math.max(pz, ez) + 0.09,
                    COLOURS.timber[plank % 2],
                    0.92
                );
            }
            continue;
        }

        const ashX = 0.7 + random() * 0.6;
        const ashZ = 0.6 + random() * 0.5;
        pushQuad(
            batch,
            px - ashX, 0.07, pz - ashZ,
            px - ashX, 0.07, pz + ashZ,
            px + ashX, 0.07, pz + ashZ,
            px + ashX, 0.07, pz - ashZ,
            0x24201b,
            0.9
        );
    }
}

function pushBuilding(batch: Batch, building: CityBuilding, colliders: THREE.Box3[]) {
    const random = rng(building.seed + 7919);
    const height = buildingHeight(building);
    const palette = building.style === 2 || building.style === 3 ? COLOURS.brick : COLOURS.plaster;
    const body = pick(palette, random);

    if (building.open && !building.rubble) {
        pushQuad(
            batch,
            building.x - building.w / 2, 0.04, building.z - building.d / 2,
            building.x + building.w / 2, 0.04, building.z - building.d / 2,
            building.x + building.w / 2, 0.04, building.z + building.d / 2,
            building.x - building.w / 2, 0.04, building.z + building.d / 2,
            COLOURS.interior,
            1
        );

        pushInterior(batch, building, random);
    }

    for (const wall of building.walls) {
        pushRaggedWall(batch, wall, height, building.ruin, random, body, !building.rubble, building.floors);

        colliders.push(new THREE.Box3(
            new THREE.Vector3(wall.minX, 0, wall.minZ),
            new THREE.Vector3(wall.maxX, Math.max(2.2, height), wall.maxZ)
        ));
    }

    if (building.style === 4 && !building.rubble) {
        const minX = building.x - building.w / 2 - 0.35;
        const maxX = building.x + building.w / 2 + 0.35;
        const minZ = building.z - building.d / 2 - 0.35;
        const maxZ = building.z + building.d / 2 + 0.35;
        const crownColour = pick(COLOURS.stone, random);

        pushBox(batch, minX, height, minZ, maxX, height + 0.6, maxZ, crownColour, 1.08);

        const merlons = Math.max(3, Math.floor((maxX - minX) / 1.7));
        for (let i = 0; i < merlons; i++) {
            if (random() < building.ruin * 0.6) continue;
            const t = (i + 0.5) / merlons;
            const px = minX + (maxX - minX) * t;
            const pz = minZ + (maxZ - minZ) * t;
            pushBox(batch, px - 0.55, height + 0.6, minZ, px + 0.55, height + 1.7, minZ + 0.7, crownColour, 1.12);
            pushBox(batch, px - 0.55, height + 0.6, maxZ - 0.7, px + 0.55, height + 1.7, maxZ, crownColour, 1.02);
            pushBox(batch, minX, height + 0.6, pz - 0.55, minX + 0.7, height + 1.7, pz + 0.55, crownColour, 1.06);
            pushBox(batch, maxX - 0.7, height + 0.6, pz - 0.55, maxX, height + 1.7, pz + 0.55, crownColour, 1.06);
        }
    }

    if (building.roof === 1) {
        pushGableRoof(batch, building, height, random);
    } else if (!building.rubble && building.ruin < 0.55 && random() < 0.5) {
        const beams = 2 + Math.floor(random() * 3);
        for (let i = 0; i < beams; i++) {
            const t = (i + 1) / (beams + 1);
            const z = building.z - building.d / 2 + building.d * t;
            pushBox(
                batch,
                building.x - building.w / 2, height - 0.5, z - 0.18,
                building.x + building.w / 2, height - 0.1, z + 0.18,
                pick(COLOURS.timber, random),
                1
            );
        }
    }

    if (building.ruin > 0.55) {
        const side = Math.floor(random() * 4);
        const px = side === 1 ? building.x + building.w / 2 + 1.6 : side === 3 ? building.x - building.w / 2 - 1.6 : building.x;
        const pz = side === 0 ? building.z - building.d / 2 - 1.6 : side === 2 ? building.z + building.d / 2 + 1.6 : building.z;
        pushRubblePile(batch, px, pz, 1.6 + random() * 1.4, random);
    }
}

function pushProp(batch: Batch, glow: Batch, kind: number, x: number, z: number, rot: number, scale: number, random: () => number) {
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const local = (lx: number, lz: number): [number, number] => [x + lx * cos - lz * sin, z + lx * sin + lz * cos];

    if (kind === 0) {
        const lit = random() < 0.55;
        pushBox(batch, x - 0.11 * scale, 0, z - 0.11 * scale, x + 0.11 * scale, 5 * scale, z + 0.11 * scale, COLOURS.stone[2], 0.8);
        pushBox(batch, x - 0.3 * scale, 5 * scale, z - 0.3 * scale, x + 0.3 * scale, 5.24 * scale, z + 0.3 * scale, COLOURS.stone[1], 1.05);

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const px = x + Math.cos(angle) * 0.26 * scale;
            const pz = z + Math.sin(angle) * 0.26 * scale;
            pushBox(batch, px - 0.05, 5.24 * scale, pz - 0.05, px + 0.05, 6.1 * scale, pz + 0.05, COLOURS.stone[2], 0.9);
        }
        pushBox(batch, x - 0.34 * scale, 6.1 * scale, z - 0.34 * scale, x + 0.34 * scale, 6.5 * scale, z + 0.34 * scale, COLOURS.stone[0], 1.15);

        if (lit) {
            pushBox(glow, x - 0.22 * scale, 5.3 * scale, z - 0.22 * scale, x + 0.22 * scale, 6.02 * scale, z + 0.22 * scale, COLOURS.lantern, 1);
        }
        return;
    }

    if (kind === 1) {
        for (let i = 0; i < 4; i++) {
            const lx = -1.6 + i * 1.05;
            const [px, pz] = local(lx * scale, 0);
            const lean = (random() - 0.5) * 0.5;
            pushBox(batch, px - 0.2, 0, pz - 0.16, px + 0.2, (1.5 + lean) * scale, pz + 0.16, pick(COLOURS.timber, random), 1);
        }
        const [bx, bz] = local(0, 0);
        pushBox(batch, bx - 1.9 * scale, 1.05 * scale, bz - 0.14, bx + 1.9 * scale, 1.3 * scale, bz + 0.14, COLOURS.timber[1], 1);
        return;
    }

    if (kind === 2) {
        const [bx, bz] = local(0, 0);
        pushBox(batch, bx - 1.5 * scale, 0.55 * scale, bz - 0.9 * scale, bx + 1.5 * scale, 1.25 * scale, bz + 0.9 * scale, COLOURS.timber[0], 1);
        for (const side of [-1, 1]) {
            const [wx, wz] = local(0.9 * scale, side * 1.0 * scale);
            pushBox(batch, wx - 0.7 * scale, 0, wz - 0.14, wx + 0.7 * scale, 1.4 * scale, wz + 0.14, COLOURS.timber[1], 0.9);
        }
        return;
    }

    if (kind === 3) {
        pushRubblePile(batch, x, z, 1.5 * scale, random);
        return;
    }

    if (kind === 4) {
        pushBox(batch, x - 0.32 * scale, 0, z - 0.32 * scale, x + 0.32 * scale, 3.6 * scale, z + 0.32 * scale, COLOURS.timber[1], 0.9);
        const branches = 3 + Math.floor(random() * 3);
        for (let i = 0; i < branches; i++) {
            const angle = random() * Math.PI * 2;
            const reach = (1.1 + random() * 1.3) * scale;
            const baseY = (2.1 + random() * 1.2) * scale;
            const ex = x + Math.cos(angle) * reach;
            const ez = z + Math.sin(angle) * reach;
            pushBox(
                batch,
                Math.min(x, ex) - 0.12, baseY, Math.min(z, ez) - 0.12,
                Math.max(x, ex) + 0.12, baseY + 0.7 * scale, Math.max(z, ez) + 0.12,
                COLOURS.timber[1],
                0.8
            );
        }
        return;
    }

    if (kind === 5) {
        pushBox(batch, x - 0.55 * scale, 0, z - 0.55 * scale, x + 0.55 * scale, 0.35 * scale, z + 0.55 * scale, COLOURS.stone[2], 0.9);
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const px = x + Math.cos(angle) * 0.42 * scale;
            const pz = z + Math.sin(angle) * 0.42 * scale;
            pushBox(batch, px - 0.11, 0.3 * scale, pz - 0.11, px + 0.11, 1.35 * scale, pz + 0.11, COLOURS.stone[0], 1);
        }
        pushBox(batch, x - 0.62 * scale, 1.3 * scale, z - 0.62 * scale, x + 0.62 * scale, 1.66 * scale, z + 0.62 * scale, COLOURS.stone[1], 1.15);
        pushBox(glow, x - 0.44 * scale, 1.62 * scale, z - 0.44 * scale, x + 0.44 * scale, 2.05 * scale, z + 0.44 * scale, COLOURS.ember, 1);
        return;
    }

    const [px, pz] = local(0, 0);
    pushBox(batch, px - 1.7 * scale, 0.42 * scale, pz - 0.28 * scale, px + 1.7 * scale, 0.58 * scale, pz + 0.28 * scale, COLOURS.timber[0], 1);
    pushBox(batch, px - 1.7 * scale, 0.58 * scale, pz - 0.3 * scale, px + 1.7 * scale, 1.35 * scale, pz - 0.14 * scale, COLOURS.timber[1], 0.95);
    for (const side of [-1.5, 1.5]) {
        pushBox(batch, px + side * scale - 0.14, 0, pz - 0.24 * scale, px + side * scale + 0.14, 0.45 * scale, pz + 0.24 * scale, COLOURS.timber[1], 0.85);
    }
}

function pushCathedral(batch: Batch, glass: Batch, colliders: THREE.Box3[]) {
    const random = rng(20260828);
    const c = CITY_CATHEDRAL;
    const stone = COLOURS.cathedral;
    const dark = COLOURS.cathedralDark;

    pushQuad(batch, c.minX, 0.05, c.minZ, c.maxX, 0.05, c.minZ, c.maxX, 0.05, c.maxZ, c.minX, 0.05, c.maxZ, 0x2b2721, 1);

    for (const wall of CITY_CATHEDRAL_WALLS) {
        const alongX = wall.maxX - wall.minX >= wall.maxZ - wall.minZ;
        const height = CATHEDRAL_HEIGHT;
        pushRaggedWall(batch, wall, height, 0.22, random, stone, false, 1);

        colliders.push(new THREE.Box3(
            new THREE.Vector3(wall.minX, 0, wall.minZ),
            new THREE.Vector3(wall.maxX, height, wall.maxZ)
        ));

        const length = alongX ? wall.maxX - wall.minX : wall.maxZ - wall.minZ;
        const windows = Math.max(1, Math.floor(length / 11));

        for (let i = 0; i < windows; i++) {
            const t = (i + 0.5) / windows;
            const halfW = 1.7;
            const sill = 9.5;
            const top = 24;

            if (alongX) {
                const cx = wall.minX + length * t;
                if (cx - halfW < wall.minX || cx + halfW > wall.maxX) continue;
                pushQuad(glass, cx - halfW, sill, wall.minZ - 0.05, cx + halfW, sill, wall.minZ - 0.05, cx + halfW, top, wall.minZ - 0.05, cx - halfW, top, wall.minZ - 0.05, 0x2f6f96, 1);
                pushQuad(glass, cx + halfW, sill, wall.maxZ + 0.05, cx - halfW, sill, wall.maxZ + 0.05, cx - halfW, top, wall.maxZ + 0.05, cx + halfW, top, wall.maxZ + 0.05, 0x2f6f96, 1);
            } else {
                const cz = wall.minZ + length * t;
                if (cz - halfW < wall.minZ || cz + halfW > wall.maxZ) continue;
                pushQuad(glass, wall.minX - 0.05, sill, cz + halfW, wall.minX - 0.05, sill, cz - halfW, wall.minX - 0.05, top, cz - halfW, wall.minX - 0.05, top, cz + halfW, 0x2f6f96, 1);
                pushQuad(glass, wall.maxX + 0.05, sill, cz - halfW, wall.maxX + 0.05, sill, cz + halfW, wall.maxX + 0.05, top, cz + halfW, wall.maxX + 0.05, top, cz - halfW, 0x2f6f96, 1);
            }
        }
    }

    for (let i = 0; i < 7; i++) {
        const z = c.minZ + 9 + i * 12;
        if (z > c.maxZ - 6) break;

        for (const side of [-1, 1]) {
            const inner = side < 0 ? c.minX : c.maxX;
            const outer = inner + side * 5.4;
            const lo = Math.min(inner, outer);
            const hi = Math.max(inner, outer);

            pushBox(batch, lo, 0, z - 1.5, hi, 11, z + 1.5, stone, 0.95);
            pushBox(batch, lo, 11, z - 1.2, lo + 3.2, 15.5, z + 1.2, stone, 1.02);
            pushBox(batch, side < 0 ? c.minX - 2.4 : c.maxX - 0.6, 15.5, z - 1.0, side < 0 ? c.minX + 0.6 : c.maxX + 2.4, 24.5, z + 1.0, stone, 1.05);
            pushBox(batch, lo - 0.4, 24.5, z - 1.6, hi + 0.4, 26, z + 1.6, dark, 1.1);
            pushBox(batch, lo + 0.6, 26, z - 0.9, lo + 2.4, 30.5, z + 0.9, stone, 1.14);
        }
    }

    for (const column of CITY_CATHEDRAL_COLUMNS) {
        const sides = 8;
        for (let i = 0; i < sides; i++) {
            const a0 = (i / sides) * Math.PI * 2;
            const a1 = ((i + 1) / sides) * Math.PI * 2;
            const x0 = column.x + Math.cos(a0) * column.r;
            const z0 = column.z + Math.sin(a0) * column.r;
            const x1 = column.x + Math.cos(a1) * column.r;
            const z1 = column.z + Math.sin(a1) * column.r;
            pushQuad(batch, x0, 0, z0, x1, 0, z1, x1, 20.5, z1, x0, 20.5, z0, stone, 0.88 + (i % 3) * 0.08);
        }
        pushBox(batch, column.x - column.r - 0.5, 0, column.z - column.r - 0.5, column.x + column.r + 0.5, 0.9, column.z + column.r + 0.5, dark, 1);
        pushBox(batch, column.x - column.r - 0.6, 20.5, column.z - column.r - 0.6, column.x + column.r + 0.6, 22.4, column.z + column.r + 0.6, dark, 1.12);

        colliders.push(new THREE.Box3(
            new THREE.Vector3(column.x - column.r, 0, column.z - column.r),
            new THREE.Vector3(column.x + column.r, 22.4, column.z + column.r)
        ));
    }

    for (let i = 0; i + 2 < CITY_CATHEDRAL_COLUMNS.length; i++) {
        const a = CITY_CATHEDRAL_COLUMNS[i];
        const b = CITY_CATHEDRAL_COLUMNS[i + 2];
        if (Math.abs(a.x - b.x) > 0.5) continue;
        pushBox(batch, a.x - 0.8, 22.4, Math.min(a.z, b.z), a.x + 0.8, 24, Math.max(a.z, b.z), dark, 1.05);
    }

    const vaultFrom = c.maxZ - 36;
    for (let z = vaultFrom; z < c.maxZ - 2; z += 4) {
        pushBox(batch, c.minX + 1.5, 25.5, z, c.maxX - 1.5, 26.8, z + 1.6, dark, 1.02);
        pushQuad(batch, c.minX + 1.5, 25.4, z + 4, c.maxX - 1.5, 25.4, z + 4, c.maxX - 1.5, 25.4, z, c.minX + 1.5, 25.4, z, 0x322c28, 1);
    }

    for (const side of [-1, 1]) {
        const towerX = c.x + side * 15.5;
        const towerZ = c.maxZ - 3.5;
        const broken = side < 0 ? CATHEDRAL_TOWER_HEIGHT : CATHEDRAL_TOWER_HEIGHT - 17;

        for (let level = 0; level < 6; level++) {
            const y0 = level * (broken / 6);
            const y1 = (level + 1) * (broken / 6);
            const inset = level * 0.3;
            pushBox(batch, towerX - 5.4 + inset, y0, towerZ - 5.4 + inset, towerX + 5.4 - inset, y1, towerZ + 5.4 - inset, stone, level % 2 === 0 ? 1 : 0.94);
        }
        pushBox(batch, towerX - 5.9, broken, towerZ - 5.9, towerX + 5.9, broken + 1.3, towerZ + 5.9, dark, 1.14);

        if (side > 0) {
            pushRubblePile(batch, towerX + 7, towerZ + 6, 3.4, random);
        } else {
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                pushBox(
                    batch,
                    towerX + Math.cos(angle) * 4.2 - 0.55, broken + 1.3, towerZ + Math.sin(angle) * 4.2 - 0.55,
                    towerX + Math.cos(angle) * 4.2 + 0.55, broken + 4.2, towerZ + Math.sin(angle) * 4.2 + 0.55,
                    stone,
                    1.08
                );
            }

            const spireBase = broken + 4.2;
            const spireTop = spireBase + 15;
            for (let i = 0; i < 8; i++) {
                const a0 = (i / 8) * Math.PI * 2;
                const a1 = ((i + 1) / 8) * Math.PI * 2;
                pushTri(
                    batch,
                    towerX + Math.cos(a0) * 4, spireBase, towerZ + Math.sin(a0) * 4,
                    towerX + Math.cos(a1) * 4, spireBase, towerZ + Math.sin(a1) * 4,
                    towerX, spireTop, towerZ,
                    COLOURS.roof[1],
                    0.9 + (i % 3) * 0.1
                );
            }
        }

        for (let level = 1; level < 4; level++) {
            const y = level * (broken / 5) + 1.6;
            pushQuad(glass, towerX - 1.1, y, towerZ + 5.3, towerX + 1.1, y, towerZ + 5.3, towerX + 1.1, y + 2.6, towerZ + 5.3, towerX - 1.1, y + 2.6, towerZ + 5.3, 0x2b6488, 1);
        }
    }

    const doorHalf = CITY_CATHEDRAL_DOOR.w / 2;
    pushBox(batch, c.x - doorHalf - 1.6, 0, c.maxZ - 0.3, c.x + doorHalf + 1.6, 11.5, c.maxZ + 2.2, stone, 1.06);
    pushQuad(batch, c.x - doorHalf, 0, c.maxZ + 2.25, c.x + doorHalf, 0, c.maxZ + 2.25, c.x + doorHalf, 9, c.maxZ + 2.25, c.x - doorHalf, 9, c.maxZ + 2.25, 0x120f0d, 1);

    const roseY = 20.5;
    const roseR = 6.2;
    const petals = 14;
    for (let i = 0; i < petals; i++) {
        const a0 = (i / petals) * Math.PI * 2;
        const a1 = ((i + 1) / petals) * Math.PI * 2;
        pushTri(
            glass,
            c.x, roseY, c.maxZ + 0.06,
            c.x + Math.cos(a0) * roseR, roseY + Math.sin(a0) * roseR, c.maxZ + 0.06,
            c.x + Math.cos(a1) * roseR, roseY + Math.sin(a1) * roseR, c.maxZ + 0.06,
            i % 3 === 0 ? 0xc07a24 : i % 3 === 1 ? 0x2f6f96 : 0x7a3fa0,
            1
        );
        pushBox(
            batch,
            c.x + Math.cos(a0) * roseR - 0.2, roseY + Math.sin(a0) * roseR - 0.2, c.maxZ - 0.1,
            c.x + Math.cos(a0) * roseR + 0.2, roseY + Math.sin(a0) * roseR + 0.2, c.maxZ + 0.35,
            dark,
            1.1
        );
    }
    for (let i = 0; i < 28; i++) {
        const a0 = (i / 28) * Math.PI * 2;
        const a1 = ((i + 1) / 28) * Math.PI * 2;
        pushQuad(
            batch,
            c.x + Math.cos(a0) * (roseR + 0.5), roseY + Math.sin(a0) * (roseR + 0.5), c.maxZ + 0.1,
            c.x + Math.cos(a1) * (roseR + 0.5), roseY + Math.sin(a1) * (roseR + 0.5), c.maxZ + 0.1,
            c.x + Math.cos(a1) * (roseR + 1.3), roseY + Math.sin(a1) * (roseR + 1.3), c.maxZ + 0.1,
            c.x + Math.cos(a0) * (roseR + 1.3), roseY + Math.sin(a0) * (roseR + 1.3), c.maxZ + 0.1,
            dark,
            1.08
        );
    }

    const apseZ = c.minZ;
    const apseR = 17;
    for (let i = 0; i < 9; i++) {
        const a0 = Math.PI + (i / 9) * Math.PI;
        const a1 = Math.PI + ((i + 1) / 9) * Math.PI;
        const x0 = c.x + Math.cos(a0) * apseR;
        const z0 = apseZ + Math.sin(a0) * apseR * 0.55;
        const x1 = c.x + Math.cos(a1) * apseR;
        const z1 = apseZ + Math.sin(a1) * apseR * 0.55;
        const height = 24 - Math.abs(4 - i) * 1.1;
        pushQuad(batch, x0, 0, z0, x1, 0, z1, x1, height, z1, x0, height, z0, stone, 0.9 + (i % 2) * 0.12);
    }

    const dais = { x: c.x, z: c.minZ + 13 };
    for (let step = 0; step < 3; step++) {
        const size = 7.5 - step * 1.7;
        pushBox(batch, dais.x - size, step * 0.32, dais.z - size, dais.x + size, (step + 1) * 0.32, dais.z + size, dark, 1 + step * 0.06);
    }

    pushRubblePile(batch, c.x - 12, c.z + 16, 3.2, random);
    pushRubblePile(batch, c.x + 13, c.z - 8, 2.8, random);
    pushRubblePile(batch, c.x + 4, c.minZ + 40, 2.4, random);

    for (let row = 0; row < 9; row++) {
        const z = c.minZ + 30 + row * 5.2;
        if (z > c.maxZ - 8) break;
        for (const side of [-1, 1]) {
            if (random() < 0.24) continue;
            const px = c.x + side * 7.5;
            const lean = (random() - 0.5) * 0.4;
            pushBox(batch, px - 4, 0.35, z - 0.6, px + 4, 0.75 + lean, z + 0.6, COLOURS.timber[0], 0.95);
            pushBox(batch, px - 4, 0.75, z - 0.62, px + 4, 1.75 + lean, z - 0.35, COLOURS.timber[1], 0.9);
        }
    }
}

function buildGround(): THREE.BufferGeometry {
    const batch = makeBatch();
    const rings = [0, 0.32, 0.58, 0.78, 0.92, 1];
    const random = rng(4242);

    for (let ring = 0; ring < rings.length - 1; ring++) {
        for (let i = 0; i < CITY_BOUNDARY.length; i++) {
            const p = CITY_BOUNDARY[i];
            const q = CITY_BOUNDARY[(i + 1) % CITY_BOUNDARY.length];
            const t0 = rings[ring];
            const t1 = rings[ring + 1];
            const shade = 0.88 + random() * 0.2;
            const colour = random() < 0.28 ? COLOURS.cobbleDark : COLOURS.cobble;

            pushQuad(
                batch,
                p.x * t0, 0, p.z * t0,
                q.x * t0, 0, q.z * t0,
                q.x * t1, 0, q.z * t1,
                p.x * t1, 0, p.z * t1,
                colour,
                shade
            );
        }
    }

    return toGeometry(batch);
}

function buildRim(): THREE.BufferGeometry {
    const batch = makeBatch();
    const random = rng(90210);
    const count = CITY_BOUNDARY.length;

    for (let i = 0; i < count; i++) {
        const p = CITY_BOUNDARY[i];
        const q = CITY_BOUNDARY[(i + 1) % count];

        const teeth = 3;
        for (let k = 0; k < teeth; k++) {
            const t0 = k / teeth;
            const t1 = (k + 1) / teeth;
            const ax = p.x + (q.x - p.x) * t0;
            const az = p.z + (q.z - p.z) * t0;
            const bx = p.x + (q.x - p.x) * t1;
            const bz = p.z + (q.z - p.z) * t1;

            const dropA = CITY_RIM_DROP * (0.35 + random() * 0.65);
            const dropB = CITY_RIM_DROP * (0.35 + random() * 0.65);
            const shrink = 0.982 + random() * 0.02;

            pushQuad(
                batch,
                ax, 0.05, az,
                bx, 0.05, bz,
                bx * shrink, -dropB, bz * shrink,
                ax * shrink, -dropA, az * shrink,
                COLOURS.rim,
                1
            );
            pushQuad(
                batch,
                bx, 0.05, bz,
                ax, 0.05, az,
                ax * shrink, -dropA, az * shrink,
                bx * shrink, -dropB, bz * shrink,
                COLOURS.rim,
                0.7
            );

            const lipHeight = 0.7 + random() * 1.9;
            pushQuad(
                batch,
                ax, 0.05, az,
                bx, 0.05, bz,
                bx, lipHeight, bz,
                ax, lipHeight, az,
                COLOURS.rimGlow,
                0.55
            );
        }
    }

    return toGeometry(batch);
}

export function buildCityMesh(): CityMeshResult {
    const colliders: THREE.Box3[] = [];
    const batches = new Map<string, Batch>();
    const bounds = new Map<string, { minX: number; maxX: number; minZ: number; maxZ: number }>();

    const chunkKey = (x: number, z: number) => `${Math.floor(x / CITY_CHUNK)}|${Math.floor(z / CITY_CHUNK)}`;

    const batchAt = (x: number, z: number) => {
        const key = chunkKey(x, z);
        let batch = batches.get(key);
        if (!batch) {
            batch = makeBatch();
            batches.set(key, batch);
            bounds.set(key, { minX: x, maxX: x, minZ: z, maxZ: z });
        }
        const box = bounds.get(key)!;
        if (x < box.minX) box.minX = x;
        if (x > box.maxX) box.maxX = x;
        if (z < box.minZ) box.minZ = z;
        if (z > box.maxZ) box.maxZ = z;
        return batch;
    };

    for (const building of [...CITY_BUILDINGS, ...CITY_EDGE_RUINS]) {
        const batch = batchAt(building.x, building.z);
        const box = bounds.get(chunkKey(building.x, building.z))!;
        box.minX = Math.min(box.minX, building.x - building.w / 2);
        box.maxX = Math.max(box.maxX, building.x + building.w / 2);
        box.minZ = Math.min(box.minZ, building.z - building.d / 2);
        box.maxZ = Math.max(box.maxZ, building.z + building.d / 2);
        pushBuilding(batch, building, colliders);
    }

    const landmarkBatch = makeBatch();
    const glassBatch = makeBatch();

    const propRandom = rng(31337);
    for (const prop of CITY_PROPS) {
        pushProp(batchAt(prop.x, prop.z), glassBatch, prop.kind, prop.x, prop.z, prop.rot, prop.scale, propRandom);
    }

    const lampAnchors: THREE.Vector3[] = [];
    for (const lamp of CITY_LAMPS) {
        pushProp(batchAt(lamp.x, lamp.z), glassBatch, 0, lamp.x, lamp.z, 0, 1.1, propRandom);
        lampAnchors.push(new THREE.Vector3(lamp.x, 6.1, lamp.z));
    }

    pushCathedral(landmarkBatch, glassBatch, colliders);

    for (const block of CITY_CATHEDRAL_BLOCKS) {
        colliders.push(new THREE.Box3(
            new THREE.Vector3(block.minX, 0, block.minZ),
            new THREE.Vector3(block.maxX, 26, block.maxZ)
        ));
    }

    const chunks: CityChunk[] = [];
    for (const [key, batch] of batches) {
        if (batch.position.length === 0) continue;
        const box = bounds.get(key)!;
        const cx = (box.minX + box.maxX) / 2;
        const cz = (box.minZ + box.maxZ) / 2;
        const radius = Math.max(
            CITY_CHUNK * 0.75,
            Math.hypot(box.maxX - box.minX, box.maxZ - box.minZ) / 2 + 6
        );
        chunks.push({ x: cx, z: cz, radius, geometry: toGeometry(batch) });
    }

    const brazierAnchors: THREE.Vector3[] = [];
    for (const prop of CITY_PROPS) {
        if (prop.kind !== 5) continue;
        brazierAnchors.push(new THREE.Vector3(prop.x, 1.9 * prop.scale, prop.z));
    }

    return {
        chunks,
        landmark: toGeometry(landmarkBatch),
        glass: toGeometry(glassBatch),
        ground: buildGround(),
        rim: buildRim(),
        colliders,
        lampAnchors,
        brazierAnchors,
    };
}
