// scripts/sync-dust2.js
// Emits the Dust II blockers to game-server/dust2Geometry.js so the server can
// trace line of sight without importing TypeScript. Run --check in CI.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(here, "../src/features/game/world/locations/events/dust2Layout.ts");
const TARGET = resolve(here, "../../game-server/dust2Geometry.js");

function block(source, name) {
    const start = source.indexOf(`export const ${name}`);
    if (start === -1) throw new Error(`${name} not found in dust2Layout.ts`);
    const open = source.indexOf("= [", start) + 2;
    const close = source.indexOf("\n];", open);
    return source.slice(open, close + 2);
}

// The tables reference exported constants and simple arithmetic, so they are
// evaluated as JS literals rather than parsed as JSON.
function constants(source) {
    const names = ["MAP_HALF_X", "MAP_HALF_Z", "WALL_HEIGHT"];
    return names
        .map((name) => {
            const match = source.match(new RegExp(`export const ${name} = ([^;]+);`));
            if (!match) throw new Error(`${name} not found in dust2Layout.ts`);
            return `const ${name} = ${match[1]};`;
        })
        .join("\n");
}

function evaluate(source, name) {
    const body = `${constants(source)}\nreturn ${block(source, name)};`;
    return new Function(body)();
}

function toBoxes(source) {
    const walls = evaluate(source, "WALLS");
    const crates = evaluate(source, "CRATES");
    const platforms = evaluate(source, "PLATFORMS");

    const boxes = walls.map((wall) => ({
        minX: Math.min(wall.x1, wall.x2),
        maxX: Math.max(wall.x1, wall.x2),
        minY: wall.y ?? 0,
        maxY: (wall.y ?? 0) + wall.height,
        minZ: Math.min(wall.z1, wall.z2),
        maxZ: Math.max(wall.z1, wall.z2),
    }));

    for (const crate of crates) {
        boxes.push({
            minX: crate.x - crate.width / 2,
            maxX: crate.x + crate.width / 2,
            minY: crate.y ?? 0,
            maxY: (crate.y ?? 0) + crate.height,
            minZ: crate.z - crate.depth / 2,
            maxZ: crate.z + crate.depth / 2,
        });
    }

    for (const pad of platforms) {
        boxes.push({
            minX: Math.min(pad.x1, pad.x2),
            maxX: Math.max(pad.x1, pad.x2),
            minY: 0,
            maxY: pad.top,
            minZ: Math.min(pad.z1, pad.z2),
            maxZ: Math.max(pad.z1, pad.z2),
        });
    }

    return boxes;
}

const boxes = toBoxes(readFileSync(SOURCE, "utf8"));

const generated = `// game-server/dust2Geometry.js
// Generated from src/features/game/world/locations/events/dust2Layout.ts by
// scripts/sync-dust2.js — do not edit by hand.
const BLOCKERS = ${JSON.stringify(boxes)};

// Slab test: does the segment from a to b clip this axis-aligned box?
function segmentHitsBox(ax, ay, az, bx, by, bz, box) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;

  let near = 0;
  let far = 1;

  const axes = [
    [ax, dx, box.minX, box.maxX],
    [ay, dy, box.minY, box.maxY],
    [az, dz, box.minZ, box.maxZ],
  ];

  for (const [origin, delta, min, max] of axes) {
    if (Math.abs(delta) < 1e-8) {
      if (origin < min || origin > max) return false;
      continue;
    }

    let t1 = (min - origin) / delta;
    let t2 = (max - origin) / delta;
    if (t1 > t2) {
      const swap = t1;
      t1 = t2;
      t2 = swap;
    }

    near = Math.max(near, t1);
    far = Math.min(far, t2);
    if (near > far) return false;
  }

  return true;
}

function contains(box, x, y, z) {
  return x >= box.minX && x <= box.maxX
    && y >= box.minY && y <= box.maxY
    && z >= box.minZ && z <= box.maxZ;
}

// A box holding either endpoint is skipped: standing on a crate or a grenade
// wedged against a wall must not make you immune to what happens next to you.
function hasLineOfSight(ax, ay, az, bx, by, bz) {
  for (const box of BLOCKERS) {
    if (contains(box, ax, ay, az) || contains(box, bx, by, bz)) continue;
    if (segmentHitsBox(ax, ay, az, bx, by, bz, box)) return false;
  }
  return true;
}

module.exports = { BLOCKERS, segmentHitsBox, contains, hasLineOfSight };
`;

if (process.argv.includes("--check")) {
    if (readFileSync(TARGET, "utf8") !== generated) {
        console.error("[dust2] game-server/dust2Geometry.js is out of date — run npm run sync:dust2");
        process.exit(1);
    }
    console.log("[dust2] server geometry is in sync");
    process.exit(0);
}

writeFileSync(TARGET, generated);
console.log(`[dust2] wrote ${boxes.length} blockers to ${TARGET}`);
