// scripts/gen-influence-city.mjs
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(here, "../src/features/game/world/locations/influence/cityLayout.ts");

const SEED = 0x5ea7c17d;

const CITY_RADIUS = 250;
const BOUNDARY_POINTS = 72;
const BOUNDARY_AMPLITUDE = 26;
const BOUNDARY_MIN = 206;
const BUILD_MARGIN = 16;

const BLOCK_PITCH = 38;
const BLOCK_SPAN = 30;
const BLOCK_RANGE = 7;

const CATHEDRAL_X = 0;
const CATHEDRAL_Z = -62;
const CATHEDRAL_W = 44;
const CATHEDRAL_D = 84;
const CATHEDRAL_WALL = 2.4;
const PLAZA_RADIUS = 66;

const SPAWN_RADIUS = 196;
const SPAWN_COUNT = 4;

const LOOT_CHANCE = 0.22;
const LOOT_RARE_CHANCE = 0.18;

const ZOMBIE_TARGET = 145;
const SIEGE_GATE_COUNT = 8;

function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const rand = mulberry32(SEED);
const round = (value, places = 1) => Number(value.toFixed(places));
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (min, max) => min + rand() * (max - min);
const chance = (p) => rand() < p;

function boundaryRadiusAt(angle) {
    const wobble =
        Math.sin(angle * 3 + 0.7) * 0.44 +
        Math.sin(angle * 7 - 1.9) * 0.3 +
        Math.sin(angle * 13 + 2.4) * 0.16 +
        Math.sin(angle * 23 - 0.6) * 0.1;

    return Math.max(BOUNDARY_MIN, CITY_RADIUS + wobble * BOUNDARY_AMPLITUDE);
}

const boundary = [];
for (let i = 0; i < BOUNDARY_POINTS; i++) {
    const angle = (i / BOUNDARY_POINTS) * Math.PI * 2;
    const radius = boundaryRadiusAt(angle);
    boundary.push({ x: round(Math.cos(angle) * radius), z: round(Math.sin(angle) * radius) });
}

function insideBoundary(x, z, margin) {
    const angle = Math.atan2(z, x);
    return Math.hypot(x, z) <= boundaryRadiusAt(angle) - margin;
}

const cathedral = {
    x: CATHEDRAL_X,
    z: CATHEDRAL_Z,
    w: CATHEDRAL_W,
    d: CATHEDRAL_D,
    minX: CATHEDRAL_X - CATHEDRAL_W / 2,
    maxX: CATHEDRAL_X + CATHEDRAL_W / 2,
    minZ: CATHEDRAL_Z - CATHEDRAL_D / 2,
    maxZ: CATHEDRAL_Z + CATHEDRAL_D / 2,
};

const DOOR_WIDTH = 11;

const cathedralWalls = [
    { minX: cathedral.minX, maxX: cathedral.minX + CATHEDRAL_WALL, minZ: cathedral.minZ, maxZ: cathedral.maxZ },
    { minX: cathedral.maxX - CATHEDRAL_WALL, maxX: cathedral.maxX, minZ: cathedral.minZ, maxZ: cathedral.maxZ },
    { minX: cathedral.minX, maxX: cathedral.maxX, minZ: cathedral.minZ, maxZ: cathedral.minZ + CATHEDRAL_WALL },
    { minX: cathedral.minX, maxX: cathedral.x - DOOR_WIDTH / 2, minZ: cathedral.maxZ - CATHEDRAL_WALL, maxZ: cathedral.maxZ },
    { minX: cathedral.x + DOOR_WIDTH / 2, maxX: cathedral.maxX, minZ: cathedral.maxZ - CATHEDRAL_WALL, maxZ: cathedral.maxZ },
];

const CATHEDRAL_TOWER_HALF = 5.4;
const CATHEDRAL_BUTTRESS_REACH = 5.4;

const cathedralBlocks = [];

for (const side of [-1, 1]) {
    const towerX = cathedral.x + side * 15.5;
    const towerZ = cathedral.maxZ - 3.5;
    cathedralBlocks.push({
        minX: round(towerX - CATHEDRAL_TOWER_HALF, 2),
        maxX: round(towerX + CATHEDRAL_TOWER_HALF, 2),
        minZ: round(towerZ - CATHEDRAL_TOWER_HALF, 2),
        maxZ: round(towerZ + CATHEDRAL_TOWER_HALF, 2),
    });
}

