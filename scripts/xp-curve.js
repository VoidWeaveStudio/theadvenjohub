// scripts/xp-curve.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(scriptDir, "..", "src", "features", "game", "data", "progression.catalog.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

const XP_PER_HOUR = Number(process.argv[2]) || 10000;

function xpToNext(level) {
    if (level >= catalog.maxLevel) return 0;
    return Math.round(catalog.xpCurve.base * Math.pow(level, catalog.xpCurve.exponent));
}

function tierForLevel(level) {
    let current = catalog.tiers[0];
    for (const tier of catalog.tiers) {
        if (level >= tier.minLevel) current = tier;
    }
    return current;
}

function weaponTierForLevel(level) {
    let current = catalog.weaponTiers[0];
    for (const tier of catalog.weaponTiers) {
        if (level >= tier.minLevel) current = tier;
    }
    return current;
}

function format(value) {
    return value.toLocaleString("en-US");
}

function run() {
    console.log(`curve: ${catalog.xpCurve.base} * L^${catalog.xpCurve.exponent}, max level ${catalog.maxLevel}`);
    console.log(`assumed farming rate: ${format(XP_PER_HOUR)} xp/hour\n`);
    console.log("level | to next |     total | tier      | weapon | hours");
    console.log("------+---------+-----------+-----------+--------+------");

    let total = 0;
    for (let level = 1; level <= catalog.maxLevel; level++) {
        const next = xpToNext(level);
        const tier = tierForLevel(level);
        const weapon = weaponTierForLevel(level);
        const hours = total / XP_PER_HOUR;

        const isMilestone = level === 1 || level === catalog.maxLevel || tier.minLevel === level || weapon.minLevel === level;
        if (isMilestone || level % 5 === 0) {
            console.log(
                `${String(level).padStart(5)} | ${String(format(next)).padStart(7)} | ${String(format(total)).padStart(9)} | ` +
                `${tier.name.padEnd(9)} | T${weapon.tier}     | ${hours.toFixed(1)}`
            );
        }

        total += next;
    }

    console.log(`\ntotal xp to level ${catalog.maxLevel}: ${format(total)}`);
    console.log(`at ${format(XP_PER_HOUR)} xp/hour: ${(total / XP_PER_HOUR).toFixed(1)} hours`);
    console.log(`spread over a month: ${(total / XP_PER_HOUR / 30).toFixed(1)} hours per day`);

    const points = (catalog.maxLevel - 1) * catalog.skillPoints.perLevel + catalog.skillPoints.bonusLevels.length;
    console.log(`skill points at max level: ${points}`);
}

run();
