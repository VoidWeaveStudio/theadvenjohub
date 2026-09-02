// scripts/sync-arsenal.js
// Regenerates game-server/defusalArsenal.js from the TypeScript table so the
// server and client never drift. Run with --check in CI to fail on drift.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(here, "../src/features/game/data/defusalArsenal.ts");
const TARGET = resolve(here, "../../game-server/defusalArsenal.js");

const EXPORTS = [
    "DEFUSAL_ECONOMY",
    "ARSENAL",
    "ARSENAL_BY_ID",
    "DEFAULT_MELEE",
    "DEFAULT_PISTOL",
    "GRENADE_LIMIT",
    "arsenalFor",
    "isBuyable",
    "RUG",
];

function transpile(source) {
    return source
        .replace(/^\/\/.*$/gm, "")
        .replace(/export type [^;]+;/g, "")
        .replace(/export interface [\s\S]*?\n\}/g, "")
        .replace(/export const/g, "const")
        .replace(/export function/g, "function")
        .replace(/: ArsenalItem\[\]/g, "")
        .replace(/: "t" \| "ct"/g, "")
        .replace(/: ArsenalItem/g, "")
        .replace(/: boolean/g, "")
        .replace(/\n\s*\n+/g, "\n");
}

const header = "// game-server/defusalArsenal.js\n";

const generated = `${header}${transpile(readFileSync(SOURCE, "utf8"))}\nmodule.exports = { ${EXPORTS.join(", ")} };\n`;

// Line endings differ between a CRLF checkout and what this script writes, and
// that is not drift — compare the content, the way sync-cave and sync-influence
// already do, or the check goes permanently red on Windows.
const normalise = (text) => text.replace(/\r\n/g, "\n");

if (process.argv.includes("--check")) {
    const current = readFileSync(TARGET, "utf8");
    if (normalise(current) !== normalise(generated)) {
        console.error("[arsenal] game-server/defusalArsenal.js is out of date — run npm run sync:arsenal");
        process.exit(1);
    }
    console.log("[arsenal] server mirror is in sync");
    process.exit(0);
}

writeFileSync(TARGET, generated);
console.log(`[arsenal] wrote ${TARGET}`);