for (let i = 0; i < 7; i++) {
    const z = cathedral.minZ + 9 + i * 12;
    if (z > cathedral.maxZ - 6) break;

    for (const side of [-1, 1]) {
        const inner = side < 0 ? cathedral.minX : cathedral.maxX;
        const outer = inner + side * CATHEDRAL_BUTTRESS_REACH;
        cathedralBlocks.push({
            minX: round(Math.min(inner, outer), 2),
            maxX: round(Math.max(inner, outer), 2),
            minZ: round(z - 1.5, 2),
            maxZ: round(z + 1.5, 2),
        });
    }
}

for (let i = 0; i < 3; i++) {
    const width = 17 - i * 5;
    const depth = 9.35 * (0.4 + i * 0.3);
    cathedralBlocks.push({
        minX: round(cathedral.x - width, 2),
        maxX: round(cathedral.x + width, 2),
        minZ: round(cathedral.minZ - depth, 2),
        maxZ: round(cathedral.minZ, 2),
    });
}

const cathedralColumns = [];
for (let row = 0; row < 6; row++) {
    const z = cathedral.minZ + 18 + row * 12.5;
    cathedralColumns.push({ x: cathedral.x - 13, z: round(z), r: 1.6 });
    cathedralColumns.push({ x: cathedral.x + 13, z: round(z), r: 1.6 });
}

const cathedralDoor = { x: cathedral.x, z: cathedral.maxZ, w: DOOR_WIDTH };
const spawnSeed = { x: cathedral.x, z: round(cathedral.maxZ + 7) };
const crystal = { x: cathedral.x, z: round(cathedral.minZ + 13) };
const bossSpawn = { x: cathedral.x, z: round(cathedral.minZ + 30) };
const bossArena = { x: cathedral.x, z: round(cathedral.z + 4), radius: 40 };

const BUILDING_STYLES = [
    { key: "tenement", minW: 11, maxW: 16, minD: 11, maxD: 17, minFloors: 3, maxFloors: 5, weight: 26 },
    { key: "townhouse", minW: 10, maxW: 14, minD: 12, maxD: 18, minFloors: 2, maxFloors: 3, weight: 24 },
    { key: "shopfront", minW: 13, maxW: 19, minD: 9, maxD: 13, minFloors: 1, maxFloors: 2, weight: 18 },
    { key: "warehouse", minW: 17, maxW: 26, minD: 14, maxD: 22, minFloors: 1, maxFloors: 3, weight: 12 },
    { key: "spire", minW: 9, maxW: 13, minD: 9, maxD: 13, minFloors: 5, maxFloors: 9, weight: 11 },
    { key: "husk", minW: 12, maxW: 20, minD: 11, maxD: 18, minFloors: 1, maxFloors: 3, weight: 10 },
];

const STYLE_INDEX = Object.fromEntries(BUILDING_STYLES.map((style, index) => [style.key, index]));
const STYLE_BAG = BUILDING_STYLES.flatMap((style, index) => Array(style.weight).fill(index));

function overlapsCathedral(minX, maxX, minZ, maxZ) {
    const pad = 9;
    return (
        maxX > cathedral.minX - pad &&
        minX < cathedral.maxX + pad &&
        maxZ > cathedral.minZ - pad &&
        minZ < cathedral.maxZ + pad
    );
}

function inPlaza(x, z) {
    return Math.hypot(x - cathedral.x, z - cathedral.z) < PLAZA_RADIUS;
}

const buildings = [];
const placed = [];

function rectsOverlap(a, b, gap) {
    return (
        a.maxX + gap > b.minX &&
        a.minX - gap < b.maxX &&
        a.maxZ + gap > b.minZ &&
        a.minZ - gap < b.maxZ
    );
}

