// scripts/sync-cave.js
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const LAYOUT = resolve(here, "../src/features/game/world/locations/cave/caveLayout.ts");
const MESH = resolve(here, "../src/features/game/world/locations/cave/caveMesh.ts");
const TARGET = resolve(here, "../../game-server/caveGeometry.js");

function listOf(source, name, file) {
    const start = source.indexOf(`export const ${name}`);
    if (start === -1) throw new Error(`${name} not found in ${file}`);
    const open = source.indexOf("= [", start) + 2;
    const close = source.indexOf("\n];", open);
    if (close === -1) throw new Error(`${name} is not a closed array literal in ${file}`);
    return new Function(`return ${source.slice(open, close + 2)};`)();
}

function valueOf(source, name, file) {
    const match = source.match(new RegExp(`export const ${name}(?::[^=]+)? = ([^;]+);`));
    if (!match) throw new Error(`${name} not found in ${file}`);
    return new Function(`return ${match[1]};`)();
}

const layout = readFileSync(LAYOUT, "utf8");
const mesh = readFileSync(MESH, "utf8");

const chambers = listOf(layout, "CAVE_CHAMBERS", "caveLayout.ts").map((c) => ({
    x: c.x,
    z: c.z,
    radius: c.radius,
    ceiling: c.ceiling,
    secretId: c.secretId ?? null,
}));

const tunnels = listOf(layout, "CAVE_TUNNELS", "caveLayout.ts").map((t) => ({
    ax: t.ax,
    az: t.az,
    bx: t.bx,
    bz: t.bz,
    halfWidth: t.halfWidth,
    ceiling: t.ceiling,
    secretId: t.secretId ?? null,
}));

const secrets = listOf(layout, "CAVE_SECRETS", "caveLayout.ts");
const chests = listOf(layout, "CAVE_CHESTS", "caveLayout.ts").map((c) => ({
    id: c.id,
    x: c.x,
    z: c.z,
}));

const entries = listOf(layout, "CAVE_ENTRIES", "caveLayout.ts");
const pillars = listOf(layout, "CAVE_PILLARS", "caveLayout.ts");
const rocks = listOf(layout, "CAVE_ROCKS", "caveLayout.ts");
const enemySpawns = listOf(layout, "CAVE_ENEMY_SPAWNS", "caveLayout.ts");

const entrance = { x: entries[0].x, z: entries[0].z };
const bossSpawn = valueOf(layout, "CAVE_BOSS_SPAWN", "caveLayout.ts");
const bossArena = valueOf(layout, "CAVE_BOSS_ARENA", "caveLayout.ts");
const chestReward = valueOf(layout, "CAVE_CHEST_REWARD", "caveLayout.ts");
const floorY = valueOf(layout, "CAVE_FLOOR_Y", "caveLayout.ts");
const bounds = valueOf(mesh, "CAVE_BOUNDS", "caveMesh.ts");

for (const secret of secrets) {
    if (!chambers.some((chamber) => chamber.secretId === secret.id)) {
        throw new Error(`secret "${secret.id}" has no chamber carrying that secretId`);
    }
}

for (const chest of chests) {
    if (!secrets.some((secret) => secret.id === chest.id)) {
        throw new Error(`chest "${chest.id}" has no matching secret door`);
    }
}

if (entries.length === 0) throw new Error("CAVE_ENTRIES is empty");

const outerRadius = Math.ceil(
    Math.max(
        ...chambers.map((c) => Math.hypot(c.x, c.z) + c.radius),
        ...tunnels.flatMap((t) => [
            Math.hypot(t.ax, t.az) + t.halfWidth,
            Math.hypot(t.bx, t.bz) + t.halfWidth,
        ])
    )
);

if (outerRadius > Math.min(-bounds.minX, bounds.maxX, -bounds.minZ, bounds.maxZ)) {
    throw new Error(`geometry (${outerRadius}) reaches past CAVE_BOUNDS in caveMesh.ts`);
}

