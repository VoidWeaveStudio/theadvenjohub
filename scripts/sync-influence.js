// scripts/sync-influence.js
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const LAYOUT = resolve(here, "../src/features/game/world/locations/influence/cityLayout.ts");
const TARGET = resolve(here, "../../game-server/influenceGeometry.js");

function listOf(source, name) {
    const start = source.indexOf(`export const ${name}`);
    if (start === -1) throw new Error(`${name} not found in cityLayout.ts`);
    const open = source.indexOf("= [", start) + 2;
    const close = source.indexOf("\n];", open);
    if (close === -1) throw new Error(`${name} is not a closed array literal in cityLayout.ts`);
    return new Function(`return ${source.slice(open, close + 2)};`)();
}

function valueOf(source, name) {
    const match = source.match(new RegExp(`export const ${name}(?::[^=]+)? = ([^;\\n]+);`));
    if (!match) throw new Error(`${name} not found in cityLayout.ts`);
    return new Function(`return ${match[1]};`)();
}

const layout = readFileSync(LAYOUT, "utf8");

const boundary = listOf(layout, "CITY_BOUNDARY");
const spawns = listOf(layout, "CITY_SPAWNS");
const siegeGates = listOf(layout, "CITY_SIEGE_GATES");
const buildings = listOf(layout, "CITY_BUILDINGS");
const edgeRuins = listOf(layout, "CITY_EDGE_RUINS");
const loot = listOf(layout, "CITY_LOOT");
const zombieSpawns = listOf(layout, "CITY_ZOMBIE_SPAWNS");
const cathedralWalls = listOf(layout, "CITY_CATHEDRAL_WALLS");
const cathedralBlocks = listOf(layout, "CITY_CATHEDRAL_BLOCKS");
const cathedralColumns = listOf(layout, "CITY_CATHEDRAL_COLUMNS");

const cathedral = valueOf(layout, "CITY_CATHEDRAL");
const cathedralDoor = valueOf(layout, "CITY_CATHEDRAL_DOOR");
const crystal = valueOf(layout, "CITY_CRYSTAL");
const bossSpawn = valueOf(layout, "CITY_BOSS_SPAWN");
const bossArena = valueOf(layout, "CITY_BOSS_ARENA");
const floorY = valueOf(layout, "CITY_FLOOR_Y");
const cityRadius = valueOf(layout, "CITY_RADIUS");
const plazaRadius = valueOf(layout, "CITY_PLAZA_RADIUS");

if (boundary.length < 24) throw new Error("CITY_BOUNDARY needs at least 24 samples");
if (spawns.length === 0) throw new Error("CITY_SPAWNS is empty");
if (siegeGates.length === 0) throw new Error("CITY_SIEGE_GATES is empty");

const boundaryRadii = boundary.map((point) => Math.hypot(point.x, point.z));
const outerRadius = Math.ceil(Math.max(...boundaryRadii));

const allBuildings = [...buildings, ...edgeRuins];

const footprintOf = (building) => ({
    id: building.id,
    minX: Math.round((building.x - building.w / 2) * 100) / 100,
    maxX: Math.round((building.x + building.w / 2) * 100) / 100,
    minZ: Math.round((building.z - building.d / 2) * 100) / 100,
    maxZ: Math.round((building.z + building.d / 2) * 100) / 100,
    open: building.open === true,
});

const footprints = allBuildings.map(footprintOf);

const blockers = [];
for (const building of allBuildings) {
    if (!Array.isArray(building.walls) || building.walls.length === 0) {
        throw new Error(`building ${building.id} has no wall segments`);
    }
    for (let i = 0; i < building.walls.length; i++) {
        blockers.push({ id: `${building.id}:${i}`, ...building.walls[i] });
    }
}
for (let i = 0; i < cathedralWalls.length; i++) {
    blockers.push({ id: `cathedral:${i}`, ...cathedralWalls[i] });
}
for (let i = 0; i < cathedralBlocks.length; i++) {
    blockers.push({ id: `cathedral-block:${i}`, ...cathedralBlocks[i] });
}

const lootById = new Map(loot.map((entry) => [entry.id, entry]));
for (const building of buildings) {
    if (building.loot && !lootById.has(building.loot)) {
        throw new Error(`building ${building.id} points at missing container ${building.loot}`);
    }
}

const buildingById = new Map(allBuildings.map((entry) => [entry.id, entry]));
for (const container of loot) {
    if (container.building === "cathedral") continue;
    const owner = buildingById.get(container.building);
    if (!owner) throw new Error(`container ${container.id} points at missing building ${container.building}`);

    const insideX = Math.abs(container.x - owner.x) <= owner.w / 2;
    const insideZ = Math.abs(container.z - owner.z) <= owner.d / 2;
    if (!insideX || !insideZ) throw new Error(`container ${container.id} sits outside building ${container.building}`);
}