function tryPlace(cx, cz, w, d, styleIndex) {
    const minX = cx - w / 2;
    const maxX = cx + w / 2;
    const minZ = cz - d / 2;
    const maxZ = cz + d / 2;

    if (!insideBoundary(minX, minZ, BUILD_MARGIN)) return null;
    if (!insideBoundary(maxX, minZ, BUILD_MARGIN)) return null;
    if (!insideBoundary(minX, maxZ, BUILD_MARGIN)) return null;
    if (!insideBoundary(maxX, maxZ, BUILD_MARGIN)) return null;
    if (overlapsCathedral(minX, maxX, minZ, maxZ)) return null;

    const box = { minX, maxX, minZ, maxZ };
    for (const other of placed) {
        if (rectsOverlap(box, other, 1.1)) return null;
    }

    placed.push(box);

    const style = BUILDING_STYLES[styleIndex];
    const distanceFromCore = Math.hypot(cx, cz) / CITY_RADIUS;
    const ruin = Math.min(1, Math.max(0, between(0.05, 0.5) + distanceFromCore * 0.42));
    const collapsed = style.key === "husk" || ruin > 0.78;

    return {
        id: `b${String(buildings.length).padStart(3, "0")}`,
        x: round(cx),
        z: round(cz),
        w: round(w),
        d: round(d),
        floors: Math.max(1, Math.round(between(style.minFloors, style.maxFloors))),
        style: styleIndex,
        ruin: round(collapsed ? Math.max(ruin, 0.8) : ruin, 2),
        door: Math.floor(rand() * 4),
        seed: Math.floor(rand() * 65536),
        loot: null,
    };
}

const blockCentres = [];
for (let ix = -BLOCK_RANGE; ix <= BLOCK_RANGE; ix++) {
    for (let iz = -BLOCK_RANGE; iz <= BLOCK_RANGE; iz++) {
        const cx = ix * BLOCK_PITCH;
        const cz = iz * BLOCK_PITCH;
        if (!insideBoundary(cx, cz, BUILD_MARGIN + 6)) continue;
        if (inPlaza(cx, cz)) continue;
        blockCentres.push({ cx, cz, ix, iz });
    }
}

const PARCEL_GAP = 1.4;

for (const block of blockCentres) {
    const roll = rand();
    const parcels = roll < 0.15 ? 1 : roll < 0.45 ? 2 : roll < 0.8 ? 3 : 4;
    const half = BLOCK_SPAN / 2;
    const quarter = BLOCK_SPAN / 4;

    const slots =
        parcels === 1
            ? [{ ox: 0, oz: 0, sw: BLOCK_SPAN, sd: BLOCK_SPAN }]
            : parcels === 2
                ? chance(0.5)
                    ? [
                        { ox: -quarter, oz: 0, sw: half, sd: BLOCK_SPAN },
                        { ox: quarter, oz: 0, sw: half, sd: BLOCK_SPAN },
                    ]
                    : [
                        { ox: 0, oz: -quarter, sw: BLOCK_SPAN, sd: half },
                        { ox: 0, oz: quarter, sw: BLOCK_SPAN, sd: half },
                    ]
                : [
                    { ox: -quarter, oz: -quarter, sw: half, sd: half },
                    { ox: quarter, oz: -quarter, sw: half, sd: half },
                    { ox: -quarter, oz: quarter, sw: half, sd: half },
                    { ox: quarter, oz: quarter, sw: half, sd: half },
                ].slice(0, parcels);

    for (const slot of slots) {
        const maxW = slot.sw - PARCEL_GAP;
        const maxD = slot.sd - PARCEL_GAP;
        if (maxW < 7.5 || maxD < 7.5) continue;

        const styleIndex = pick(STYLE_BAG);
        const style = BUILDING_STYLES[styleIndex];

        let w = between(Math.min(style.minW, maxW), Math.min(style.maxW, maxW));
        let d = between(Math.min(style.minD, maxD), Math.min(style.maxD, maxD));
        if (chance(0.5) && d <= maxW && w <= maxD) [w, d] = [d, w];

        w = Math.min(w, maxW);
        d = Math.min(d, maxD);
        if (w < 7.5 || d < 7.5) continue;

        const jitterX = between(-1, 1) * Math.max(0, (maxW - w) / 2);
        const jitterZ = between(-1, 1) * Math.max(0, (maxD - d) / 2);
        const building = tryPlace(block.cx + slot.ox + jitterX, block.cz + slot.oz + jitterZ, w, d, styleIndex);
        if (building) buildings.push(building);
    }
}

const edgeRuins = [];
for (let i = 0; i < 46; i++) {
    const angle = (i / 46) * Math.PI * 2 + rand() * 0.06;
    const radius = boundaryRadiusAt(angle) - between(9, 17);
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;

    const w = between(10, 18);
    const d = between(9, 16);
    const box = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
    if (placed.some((other) => rectsOverlap(box, other, 2))) continue;
    if (overlapsCathedral(box.minX, box.maxX, box.minZ, box.maxZ)) continue;

    placed.push(box);
    edgeRuins.push({
        id: `e${String(edgeRuins.length).padStart(3, "0")}`,
        x: round(cx),
        z: round(cz),
        w: round(w),
        d: round(d),
        floors: Math.round(between(1, 4)),
        style: STYLE_INDEX.husk,
        ruin: 1,
        door: Math.floor(rand() * 4),
        seed: Math.floor(rand() * 65536),
        loot: null,
        cut: round(Math.atan2(cz, cx), 3),
    });
}

