// scripts/check-progression-catalog.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(scriptDir, "..", "src", "features", "game", "data");
const progression = JSON.parse(fs.readFileSync(path.join(dataDir, "progression.catalog.json"), "utf8"));
const skills = JSON.parse(fs.readFileSync(path.join(dataDir, "skills.catalog.json"), "utf8"));

let failures = 0;

function check(label, condition, detail) {
    const suffix = detail ? ` — ${detail}` : "";
    if (condition) {
        console.log(`  ok   ${label}${suffix}`);
    } else {
        failures++;
        console.log(`  FAIL ${label}${suffix}`);
    }
}

function xpToNext(level) {
    if (level >= progression.maxLevel) return 0;
    return Math.round(progression.xpCurve.base * Math.pow(level, progression.xpCurve.exponent));
}

function totalXp() {
    let total = 0;
    for (let level = 1; level < progression.maxLevel; level++) total += xpToNext(level);
    return total;
}

function checkProgression() {
    console.log("progression catalog");

    const skillPoints =
        (progression.maxLevel - 1) * progression.skillPoints.perLevel + progression.skillPoints.bonusLevels.length;

    check("tiers cover the level range", progression.tiers[0].minLevel === 1);
    check("tiers are ordered", progression.tiers.every((t, i) => i === 0 || t.minLevel > progression.tiers[i - 1].minLevel));
    check("last tier within max level", progression.tiers[progression.tiers.length - 1].minLevel <= progression.maxLevel);
    check(
        "every tier maps to a meme ability",
        progression.tiers.every((t) => progression.memeAbilities.some((m) => m.id === t.memeAbility)),
    );
    check(
        "meme abilities all used",
        progression.memeAbilities.every((m) => progression.tiers.some((t) => t.memeAbility === m.id)),
    );
    check("weapon tiers ordered", progression.weaponTiers.every((t, i) => i === 0 || t.minLevel > progression.weaponTiers[i - 1].minLevel));
    check("orientation quest grants exactly one level", progression.questXp.sola_orientation === xpToNext(1));
    check("respec is free early", progression.respec.freeBelowLevel > 1);
    check("pvp ultimate cap set", progression.pvpScaling.ultimateMaxHealthFraction > 0 && progression.pvpScaling.ultimateMaxHealthFraction < 1);

    const weapons = progression.weapons;
    check("every branch weapon has a config", progression.branches.every((b) => !!weapons[b.weapon]));
    check("staff bolt travels", weapons.staff.projectileSpeed > 0 && weapons.staff.maxRange > 0);
    check("staff fires slower than the rifle", weapons.staff.fireRateMs > weapons.rifle.fireRateMs);
    check("staff bolts hit harder to compensate", weapons.staff.boltDamageMult > 1);

    const riflePerSecond = 1000 / weapons.rifle.fireRateMs;
    const staffPerSecond = 1000 / weapons.staff.fireRateMs;
    const dpsRatio = (staffPerSecond * weapons.staff.boltDamageMult) / riflePerSecond;
    check("branch dps within 25% of each other", dpsRatio > 0.75 && dpsRatio < 1.25, `staff/rifle dps ${dpsRatio.toFixed(2)}`);
    check(
        "staff drain close to energy regen",
        staffPerSecond * weapons.staff.boltEnergyCost <= progression.energy.regenPerSecond * 1.5,
        `${(staffPerSecond * weapons.staff.boltEnergyCost).toFixed(1)}/s vs regen ${progression.energy.regenPerSecond}/s`,
    );
    check("single mode is neutral", weapons.singleMode.damageMult === 1 && weapons.singleMode.spreadMult === 1);

    console.log(`       total xp to ${progression.maxLevel}: ${totalXp().toLocaleString("en-US")}, skill points: ${skillPoints}`);
    return skillPoints;
}

function checkSkills(skillPoints) {
    console.log("\nskills catalog");

    const columnIds = new Set(skills.columns.map((c) => c.id));
    const byColumn = {};
    const ids = new Set();
    let duplicates = 0;
    let shapeErrors = 0;
    let unknownColumns = 0;

    for (const node of skills.nodes) {
        if (ids.has(node.id)) duplicates++;
        ids.add(node.id);

        if (!columnIds.has(node.column)) unknownColumns++;
        byColumn[node.column] = byColumn[node.column] || [];
        byColumn[node.column].push(node);

        if (node.kind === "passive" && !node.effects) shapeErrors++;
        if (node.kind === "active" && !node.ability) shapeErrors++;
        if (node.kind === "mode" && !node.mode) shapeErrors++;
        if (node.kind === "trigger" && !node.trigger) shapeErrors++;

        for (const effect of node.effects ?? []) {
            if (effect.perRank.length !== node.maxRank) {
                shapeErrors++;
                console.log(`       ${node.id}.${effect.stat}: ${effect.perRank.length} values for maxRank ${node.maxRank}`);
            }
        }
    }

    check("no duplicate node ids", duplicates === 0);
    check("all columns known", unknownColumns === 0);
    check("node shapes valid", shapeErrors === 0, `${skills.nodes.length} nodes`);

    let unreachable = 0;
    for (const [columnId, nodes] of Object.entries(byColumn)) {
        for (const node of nodes) {
            const obtainableEarlier = nodes
                .filter((other) => other.requires.columnPoints < node.requires.columnPoints)
                .reduce((sum, other) => sum + other.maxRank, 0);

            if (obtainableEarlier < node.requires.columnPoints) {
                unreachable++;
                console.log(
                    `       ${node.id} needs ${node.requires.columnPoints} points in ${columnId}, only ${obtainableEarlier} obtainable earlier`,
                );
            }
        }
    }
    check("every node reachable", unreachable === 0);

    for (const [columnId, nodes] of Object.entries(byColumn)) {
        if (columnId === "core") continue;
        const capstones = nodes.filter((n) => n.capstone);
        const beforeCapstone = nodes.filter((n) => !n.capstone).reduce((sum, n) => sum + n.maxRank, 0);
        check(`${columnId}: one capstone`, capstones.length === 1);
        check(`${columnId}: capstone affordable`, beforeCapstone >= skills.capstoneColumnPoints, `${beforeCapstone} of ${skills.capstoneColumnPoints}`);
    }

    const branchCapacity = { core: 0, gunslinger: 0, arcanist: 0 };
    const branchOf = new Map(skills.columns.map((c) => [c.id, c.branch]));
    for (const node of skills.nodes) branchCapacity[branchOf.get(node.column)] += node.maxRank;

    const gunslinger = branchCapacity.core + branchCapacity.gunslinger;
    const arcanist = branchCapacity.core + branchCapacity.arcanist;

    check("gunslinger tree bigger than the point budget", gunslinger > skillPoints, `${gunslinger} vs ${skillPoints}`);
    check("arcanist tree bigger than the point budget", arcanist > skillPoints, `${arcanist} vs ${skillPoints}`);
    check("branches are comparable in size", Math.abs(gunslinger - arcanist) <= 6, `${gunslinger} vs ${arcanist}`);
}

const points = checkProgression();
checkSkills(points);

console.log(failures === 0 ? "\nall catalog checks passed" : `\n${failures} catalog checks failed`);
process.exit(failures === 0 ? 0 : 1);