function radiusAt(angle) {
    const step = (Math.PI * 2) / boundary.length;
    let a = angle % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    const slot = a / step;
    const i0 = Math.floor(slot) % boundary.length;
    const i1 = (i0 + 1) % boundary.length;
    const f = slot - Math.floor(slot);
    return boundaryRadii[i0] * (1 - f) + boundaryRadii[i1] * f;
}

for (const spawn of spawns) {
    const angle = Math.atan2(spawn.z, spawn.x);
    if (Math.hypot(spawn.x, spawn.z) > radiusAt(angle) - 8) {
        throw new Error(`spawn ${spawn.x},${spawn.z} sits too close to the tear`);
    }
    for (const rect of blockers) {
        if (spawn.x > rect.minX - 2 && spawn.x < rect.maxX + 2 && spawn.z > rect.minZ - 2 && spawn.z < rect.maxZ + 2) {
            throw new Error(`spawn ${spawn.x},${spawn.z} sits inside ${rect.id}`);
        }
    }
}

for (const rect of blockers) {
    if (crystal.x > rect.minX && crystal.x < rect.maxX && crystal.z > rect.minZ && crystal.z < rect.maxZ) {
        throw new Error(`crystal sits inside ${rect.id}`);
    }
}

const REACH_CELL = 1.25;
const REACH_CLEAR = 0.75;

function assertReachable() {
    const size = Math.ceil(((outerRadius + 4) * 2) / REACH_CELL) + 1;
    const origin = -(outerRadius + 4);
    const cellOf = (value) => Math.round((value - origin) / REACH_CELL);
    const walk = new Uint8Array(size * size);

    const buckets = new Map();
    for (const rect of blockers) {
        for (let ix = Math.max(0, cellOf(rect.minX - REACH_CLEAR) - 1); ix <= Math.min(size - 1, cellOf(rect.maxX + REACH_CLEAR) + 1); ix++) {
            for (let iz = Math.max(0, cellOf(rect.minZ - REACH_CLEAR) - 1); iz <= Math.min(size - 1, cellOf(rect.maxZ + REACH_CLEAR) + 1); iz++) {
                const key = iz * size + ix;
                const bucket = buckets.get(key);
                if (bucket) bucket.push(rect);
                else buckets.set(key, [rect]);
            }
        }
    }

    for (let ix = 0; ix < size; ix++) {
        for (let iz = 0; iz < size; iz++) {
            const x = origin + ix * REACH_CELL;
            const z = origin + iz * REACH_CELL;
            if (Math.hypot(x, z) > radiusAt(Math.atan2(z, x)) - REACH_CLEAR) continue;

            let blocked = false;
            for (const rect of buckets.get(iz * size + ix) || []) {
                if (
                    x > rect.minX - REACH_CLEAR && x < rect.maxX + REACH_CLEAR &&
                    z > rect.minZ - REACH_CLEAR && z < rect.maxZ + REACH_CLEAR
                ) {
                    blocked = true;
                    break;
                }
            }
            for (const column of cathedralColumns) {
                if (blocked) break;
                const reach = column.r + REACH_CLEAR;
                if ((x - column.x) ** 2 + (z - column.z) ** 2 < reach * reach) blocked = true;
            }
            if (!blocked) walk[iz * size + ix] = 1;
        }
    }

    const seen = new Uint8Array(size * size);
    const queue = new Int32Array(size * size);
    let head = 0;
    let tail = 0;
    const start = cellOf(crystal.z) * size + cellOf(crystal.x);
    if (!walk[start]) throw new Error("crystal cell is not walkable");
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

    const reached = (point) => seen[cellOf(point.z) * size + cellOf(point.x)] === 1;

    const cut = [
        ...spawns.filter((point) => !reached(point)).map((point) => `entry ${point.x},${point.z}`),
        ...siegeGates.filter((point) => !reached(point)).map((point) => `siege gate ${point.x},${point.z}`),
        ...loot.filter((point) => !reached(point)).map((point) => `container ${point.id}`),
        ...zombieSpawns.filter((point) => !reached(point)).map((point) => `zombie spawn ${point.x},${point.z}`),
    ];

    if (!reached(bossSpawn)) cut.push("boss spawn");
    if (cut.length > 0) throw new Error(`the crystal cannot be walked to from: ${cut.join(", ")}`);

    return tail;
}

const reachableCells = assertReachable();