const loot = [];
for (const building of buildings) {
    if (building.ruin > 0.86) continue;
    if (!chance(LOOT_CHANCE)) continue;

    const tier = chance(LOOT_RARE_CHANCE) ? 2 : 1;
    const id = `c${String(loot.length).padStart(3, "0")}`;
    const inset = 2.6;

    loot.push({
        id,
        x: round(building.x + between(-building.w / 2 + inset, building.w / 2 - inset)),
        z: round(building.z + between(-building.d / 2 + inset, building.d / 2 - inset)),
        tier,
        building: building.id,
    });
    building.loot = id;
}

const WALL_T = 1.1;
const DOOR_W = 3.6;
const FLOOR_HEIGHT = 3.6;

function spanRects(along, fixedLo, fixedHi, lo, hi, gaps) {
    const out = [];
    const sorted = gaps.slice().sort((a, b) => a[0] - b[0]);
    let cursor = lo;

    for (const [gapLo, gapHi] of sorted) {
        if (gapLo > cursor + 0.35) {
            out.push(along === "x"
                ? { minX: round(cursor, 2), maxX: round(gapLo, 2), minZ: round(fixedLo, 2), maxZ: round(fixedHi, 2) }
                : { minX: round(fixedLo, 2), maxX: round(fixedHi, 2), minZ: round(cursor, 2), maxZ: round(gapLo, 2) });
        }
        cursor = Math.max(cursor, gapHi);
    }

    if (cursor < hi - 0.35) {
        out.push(along === "x"
            ? { minX: round(cursor, 2), maxX: round(hi, 2), minZ: round(fixedLo, 2), maxZ: round(fixedHi, 2) }
            : { minX: round(fixedLo, 2), maxX: round(fixedHi, 2), minZ: round(cursor, 2), maxZ: round(hi, 2) });
    }

    return out;
}

function buildWalls(building, localRand) {
    const minX = building.x - building.w / 2;
    const maxX = building.x + building.w / 2;
    const minZ = building.z - building.d / 2;
    const maxZ = building.z + building.d / 2;
    const T = WALL_T;

    const sideGaps = [[], [], [], []];

    const gapOn = (side, width) => {
        const lo = side === 0 || side === 2 ? minX + T : minZ + T;
        const hi = side === 0 || side === 2 ? maxX - T : maxZ - T;
        const span = hi - lo;
        if (span <= width + 1) return;
        const start = lo + 0.5 + localRand() * (span - width - 1);
        sideGaps[side].push([start, start + width]);
    };

    gapOn(building.door, building.loot ? DOOR_W + 1.6 : DOOR_W);

    if (building.ruin > 0.42) {
        const breachSide = (building.door + 1 + Math.floor(localRand() * 3)) % 4;
        gapOn(breachSide, 4.5 + localRand() * 4);
    }
    if (building.ruin > 0.66) {
        const breachSide = Math.floor(localRand() * 4);
        gapOn(breachSide, 3.5 + localRand() * 5);
    }

    const walls = [];
    walls.push(...spanRects("x", minZ, minZ + T, minX + T, maxX - T, sideGaps[0]));
    walls.push(...spanRects("z", maxX - T, maxX, minZ, maxZ, sideGaps[1]));
    walls.push(...spanRects("x", maxZ - T, maxZ, minX + T, maxX - T, sideGaps[2]));
    walls.push(...spanRects("z", minX, minX + T, minZ, maxZ, sideGaps[3]));

    if (building.loot) {
        return walls.filter((rect) => rect.maxX - rect.minX > 0.3 && rect.maxZ - rect.minZ > 0.3);
    }

    if (building.w > 17 && building.d > 12 && building.ruin < 0.7) {
        const px = building.x + between(-2, 2);
        const gapStart = minZ + T + 0.8 + localRand() * Math.max(0.1, building.d - 2 * T - 5.4);
        walls.push(...spanRects("z", px - 0.5, px + 0.5, minZ + T, maxZ - T, [[gapStart, gapStart + 3.4]]));
    } else if (building.d > 17 && building.w > 12 && building.ruin < 0.7) {
        const pz = building.z + between(-2, 2);
        const gapStart = minX + T + 0.8 + localRand() * Math.max(0.1, building.w - 2 * T - 5.4);
        walls.push(...spanRects("x", pz - 0.5, pz + 0.5, minX + T, maxX - T, [[gapStart, gapStart + 3.4]]));
    }

    return walls.filter((rect) => rect.maxX - rect.minX > 0.3 && rect.maxZ - rect.minZ > 0.3);
}

