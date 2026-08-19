// scripts/check-i18n.js
// Reports how much of the English key set each locale covers. Run after every
// translation batch so a half-filled language is visible instead of silently
// falling back to English.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = path.join(here, "..", "src", "core", "i18n", "locales");
const ORDER = ["ru", "be", "es", "it", "zh", "ja", "ko", "vi", "id", "fil"];

function keysOf(code) {
    const src = fs.readFileSync(path.join(LOCALES, `${code}.ts`), "utf8");
    return new Set([...src.matchAll(/^\s*"([^"]+)":\s/gm)].map((m) => m[1]));
}

const en = keysOf("en");
console.log(`i18n coverage — ${en.size} English keys`);

let failures = 0;
for (const code of ORDER) {
    const have = [...keysOf(code)].filter((key) => en.has(key)).length;
    const pct = (100 * have) / en.size;
    const bar = "#".repeat(Math.round(pct / 5)).padEnd(20, ".");
    console.log(`  ${code.padEnd(4)} ${bar} ${String(have).padStart(4)} / ${en.size}  ${pct.toFixed(1)}%`);
    if (pct < 100) failures++;
}

console.log(failures === 0 ? "\nall locales complete" : `\n${failures} locale(s) still incomplete`);
