// scripts/check-i18n.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, "..");
const LOCALES = path.join(ROOT, "src", "core", "i18n", "locales");
const SOURCE_DIRS = [path.join(ROOT, "src"), path.join(ROOT, "app")];
const ORDER = ["ru", "be", "es", "it", "zh", "zh-tw", "ja", "ko", "vi", "id", "fil"];

const KEY_LINE = /^\s*"([^"]+)":\s/gm;
const T_CALL = /\bt\(\s*"([^"\n]+)"|\bt\(\s*'([^'\n]+)'/g;

function keysOf(code) {
    const src = fs.readFileSync(path.join(LOCALES, `${code}.ts`), "utf8");
    const keys = [];
    for (const match of src.matchAll(KEY_LINE)) keys.push(match[1]);
    return keys;
}

function sourceFiles(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== "node_modules" && !entry.name.startsWith(".")) sourceFiles(full, out);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !full.startsWith(LOCALES)) {
            out.push(full);
        }
    }
    return out;
}

function calledKeys() {
    const found = new Map();
    for (const dir of SOURCE_DIRS) {
        if (!fs.existsSync(dir)) continue;
        for (const file of sourceFiles(dir)) {
            const src = fs.readFileSync(file, "utf8");
            for (const match of src.matchAll(T_CALL)) {
                const key = match[1] ?? match[2];
                if (!found.has(key)) found.set(key, path.relative(ROOT, file));
            }
        }
    }
    return found;
}

const enKeys = keysOf("en");
const en = new Set(enKeys);
let failures = 0;

console.log(`i18n coverage — ${en.size} English keys`);

const enDuplicates = enKeys.filter((key, index) => enKeys.indexOf(key) !== index);
if (enDuplicates.length > 0) {
    console.log(`\nen.ts declares ${enDuplicates.length} key(s) twice:`);
    for (const key of [...new Set(enDuplicates)]) console.log(`  ${key}`);
    failures++;
}

for (const code of ORDER) {
    const keys = keysOf(code);
    const have = keys.filter((key) => en.has(key)).length;
    const extra = keys.filter((key) => !en.has(key));
    const pct = (100 * have) / en.size;
    const bar = "#".repeat(Math.round(pct / 5)).padEnd(20, ".");
    const note = extra.length > 0 ? `  (+${extra.length} unknown)` : "";
    console.log(`  ${code.padEnd(4)} ${bar} ${String(have).padStart(4)} / ${en.size}  ${pct.toFixed(1)}%${note}`);

    if (pct < 100) failures++;
    if (extra.length > 0) {
        failures++;
        for (const key of extra) console.log(`         unknown key: ${key}`);
    }
}

const missingInEnglish = [...calledKeys()].filter(([key]) => !en.has(key));
if (missingInEnglish.length > 0) {
    console.log(`\n${missingInEnglish.length} key(s) called in code but absent from en.ts:`);
    for (const [key, file] of missingInEnglish) console.log(`  ${key}  —  ${file}`);
    failures++;
}

if (failures === 0) {
    console.log("\nall locales complete");
    process.exit(0);
}

console.log(`\n${failures} problem(s) found`);
process.exit(1);