const generated = `// game-server/influenceGeometry.js

const FLOOR_Y = ${JSON.stringify(floorY)};
const CITY_RADIUS = ${JSON.stringify(cityRadius)};
const PLAZA_RADIUS = ${JSON.stringify(plazaRadius)};
const OUTER_RADIUS = ${JSON.stringify(outerRadius)};

const BOUNDARY = ${JSON.stringify(boundary)};
const BOUNDARY_RADII = ${JSON.stringify(boundaryRadii.map((r) => Math.round(r * 1000) / 1000))};
const BOUNDARY_STEP = (Math.PI * 2) / BOUNDARY_RADII.length;

const CATHEDRAL = ${JSON.stringify(cathedral)};
const CATHEDRAL_DOOR = ${JSON.stringify(cathedralDoor)};
const CATHEDRAL_COLUMNS = ${JSON.stringify(cathedralColumns)};
const CRYSTAL = ${JSON.stringify(crystal)};
const BOSS_SPAWN = ${JSON.stringify(bossSpawn)};
const BOSS_ARENA = ${JSON.stringify(bossArena)};

const SPAWNS = ${JSON.stringify(spawns)};
const SIEGE_GATES = ${JSON.stringify(siegeGates)};
const LOOT = ${JSON.stringify(loot)};
const ZOMBIE_SPAWNS = ${JSON.stringify(zombieSpawns)};

const BLOCKERS = ${JSON.stringify(blockers)};

const FOOTPRINTS = ${JSON.stringify(footprints)};

const GRID_CELL = 12;
const GRID_ORIGIN = -(OUTER_RADIUS + GRID_CELL * 2);
const GRID_SIZE = Math.ceil((-GRID_ORIGIN * 2) / GRID_CELL) + 1;

const GRID = new Array(GRID_SIZE * GRID_SIZE);

function gridIndex(x, z) {
  const ix = Math.floor((x - GRID_ORIGIN) / GRID_CELL);
  const iz = Math.floor((z - GRID_ORIGIN) / GRID_CELL);
  if (ix < 0 || iz < 0 || ix >= GRID_SIZE || iz >= GRID_SIZE) return -1;
  return iz * GRID_SIZE + ix;
}

for (let index = 0; index < BLOCKERS.length; index++) {
  const rect = BLOCKERS[index];
  const x0 = Math.floor((rect.minX - 2 - GRID_ORIGIN) / GRID_CELL);
  const x1 = Math.floor((rect.maxX + 2 - GRID_ORIGIN) / GRID_CELL);
  const z0 = Math.floor((rect.minZ - 2 - GRID_ORIGIN) / GRID_CELL);
  const z1 = Math.floor((rect.maxZ + 2 - GRID_ORIGIN) / GRID_CELL);

  for (let ix = Math.max(0, x0); ix <= Math.min(GRID_SIZE - 1, x1); ix++) {
    for (let iz = Math.max(0, z0); iz <= Math.min(GRID_SIZE - 1, z1); iz++) {
      const slot = iz * GRID_SIZE + ix;
      if (GRID[slot]) GRID[slot].push(index);
      else GRID[slot] = [index];
    }
  }
}

function boundaryRadius(angle) {
  let a = angle % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  const slot = a / BOUNDARY_STEP;
  const base = Math.floor(slot);
  const i0 = base % BOUNDARY_RADII.length;
  const i1 = (i0 + 1) % BOUNDARY_RADII.length;
  const f = slot - base;
  return BOUNDARY_RADII[i0] * (1 - f) + BOUNDARY_RADII[i1] * f;
}

function insideCity(x, z, margin = 0) {
  return Math.hypot(x, z) <= boundaryRadius(Math.atan2(z, x)) - margin;
}

function clampIntoCity(position, margin = 2) {
  const [x, , z] = position;
  const distance = Math.hypot(x, z);
  const limit = boundaryRadius(Math.atan2(z, x)) - margin;
  if (distance <= limit || distance < 0.0001) return false;

  const scale = limit / distance;
  position[0] = x * scale;
  position[2] = z * scale;
  return true;
}

function blockerAt(x, z, clearance = 0) {
  const slot = gridIndex(x, z);
  if (slot === -1) return null;

  const bucket = GRID[slot];
  if (!bucket) return null;

  for (const index of bucket) {
    const rect = BLOCKERS[index];
    if (
      x > rect.minX - clearance &&
      x < rect.maxX + clearance &&
      z > rect.minZ - clearance &&
      z < rect.maxZ + clearance
    ) {
      return rect;
    }
  }

  return null;
}

function columnAt(x, z, clearance = 0) {
  for (const column of CATHEDRAL_COLUMNS) {
    const reach = column.r + clearance;
    const dx = x - column.x;
    const dz = z - column.z;
    if (dx * dx + dz * dz < reach * reach) return column;
  }
  return null;
}

function cityBlocked(x, z, clearance = 0) {
  return blockerAt(x, z, clearance) !== null || columnAt(x, z, clearance) !== null;
}

function cityWalkable(x, z, clearance = 0) {
  if (!insideCity(x, z, clearance)) return false;
  return !cityBlocked(x, z, clearance);
}

function pushOutOfBlockers(position, clearance = 0.6) {
  const rect = blockerAt(position[0], position[2], clearance);

  if (rect) {
    const left = position[0] - (rect.minX - clearance);
    const right = rect.maxX + clearance - position[0];
    const back = position[2] - (rect.minZ - clearance);
    const front = rect.maxZ + clearance - position[2];
    const smallest = Math.min(left, right, back, front);

    if (smallest === left) position[0] = rect.minX - clearance;
    else if (smallest === right) position[0] = rect.maxX + clearance;
    else if (smallest === back) position[2] = rect.minZ - clearance;
    else position[2] = rect.maxZ + clearance;
  }

  const column = columnAt(position[0], position[2], clearance);
  if (column) {
    const dx = position[0] - column.x;
    const dz = position[2] - column.z;
    const distance = Math.hypot(dx, dz) || 0.0001;
    const reach = column.r + clearance;
    position[0] = column.x + (dx / distance) * reach;
    position[2] = column.z + (dz / distance) * reach;
  }

  return rect !== null || column !== null;
}

function citySightBlocked(ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const length = Math.hypot(dx, dz);
  if (length < 0.0001) return false;

  const steps = Math.min(64, Math.max(2, Math.ceil(length / 2.5)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (cityBlocked(ax + dx * t, az + dz * t, 0)) return true;
  }

  return false;
}

const FOOTPRINT_GRID = new Array(GRID_SIZE * GRID_SIZE);

for (let index = 0; index < FOOTPRINTS.length; index++) {
  const rect = FOOTPRINTS[index];
  const x0 = Math.floor((rect.minX - GRID_ORIGIN) / GRID_CELL);
  const x1 = Math.floor((rect.maxX - GRID_ORIGIN) / GRID_CELL);
  const z0 = Math.floor((rect.minZ - GRID_ORIGIN) / GRID_CELL);
  const z1 = Math.floor((rect.maxZ - GRID_ORIGIN) / GRID_CELL);

  for (let ix = Math.max(0, x0); ix <= Math.min(GRID_SIZE - 1, x1); ix++) {
    for (let iz = Math.max(0, z0); iz <= Math.min(GRID_SIZE - 1, z1); iz++) {
      const slot = iz * GRID_SIZE + ix;
      if (FOOTPRINT_GRID[slot]) FOOTPRINT_GRID[slot].push(index);
      else FOOTPRINT_GRID[slot] = [index];
    }
  }
}

function buildingAt(x, z) {
  const slot = gridIndex(x, z);
  if (slot === -1) return null;

  const bucket = FOOTPRINT_GRID[slot];
  if (!bucket) return null;

  for (const index of bucket) {
    const rect = FOOTPRINTS[index];
    if (x > rect.minX && x < rect.maxX && z > rect.minZ && z < rect.maxZ) return rect;
  }

  return null;
}

function insideCathedral(x, z) {
  return x > CATHEDRAL.minX && x < CATHEDRAL.maxX && z > CATHEDRAL.minZ && z < CATHEDRAL.maxZ;
}

module.exports = {
  FLOOR_Y,
  CITY_RADIUS,
  PLAZA_RADIUS,
  OUTER_RADIUS,
  BOUNDARY,
  CATHEDRAL,
  CATHEDRAL_DOOR,
  CATHEDRAL_COLUMNS,
  CRYSTAL,
  BOSS_SPAWN,
  BOSS_ARENA,
  SPAWNS,
  SIEGE_GATES,
  LOOT,
  ZOMBIE_SPAWNS,
  BLOCKERS,
  FOOTPRINTS,
  boundaryRadius,
  insideCity,
  clampIntoCity,
  blockerAt,
  columnAt,
  cityBlocked,
  cityWalkable,
  pushOutOfBlockers,
  citySightBlocked,
  buildingAt,
  insideCathedral,
};
`;

const normalise = (text) => text.replace(/\r\n/g, "\n");

if (process.argv.includes("--check")) {
    let current = "";
    try {
        current = readFileSync(TARGET, "utf8");
    } catch {
        console.error("[influence] game-server/influenceGeometry.js is missing — run npm run sync:influence");
        process.exit(1);
    }

    if (normalise(current) !== normalise(generated)) {
        console.error("[influence] game-server/influenceGeometry.js is out of date — run npm run sync:influence");
        process.exit(1);
    }

    console.log("[influence] server geometry is in sync");
    process.exit(0);
}

writeFileSync(TARGET, generated);
console.log(
    `[influence] wrote ${blockers.length} blockers, ${loot.length} containers, ${zombieSpawns.length} zombie spawns, ` +
    `${spawns.length} entry points, ${reachableCells} reachable cells, outer radius ${outerRadius} to ${TARGET}`
);