function stubWalls(building, localRand) {
    const minX = building.x - building.w / 2;
    const maxX = building.x + building.w / 2;
    const minZ = building.z - building.d / 2;
    const maxZ = building.z + building.d / 2;
    const T = WALL_T;

    const candidates = [
        { minX: round(minX, 2), maxX: round(maxX, 2), minZ: round(minZ, 2), maxZ: round(minZ + T, 2) },
        { minX: round(maxX - T, 2), maxX: round(maxX, 2), minZ: round(minZ, 2), maxZ: round(maxZ, 2) },
        { minX: round(minX, 2), maxX: round(maxX, 2), minZ: round(maxZ - T, 2), maxZ: round(maxZ, 2) },
        { minX: round(minX, 2), maxX: round(minX + T, 2), minZ: round(minZ, 2), maxZ: round(maxZ, 2) },
    ];

    const keep = localRand() < 0.45 ? 1 : 2;
    const start = Math.floor(localRand() * 4);
    const out = [];
    for (let i = 0; i < keep; i++) out.push(candidates[(start + i) % 4]);
    return out;
}

function shapeBuilding(building) {
    let seed = building.seed + 1;
    const localRand = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
    };

    const rubble = building.ruin >= 0.86;
    building.open = !rubble;
    building.rubble = rubble;
    building.roof = !rubble && building.ruin < 0.3 && !building.loot ? 1 : 0;
    const styleLift = building.style === STYLE_INDEX.spire ? 1.22 : 1;
    building.height = round(
        Math.max(3.2, building.floors * FLOOR_HEIGHT * styleLift * (1 - building.ruin * 0.34) + (rubble ? -1.4 : 0)),
        2
    );
    building.walls = rubble ? stubWalls(building, localRand) : buildWalls(building, localRand);
}

for (const building of [...buildings, ...edgeRuins]) shapeBuilding(building);

const REPAIR_CELL = 1.25;
const REPAIR_CLEAR = 0.75;

function collectBlockers() {
    const rects = [];
    for (const building of [...buildings, ...edgeRuins]) {
        for (const wall of building.walls) rects.push(wall);
    }
    for (const wall of cathedralWalls) rects.push(wall);
    for (const block of cathedralBlocks) rects.push(block);
    return rects;
}

function reachabilityMap() {
    const rects = collectBlockers();
    const reach = Math.ceil(Math.max(...boundary.map((p) => Math.hypot(p.x, p.z)))) + 4;
    const size = Math.ceil((reach * 2) / REPAIR_CELL) + 1;
    const walk = new Uint8Array(size * size);

    const cellOf = (value) => Math.round((value + reach) / REPAIR_CELL);
    const worldOf = (index) => -reach + index * REPAIR_CELL;

    const buckets = new Map();
    for (const rect of rects) {
        const x0 = Math.max(0, cellOf(rect.minX - REPAIR_CLEAR) - 1);
        const x1 = Math.min(size - 1, cellOf(rect.maxX + REPAIR_CLEAR) + 1);
        const z0 = Math.max(0, cellOf(rect.minZ - REPAIR_CLEAR) - 1);
        const z1 = Math.min(size - 1, cellOf(rect.maxZ + REPAIR_CLEAR) + 1);
        for (let ix = x0; ix <= x1; ix++) {
            for (let iz = z0; iz <= z1; iz++) {
                const key = iz * size + ix;
                const bucket = buckets.get(key);
                if (bucket) bucket.push(rect);
                else buckets.set(key, [rect]);
            }
        }
    }

    for (let ix = 0; ix < size; ix++) {
        for (let iz = 0; iz < size; iz++) {
            const x = worldOf(ix);
            const z = worldOf(iz);
            if (!insideBoundary(x, z, REPAIR_CLEAR)) continue;

            let blocked = false;
            for (const rect of buckets.get(iz * size + ix) || []) {
                if (
                    x > rect.minX - REPAIR_CLEAR && x < rect.maxX + REPAIR_CLEAR &&
                    z > rect.minZ - REPAIR_CLEAR && z < rect.maxZ + REPAIR_CLEAR
                ) {
                    blocked = true;
                    break;
                }
            }
            for (const column of cathedralColumns) {
                if (blocked) break;
                const reachR = column.r + REPAIR_CLEAR;
                if ((x - column.x) ** 2 + (z - column.z) ** 2 < reachR * reachR) blocked = true;
            }
            if (!blocked) walk[iz * size + ix] = 1;
        }
    }

    const seen = new Uint8Array(size * size);
    const queue = new Int32Array(size * size);
    let head = 0;
    let tail = 0;

    const startX = cellOf(spawnSeed.x);
    const startZ = cellOf(spawnSeed.z);
    const start = startZ * size + startX;
    if (!walk[start]) throw new Error("reachability seed is not walkable");
    seen[start] = 1;
    queue[tail++] = start;

    while (head < tail) {
        const cell = queue[head++];
        const ix = cell % size;
        const iz = (cell - ix) / size;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = ix + dx;
            const nz = iz + dz;
            if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
            const next = nz * size + nx;
            if (seen[next] || !walk[next]) continue;
            seen[next] = 1;
            queue[tail++] = next;
        }
    }

    return {
        reached: (x, z) => {
            const ix = cellOf(x);
            const iz = cellOf(z);
            if (ix < 0 || iz < 0 || ix >= size || iz >= size) return false;
            return seen[iz * size + ix] === 1;
        },
        walkable: walk,
        size,
        count: tail,
    };
}