const generated = `// game-server/caveGeometry.js

const CHAMBERS = ${JSON.stringify(chambers)};

const TUNNELS = ${JSON.stringify(tunnels)};

const SECRETS = ${JSON.stringify(secrets)};

const CHESTS = ${JSON.stringify(chests)};

const ENTRIES = ${JSON.stringify(entries)};

const PILLARS = ${JSON.stringify(pillars)};

const ROCKS = ${JSON.stringify(rocks)};

const ENEMY_SPAWNS = ${JSON.stringify(enemySpawns)};

const ENTRANCE = ${JSON.stringify(entrance)};
const BOSS_SPAWN = ${JSON.stringify(bossSpawn)};
const BOSS_ARENA = ${JSON.stringify(bossArena)};
const BOUNDS = ${JSON.stringify(bounds)};
const CHEST_REWARD = ${JSON.stringify(chestReward)};
const FLOOR_Y = ${JSON.stringify(floorY)};
const OUTER_RADIUS = ${JSON.stringify(outerRadius)};

function segmentDistance2D(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSquared = dx * dx + dz * dz;

  let t = lengthSquared > 0 ? ((px - ax) * dx + (pz - az) * dz) / lengthSquared : 0;
  t = Math.max(0, Math.min(1, t));

  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

const OBSTACLE_ZONE = BOSS_ARENA.radius + 16;

function caveObstacleDistance(x, z) {
  if (Math.hypot(x - BOSS_ARENA.x, z - BOSS_ARENA.z) > OBSTACLE_ZONE) return Infinity;

  let nearest = Infinity;

  for (const pillar of PILLARS) {
    const d = Math.hypot(x - pillar.x, z - pillar.z) - pillar.radius;
    if (d < nearest) nearest = d;
  }

  for (const rock of ROCKS) {
    const d = Math.hypot(x - rock.x, z - rock.z) - rock.radius;
    if (d < nearest) nearest = d;
  }

  return nearest;
}

const GRID_CELL = 64;
const GRID_REACH = 64;
const FAR_DISTANCE = 999;

const ELEMENTS = [
  ...CHAMBERS.map((c, index) => ({
    kind: 0, index,
    minX: c.x - c.radius, maxX: c.x + c.radius,
    minZ: c.z - c.radius, maxZ: c.z + c.radius,
  })),
  ...TUNNELS.map((t, index) => ({
    kind: 1, index,
    minX: Math.min(t.ax, t.bx) - t.halfWidth, maxX: Math.max(t.ax, t.bx) + t.halfWidth,
    minZ: Math.min(t.az, t.bz) - t.halfWidth, maxZ: Math.max(t.az, t.bz) + t.halfWidth,
  })),
];

const GRID = new Map();
for (const element of ELEMENTS) {
  const x0 = Math.floor((element.minX - GRID_REACH) / GRID_CELL);
  const x1 = Math.floor((element.maxX + GRID_REACH) / GRID_CELL);
  const z0 = Math.floor((element.minZ - GRID_REACH) / GRID_CELL);
  const z1 = Math.floor((element.maxZ + GRID_REACH) / GRID_CELL);

  for (let ix = x0; ix <= x1; ix++) {
    for (let iz = z0; iz <= z1; iz++) {
      const key = ix + ',' + iz;
      const bucket = GRID.get(key);
      if (bucket) bucket.push(element);
      else GRID.set(key, [element]);
    }
  }
}

function caveDistance(x, z) {
  const bucket = GRID.get(Math.floor(x / GRID_CELL) + ',' + Math.floor(z / GRID_CELL));
  if (!bucket) return FAR_DISTANCE;

  let distance = Infinity;

  for (const element of bucket) {
    if (element.kind === 0) {
      const chamber = CHAMBERS[element.index];
      const d = Math.hypot(x - chamber.x, z - chamber.z) - chamber.radius;
      if (d < distance) distance = d;
    } else {
      const tunnel = TUNNELS[element.index];
      const d = segmentDistance2D(x, z, tunnel.ax, tunnel.az, tunnel.bx, tunnel.bz) - tunnel.halfWidth;
      if (d < distance) distance = d;
    }
  }

  const obstacle = caveObstacleDistance(x, z);
  if (obstacle < Infinity) distance = Math.max(distance, -obstacle);

  return distance === Infinity ? FAR_DISTANCE : distance;
}

function caveWalkable(x, z, clearance = 0) {
  return caveDistance(x, z) <= -clearance;
}

function segmentHitsCircle(ax, az, bx, bz, cx, cz, radius) {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSquared = dx * dx + dz * dz;

  let t = lengthSquared > 0 ? ((cx - ax) * dx + (cz - az) * dz) / lengthSquared : 0;
  t = Math.max(0, Math.min(1, t));

  const px = ax + dx * t;
  const pz = az + dz * t;
  return (px - cx) * (px - cx) + (pz - cz) * (pz - cz) <= radius * radius;
}

function caveCoverBetween(ax, az, bx, bz) {
  for (const pillar of PILLARS) {
    if (segmentHitsCircle(ax, az, bx, bz, pillar.x, pillar.z, pillar.radius)) return true;
  }

  for (const rock of ROCKS) {
    if (segmentHitsCircle(ax, az, bx, bz, rock.x, rock.z, rock.radius)) return true;
  }

  return false;
}

function caveSecretAt(x, z) {
  let distance = Infinity;
  let secretId = null;

  for (const chamber of CHAMBERS) {
    const d = Math.hypot(x - chamber.x, z - chamber.z) - chamber.radius;
    if (d < distance) {
      distance = d;
      secretId = chamber.secretId;
    }
  }

  for (const tunnel of TUNNELS) {
    const d = segmentDistance2D(x, z, tunnel.ax, tunnel.az, tunnel.bx, tunnel.bz) - tunnel.halfWidth;
    if (d < distance) {
      distance = d;
      secretId = tunnel.secretId;
    }
  }

  return secretId;
}

module.exports = {
  CHAMBERS,
  TUNNELS,
  SECRETS,
  CHESTS,
  ENTRIES,
  PILLARS,
  ROCKS,
  ENEMY_SPAWNS,
  ENTRANCE,
  BOSS_SPAWN,
  BOSS_ARENA,
  BOUNDS,
  CHEST_REWARD,
  FLOOR_Y,
  OUTER_RADIUS,
  segmentDistance2D,
  caveDistance,
  caveObstacleDistance,
  caveCoverBetween,
  segmentHitsCircle,
  caveWalkable,
  caveSecretAt,
};
`;

const normalise = (text) => text.replace(/\r\n/g, "\n");

if (process.argv.includes("--check")) {
    let current = "";
    try {
        current = readFileSync(TARGET, "utf8");
    } catch {
        console.error("[cave] game-server/caveGeometry.js is missing — run npm run sync:cave");
        process.exit(1);
    }

    if (normalise(current) !== normalise(generated)) {
        console.error("[cave] game-server/caveGeometry.js is out of date — run npm run sync:cave");
        process.exit(1);
    }

    console.log("[cave] server geometry is in sync");
    process.exit(0);
}

writeFileSync(TARGET, generated);
console.log(
    `[cave] wrote ${chambers.length} chambers, ${tunnels.length} tunnels, ${secrets.length} secrets, ${chests.length} chests to ${TARGET}`
);
