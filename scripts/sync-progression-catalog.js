// scripts/sync-progression-catalog.js
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.join(scriptDir, "..", "src", "features", "game", "data");
const TARGET_DIR = path.join(scriptDir, "..", "..", "game-server");
const FILES = ["progression.catalog.json", "skills.catalog.json"];

const checkOnly = process.argv.includes("--check");

function hash(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 12);
}

function run() {
    if (!fs.existsSync(TARGET_DIR)) {
        console.error(`[sync] game-server not found at ${TARGET_DIR}`);
        process.exit(1);
    }

    let drift = 0;

    for (const file of FILES) {
        const sourcePath = path.join(SOURCE_DIR, file);
        const targetPath = path.join(TARGET_DIR, file);

        if (!fs.existsSync(sourcePath)) {
            console.error(`[sync] missing source ${sourcePath}`);
            process.exit(1);
        }

        const source = fs.readFileSync(sourcePath);

        try {
            JSON.parse(source.toString());
        } catch (err) {
            console.error(`[sync] ${file} is not valid JSON: ${err.message}`);
            process.exit(1);
        }

        const sourceHash = hash(source);
        const targetExists = fs.existsSync(targetPath);
        const targetHash = targetExists ? hash(fs.readFileSync(targetPath)) : null;

        if (sourceHash === targetHash) {
            console.log(`[sync] ${file} up to date (${sourceHash})`);
            continue;
        }

        drift++;

        if (checkOnly) {
            console.error(`[sync] ${file} DRIFT: client ${sourceHash}, server ${targetHash || "missing"}`);
            continue;
        }

        fs.writeFileSync(targetPath, source);
        console.log(`[sync] ${file} copied ${targetHash || "missing"} -> ${sourceHash}`);
    }

    if (checkOnly && drift > 0) {
        console.error("[sync] catalogs out of sync, run: npm run sync:progression");
        process.exit(1);
    }
}

run();