const CATHEDRAL_LOOT = [
    { id: "cath-a", x: round(cathedral.x - 15), z: round(cathedral.minZ + 24), tier: 2, building: "cathedral" },
    { id: "cath-b", x: round(cathedral.x + 15), z: round(cathedral.minZ + 24), tier: 2, building: "cathedral" },
];
loot.push(...CATHEDRAL_LOOT);

const spawns = [];
for (let i = 0; i < SPAWN_COUNT; i++) {
    const angle = (i / SPAWN_COUNT) * Math.PI * 2 + Math.PI * 0.25;
    let x = Math.cos(angle) * SPAWN_RADIUS;
    let z = Math.sin(angle) * SPAWN_RADIUS;

    for (let attempt = 0; attempt < 80; attempt++) {
        const box = { minX: x - 4, maxX: x + 4, minZ: z - 4, maxZ: z + 4 };
        const blocked = placed.some((other) => rectsOverlap(box, other, 2));
        if (!blocked && insideBoundary(x, z, 14)) break;
        x = Math.cos(angle) * (SPAWN_RADIUS - attempt * 1.6);
        z = Math.sin(angle) * (SPAWN_RADIUS - attempt * 1.6);
    }

    spawns.push({ x: round(x), z: round(z) });
}

const siegeGates = [];
for (let i = 0; i < SIEGE_GATE_COUNT; i++) {
    const angle = (i / SIEGE_GATE_COUNT) * Math.PI * 2;
    let radius = boundaryRadiusAt(angle) - 18;
    let x = Math.cos(angle) * radius;
    let z = Math.sin(angle) * radius;

    for (let attempt = 0; attempt < 90; attempt++) {
        const box = { minX: x - 3, maxX: x + 3, minZ: z - 3, maxZ: z + 3 };
        if (!placed.some((other) => rectsOverlap(box, other, 1.5)) && insideBoundary(x, z, 8)) break;
        radius -= 2.4;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
    }

    siegeGates.push({ x: round(x), z: round(z) });
}

const ZOMBIE_MIX = [
    { type: "ward_walker", weight: 66 },
    { type: "ward_runner", weight: 24 },
    { type: "ward_brute", weight: 10 },
];
const ZOMBIE_BAG = ZOMBIE_MIX.flatMap((entry) => Array(entry.weight).fill(entry.type));

const zombieSpawns = [];
let guard = 0;
while (zombieSpawns.length < ZOMBIE_TARGET && guard < ZOMBIE_TARGET * 60) {
    guard++;
    const angle = rand() * Math.PI * 2;
    const radius = Math.sqrt(rand()) * (CITY_RADIUS - 34);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    if (!insideBoundary(x, z, 20)) continue;
    if (Math.hypot(x - cathedral.x, z - cathedral.z) < PLAZA_RADIUS * 0.55) continue;

    const box = { minX: x - 1.4, maxX: x + 1.4, minZ: z - 1.4, maxZ: z + 1.4 };
    if (placed.some((other) => rectsOverlap(box, other, 0.6))) continue;

    const type = pick(ZOMBIE_BAG);
    if (type === "ward_runner" && !chance(0.55)) continue;

    zombieSpawns.push({ type, x: round(x), z: round(z) });
}

