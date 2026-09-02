// scripts/check-i18n-unused.js
// Reports translation keys that no longer appear anywhere in the code.
//
// The search is a plain substring scan over one concatenated corpus rather than a
// regex over quoted strings: a one-character literal ("R") or an apostrophe
// ("Sola's") throws quote pairing out of alignment and makes live keys look dead,
// which is exactly the way a key-pruning pass breaks the UI.
//
// Keys built at runtime never appear in full, so their namespaces are listed in
// DYNAMIC_PREFIXES below. Add to it when you introduce a new `t(`ns.${x}`)`.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, "..");
const SERVER = path.join(ROOT, "..", "game-server");
const LOCALES = path.join(ROOT, "src", "core", "i18n", "locales");

const DYNAMIC_PREFIXES = [
    "api.error.",
    "g.ach.",
    "g.biome.",
    "g.cosmetic.",
    "g.err.cosmeticCrate.",
    "g.floorReg.",
    "g.graphics.preset.",
    "g.notice.",
    "g.pet.",
    "g.shopBuy.err.",
    "g.tournament.kind.",
    "games.",
    "hand.",
    "marketplace.lots.",
    "marketplace.status.",
    "marketplace.type.",
    "profile.",
];

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "locales", "releases", "dist"]);

function collect(root, extensions, out = []) {
    if (!fs.existsSync(root)) return out;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
            collect(path.join(root, entry.name), extensions, out);
        } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
            out.push(path.join(root, entry.name));
        }
    }
    return out;
}

const files = [
    ...collect(path.join(ROOT, "src"), [".ts", ".tsx", ".json"]),
    ...collect(path.join(ROOT, "app"), [".ts", ".tsx", ".json"]),
    ...collect(path.join(ROOT, "scripts"), [".js", ".mjs"]),
    ...collect(path.join(ROOT, "tanjo-client", "src"), [".ts", ".tsx", ".json"]),
    ...collect(path.join(ROOT, "public"), [".js", ".json", ".html"]),
    ...collect(SERVER, [".js", ".json"]),
];

const corpus = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");

const source = fs.readFileSync(path.join(LOCALES, "en.ts"), "utf8");
const keys = [...source.matchAll(/^\s*"([^"]+)":\s/gm)].map((m) => m[1]);

const unused = [];
let dynamicKept = 0;

for (const key of keys) {
    if (DYNAMIC_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        if (!corpus.includes(key)) dynamicKept++;
        continue;
    }
    if (!corpus.includes(key)) unused.push(key);
}

console.log(`i18n usage — ${keys.length} English keys against ${(corpus.length / 1e6).toFixed(1)} MB of source`);
console.log(`  ${dynamicKept} key(s) kept because their namespace is built at runtime`);

if (unused.length === 0) {
    console.log("\nno unused keys");
    process.exit(0);
}

console.log(`\n${unused.length} key(s) appear nowhere in the code:`);
for (const key of unused) console.log(`  ${key}`);
console.log("\nRemove them from every locale, or add the namespace to DYNAMIC_PREFIXES");
console.log("in this script if the key is assembled at runtime.");
process.exit(1);