const buildingById = new Map([...buildings, ...edgeRuins].map((entry) => [entry.id, entry]));

let reachability = reachabilityMap();

const lootByBuilding = new Map(loot.map((entry) => [entry.building, entry]));
const dropped = [];

for (let pass = 0; pass < 4; pass++) {
    const broken = loot.filter((entry) => entry.building !== "cathedral" && !reachability.reached(entry.x, entry.z));
    if (broken.length === 0) break;

    for (const container of broken) {
        const building = buildingById.get(container.building);
        if (!building) continue;
        building.door = (building.door + 1) % 4;
        building.seed = (building.seed * 7 + 13) % 65536;
        shapeBuilding(building);
    }

    reachability = reachabilityMap();
}

for (const container of loot.slice()) {
    if (container.building === "cathedral") continue;
    if (reachability.reached(container.x, container.z)) continue;

    const building = buildingById.get(container.building);
    if (building) building.loot = null;
    lootByBuilding.delete(container.building);
    dropped.push(container.id);
    loot.splice(loot.indexOf(container), 1);
}

let lootSeq = 0;
for (const container of loot) {
    if (container.building === "cathedral") continue;
    container.id = `c${String(lootSeq++).padStart(3, "0")}`;
    const building = buildingById.get(container.building);
    if (building) building.loot = container.id;
}

const unreachableSpawns = spawns.filter((spawn) => !reachability.reached(spawn.x, spawn.z));
if (unreachableSpawns.length > 0) throw new Error(`entry points cut off: ${JSON.stringify(unreachableSpawns)}`);

const unreachableGates = siegeGates.filter((gate) => !reachability.reached(gate.x, gate.z));
if (unreachableGates.length > 0) throw new Error(`siege gates cut off: ${JSON.stringify(unreachableGates)}`);

const unreachableZombies = zombieSpawns.filter((spawn) => !reachability.reached(spawn.x, spawn.z));
for (const spawn of unreachableZombies) zombieSpawns.splice(zombieSpawns.indexOf(spawn), 1);

if (!reachability.reached(crystal.x, crystal.z)) throw new Error("crystal is walled off");
if (!reachability.reached(bossSpawn.x, bossSpawn.z)) throw new Error("boss spawn is walled off");

const PROP_KINDS = ["lamp", "barricade", "cart", "rubble", "deadtree", "brazier", "pew"];
const props = [];
let propGuard = 0;
while (props.length < 900 && propGuard < 60000) {
    propGuard++;
    const angle = rand() * Math.PI * 2;
    const radius = Math.sqrt(rand()) * (CITY_RADIUS - 26);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    if (!insideBoundary(x, z, 16)) continue;

    const box = { minX: x - 1.2, maxX: x + 1.2, minZ: z - 1.2, maxZ: z + 1.2 };
    if (placed.some((other) => rectsOverlap(box, other, 0.4))) continue;
    if (
        x > cathedral.minX - 4 &&
        x < cathedral.maxX + 4 &&
        z > cathedral.minZ - 4 &&
        z < cathedral.maxZ + 4
    ) {
        continue;
    }

    const nearPlaza = inPlaza(x, z);
    const kind = nearPlaza ? pick(["brazier", "rubble", "pew", "lamp"]) : pick(PROP_KINDS);

    props.push({
        kind: PROP_KINDS.indexOf(kind),
        x: round(x),
        z: round(z),
        rot: round(rand() * Math.PI * 2, 2),
        scale: round(between(0.82, 1.25), 2),
    });
}

const lampPosts = [];
for (const block of blockCentres) {
    for (const [ox, oz] of [
        [BLOCK_PITCH / 2, 0],
        [0, BLOCK_PITCH / 2],
    ]) {
        const x = block.cx + ox;
        const z = block.cz + oz;
        if (!insideBoundary(x, z, 18)) continue;
        if (inPlaza(x, z)) continue;
        if (!chance(0.62)) continue;
        lampPosts.push({ x: round(x), z: round(z) });
    }
}

function serialise(list, perLine = 1) {
    if (list.length === 0) return "[]";
    const rows = [];
    for (let i = 0; i < list.length; i += perLine) {
        rows.push("    " + list.slice(i, i + perLine).map((item) => JSON.stringify(item)).join(", "));
    }
    return "[\n" + rows.join(",\n") + ",\n]";
}


const output = `// src/features/game/world/locations/influence/cityLayout.ts

export interface CityPoint {
    x: number;
    z: number;
}

export interface CityRect {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

export interface CityBuilding {
    id: string;
    x: number;
    z: number;
    w: number;
    d: number;
    floors: number;
    style: number;
    ruin: number;
    door: number;
    seed: number;
    loot: string | null;
    open: boolean;
    rubble: boolean;
    roof: number;
    height: number;
    walls: CityRect[];
}

export interface CityEdgeRuin extends CityBuilding {
    cut: number;
}

export interface CityLoot {
    id: string;
    x: number;
    z: number;
    tier: number;
    building: string;
}

export interface CityProp {
    kind: number;
    x: number;
    z: number;
    rot: number;
    scale: number;
}

export interface CityColumn {
    x: number;
    z: number;
    r: number;
}

export interface CityZombieSpawn {
    type: string;
    x: number;
    z: number;
}

export const CITY_FLOOR_Y = 0;
export const CITY_RADIUS = ${CITY_RADIUS};
export const CITY_BLOCK_PITCH = ${BLOCK_PITCH};
export const CITY_BUILD_MARGIN = ${BUILD_MARGIN};
export const CITY_PLAZA_RADIUS = ${PLAZA_RADIUS};
export const CITY_STYLE_KEYS = ${JSON.stringify(BUILDING_STYLES.map((s) => s.key))};
export const CITY_PROP_KINDS = ${JSON.stringify(PROP_KINDS)};
export const CITY_WALL_THICKNESS = ${CATHEDRAL_WALL};
export const CITY_DOOR_WIDTH = ${DOOR_WIDTH};
export const CITY_WALL_T = ${WALL_T};
export const CITY_FLOOR_HEIGHT = ${FLOOR_HEIGHT};

export const CITY_CATHEDRAL = ${JSON.stringify({
    x: cathedral.x,
    z: cathedral.z,
    w: cathedral.w,
    d: cathedral.d,
    minX: cathedral.minX,
    maxX: cathedral.maxX,
    minZ: cathedral.minZ,
    maxZ: cathedral.maxZ,
})};

export const CITY_CATHEDRAL_WALLS: CityRect[] = ${serialise(cathedralWalls)};

export const CITY_CATHEDRAL_BLOCKS: CityRect[] = ${serialise(cathedralBlocks)};

export const CITY_CATHEDRAL_COLUMNS: CityColumn[] = ${serialise(cathedralColumns, 2)};

export const CITY_CATHEDRAL_DOOR = ${JSON.stringify(cathedralDoor)};

export const CITY_CRYSTAL = ${JSON.stringify(crystal)};

export const CITY_BOSS_SPAWN = ${JSON.stringify(bossSpawn)};

export const CITY_BOSS_ARENA = ${JSON.stringify(bossArena)};

export const CITY_BOUNDARY: CityPoint[] = ${serialise(boundary, 3)};

export const CITY_SPAWNS: CityPoint[] = ${serialise(spawns, 2)};

export const CITY_SIEGE_GATES: CityPoint[] = ${serialise(siegeGates, 2)};

export const CITY_BUILDINGS: CityBuilding[] = ${serialise(buildings)};

export const CITY_EDGE_RUINS: CityEdgeRuin[] = ${serialise(edgeRuins)};

export const CITY_LOOT: CityLoot[] = ${serialise(loot)};

export const CITY_PROPS: CityProp[] = ${serialise(props, 3)};

export const CITY_LAMPS: CityPoint[] = ${serialise(lampPosts, 3)};

export const CITY_ZOMBIE_SPAWNS: CityZombieSpawn[] = ${serialise(zombieSpawns, 2)};
`;

writeFileSync(TARGET, output.replace(/\r\n/g, "\n"));

console.log(
    `[city] ${buildings.length} buildings, ${edgeRuins.length} edge ruins, ${loot.length} containers, ${props.length} props, ` +
    `${lampPosts.length} lamps, ${zombieSpawns.length} zombie spawns, ${boundary.length} boundary points, ` +
    `${dropped.length} sealed containers dropped, ${reachability.count} reachable cells`
);
