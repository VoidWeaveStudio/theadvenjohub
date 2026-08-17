// scripts/balance-report.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(scriptDir, "..", "src", "features", "game", "data");
const serverPath = path.join(scriptDir, "..", "..", "game-server", "server.js");

const progression = JSON.parse(fs.readFileSync(path.join(dataDir, "progression.catalog.json"), "utf8"));
const skills = JSON.parse(fs.readFileSync(path.join(dataDir, "skills.catalog.json"), "utf8"));

const NODES = new Map(skills.nodes.map((n) => [n.id, n]));
const BRANCH_OF_COLUMN = new Map(skills.columns.map((c) => [c.id, c.branch]));

function serverConstant(name) {
    const source = fs.readFileSync(serverPath, "utf8");
    const match = source.match(new RegExp(`const ${name} = ([\\d.]+);`));
    if (!match) throw new Error(`[balance] ${name} not found in server.js`);
    return Number(match[1]);
}

const BASE_PVP_DAMAGE = serverConstant("BASE_PVP_DAMAGE");
const BASE_MAX_HEALTH = serverConstant("BASE_MAX_HEALTH");
const ENEMY_DAMAGE = serverConstant("PLAYER_WEAPON_DAMAGE_TO_ENEMY");

function buildStats(ranks) {
    const stats = { add: {}, percent: {}, set: {} };

    for (const [nodeId, rank] of Object.entries(ranks)) {
        const node = NODES.get(nodeId);
        if (!node) throw new Error(`[balance] unknown node ${nodeId}`);

        for (const effect of node.effects ?? []) {
            const value = effect.perRank[rank - 1];
            if (typeof value !== "number") continue;

            if (effect.op === "add") stats.add[effect.stat] = (stats.add[effect.stat] || 0) + value;
            else if (effect.op === "addPercent") stats.percent[effect.stat] = (stats.percent[effect.stat] || 0) + value;
            else stats.set[effect.stat] = value;
        }
    }

    return stats;
}

function statValue(stats, key, base) {
    return (base + (stats.add[key] || 0)) * (1 + (stats.percent[key] || 0) / 100);
}

function percent(stats, key) {
    return (stats.percent[key] || 0) / 100;
}

function pointsSpent(ranks) {
    return Object.values(ranks).reduce((sum, rank) => sum + rank, 0);
}

function maxRanks(nodeIds) {
    const ranks = {};
    for (const id of nodeIds) {
        const node = NODES.get(id);
        if (!node) throw new Error(`[balance] unknown node ${id}`);
        ranks[id] = node.maxRank;
    }
    return ranks;
}

function nodesWithStat(stat, branch) {
    return skills.nodes
        .filter((n) => (n.effects ?? []).some((e) => e.stat === stat))
        .filter((n) => {
            const nodeBranch = BRANCH_OF_COLUMN.get(n.column);
            return nodeBranch === "core" || nodeBranch === branch;
        })
        .map((n) => n.id);
}

function profile(name, branch, nodeIds) {
    const ranks = maxRanks(nodeIds);
    const stats = buildStats(ranks);
    const isStaff = branch === "arcanist";
    const damageStat = isStaff ? "spellDamage" : "weaponDamage";
    const weaponMult = isStaff ? progression.weapons.staff.boltDamageMult : 1;

    return {
        name,
        branch,
        points: pointsSpent(ranks),
        maxHealth: Math.round(statValue(stats, "maxHealth", BASE_MAX_HEALTH)),
        pvpDamage: statValue(stats, damageStat, BASE_PVP_DAMAGE) * weaponMult,
        enemyDamage: statValue(stats, damageStat, ENEMY_DAMAGE) * weaponMult,
        damageTakenMult: Math.max(0.2, 1 + percent(stats, "damageTaken")),
        unshieldedBonus: 1 + percent(stats, "damageVsUnshielded"),
        maxEnergy: Math.round(statValue(stats, "maxEnergy", progression.energy.base)),
        energyRegen: statValue(stats, "energyRegen", progression.energy.regenPerSecond),
    };
}

const fresh = profile("fresh level 1", null, []);

const gunDamage = profile("gunslinger, all damage", "gunslinger", [
    ...nodesWithStat("weaponDamage", "gunslinger"),
    ...nodesWithStat("damageVsUnshielded", "gunslinger"),
]);

const gunTank = profile("gunslinger, all survival", "gunslinger", [
    ...nodesWithStat("maxHealth", "gunslinger"),
    ...nodesWithStat("damageTaken", "gunslinger"),
]);

const arcDamage = profile("arcanist, all damage", "arcanist", nodesWithStat("spellDamage", "arcanist"));

const arcTank = profile("arcanist, all survival", "arcanist", [
    ...nodesWithStat("maxHealth", "arcanist"),
    ...nodesWithStat("damageTaken", "arcanist"),
]);

const arcEnergy = profile("arcanist, all energy", "arcanist", [
    ...nodesWithStat("maxEnergy", "arcanist"),
    ...nodesWithStat("energyRegen", "arcanist"),
]);

function fireRate(weapon) {
    return 1000 / progression.weapons[weapon].fireRateMs;
}

function timeToKill(attacker, defender, shotsPerSecond, unshielded) {
    const perShot = attacker.pvpDamage * defender.damageTakenMult * (unshielded ? attacker.unshieldedBonus : 1);
    const shots = Math.ceil(defender.maxHealth / perShot);
    return { perShot, shots, seconds: shots / shotsPerSecond };
}

function pad(value, width) {
    return String(value).padStart(width);
}

console.log("=== profiles (max ranks in the listed nodes, level 50) ===\n");
console.log("build                     | pts | hp  | pvp dmg | dmg taken | unshielded | energy | regen");
console.log("--------------------------+-----+-----+---------+-----------+------------+--------+------");
for (const p of [fresh, gunDamage, gunTank, arcDamage, arcTank, arcEnergy]) {
    console.log(
        `${p.name.padEnd(25)} | ${pad(p.points, 3)} | ${pad(p.maxHealth, 3)} | ${pad(p.pvpDamage.toFixed(2), 7)} | ` +
        `${pad(p.damageTakenMult.toFixed(2), 9)} | ${pad(p.unshieldedBonus.toFixed(2), 10)} | ` +
        `${pad(p.maxEnergy, 6)} | ${pad(p.energyRegen.toFixed(1), 5)}`
    );
}

const skillPointBudget = (progression.maxLevel - 1) * progression.skillPoints.perLevel + progression.skillPoints.bonusLevels.length;
console.log(`\nskill point budget at level ${progression.maxLevel}: ${skillPointBudget}`);

console.log("\n=== pvp time to kill (single fire, no abilities, target has no shield) ===\n");
console.log("attacker                  -> defender                  | dmg/shot | shots | seconds");
console.log("--------------------------------------------------------+----------+-------+--------");

const matchups = [
    [gunDamage, fresh],
    [fresh, gunDamage],
    [gunDamage, gunTank],
    [gunTank, gunDamage],
    [arcDamage, fresh],
    [fresh, arcDamage],
    [arcDamage, gunTank],
    [gunDamage, arcTank],
];

for (const [attacker, defender] of matchups) {
    const weapon = attacker.branch === "arcanist" ? "staff" : "rifle";
    const ttk = timeToKill(attacker, defender, fireRate(weapon), true);
    console.log(
        `${attacker.name.padEnd(25)} -> ${defender.name.padEnd(25)} | ${pad(ttk.perShot.toFixed(2), 8)} | ` +
        `${pad(ttk.shots, 5)} | ${pad(ttk.seconds.toFixed(2), 7)}`
    );
}

console.log("\n=== xp anti-farm (levelGapMultiplier) ===\n");
const xp = progression.xpSources;
console.log(`penalty ${xp.levelGapPenaltyPerLevel} per level above content, floor ${xp.levelGapPenaltyFloor}`);
console.log("\ngap | multiplier | slime xp | boss xp");
console.log("----+------------+----------+--------");

const slimeXp = Math.max(1, Math.round(100 * xp.enemyHealthMultiplier));
const bossXp = Math.max(1, Math.round(600 * xp.bossHealthMultiplier));
for (const gap of [0, 5, 10, 15, 20, 25, 30, 40, 49]) {
    const mult = Math.max(xp.levelGapPenaltyFloor, Math.min(1, 1 - xp.levelGapPenaltyPerLevel * gap));
    console.log(
        `${pad(gap, 3)} | ${pad(mult.toFixed(2), 10)} | ${pad(Math.round(slimeXp * mult), 8)} | ${pad(Math.round(bossXp * mult), 7)}`
    );
}

console.log("\n=== where 50 levels of xp come from ===\n");

let totalXp = 0;
for (let level = 1; level < progression.maxLevel; level++) {
    totalXp += Math.round(progression.xpCurve.base * Math.pow(level, progression.xpCurve.exponent));
}

const canyonMax = 12;
let canyonFirstClear = 0;
for (let segment = 1; segment <= canyonMax; segment++) {
    canyonFirstClear += Math.round(xp.canyonSegmentBase + xp.canyonSegmentPerSegment * (segment - 1));
}
const canyonRepeat = Math.round(
    (xp.canyonSegmentBase + xp.canyonSegmentPerSegment * (canyonMax - 1)) * xp.canyonRepeatMultiplier
);

const oneOff = canyonFirstClear + Object.values(progression.questXp).reduce((sum, value) => sum + value, 0);

console.log(`total xp to level ${progression.maxLevel}: ${totalXp.toLocaleString("en-US")}`);
console.log(`one-off content (first clear of ${canyonMax} canyon segments + quests): ${oneOff.toLocaleString("en-US")} — ${((oneOff / totalXp) * 100).toFixed(1)}% of the curve\n`);

console.log("repeatable source            | xp each | repeats to finish the curve");
console.log("-----------------------------+---------+----------------------------");

const repeatables = [
    [`canyon segment ${canyonMax} replay`, canyonRepeat],
    ["cave boss", xp.caveBossXp],
    ["cave chest", xp.caveChestXp],
    ["faction task", xp.factionTaskXp],
    ["slime at your level", slimeXp],
    [`slime ${Math.round(1 / xp.levelGapPenaltyFloor)}+ levels below you`, Math.max(1, Math.round(slimeXp * xp.levelGapPenaltyFloor))],
];

for (const [name, value] of repeatables) {
    console.log(`${name.padEnd(28)} | ${pad(value, 7)} | ${pad(Math.ceil(totalXp / value).toLocaleString("en-US"), 27)}`);
}

console.log("\n=== respec cost ===\n");
const respec = progression.respec;
console.log(`free below level ${respec.freeBelowLevel}, base ${respec.baseCostAsh} ash, growth ${respec.growth}, cap ${respec.maxCostAsh}`);
console.log("\nrespec # | ash");
console.log("---------+-----");
for (let count = 0; count < 8; count++) {
    const cost = Math.min(respec.maxCostAsh, Math.round(respec.baseCostAsh * Math.pow(respec.growth, count)));
    console.log(`${pad(count + 1, 8)} | ${pad(cost, 4)}`);
}

console.log("\n=== energy budget ===\n");
const staff = progression.weapons.staff;
const boltsPerSecond = 1000 / staff.fireRateMs;
const boltDrain = boltsPerSecond * staff.boltEnergyCost;

for (const p of [fresh, arcEnergy]) {
    const net = p.energyRegen - boltDrain;
    const emptyIn = net >= 0 ? "never" : `${(p.maxEnergy / -net).toFixed(0)}s`;
    console.log(
        `${p.name.padEnd(25)} pool ${pad(p.maxEnergy, 3)}, regen ${p.energyRegen.toFixed(1)}/s, ` +
        `net while firing ${net >= 0 ? "+" : ""}${net.toFixed(1)}/s, empties in ${emptyIn}`
    );
}
console.log(`\nholding fire drains ${boltDrain.toFixed(1)}/s at ${boltsPerSecond.toFixed(1)} bolts/s (cost ${staff.boltEnergyCost} each)\n`);

console.log("ability             | cost | cooldown | regen time | share of pool");
console.log("--------------------+------+----------+------------+--------------");
for (const node of skills.nodes.filter((n) => n.ability)) {
    if (BRANCH_OF_COLUMN.get(node.column) !== "arcanist") continue;

    const ability = node.ability;
    const share = ability.energyCost / arcEnergy.maxEnergy;
    console.log(
        `${node.name.padEnd(19)} | ${pad(ability.energyCost, 4)} | ${pad((ability.cooldownMs / 1000).toFixed(0) + "s", 8)} | ` +
        `${pad((ability.energyCost / arcEnergy.energyRegen).toFixed(1) + "s", 10)} | ${pad((share * 100).toFixed(0) + "%", 13)}`
    );
}

console.log("\n=== weapon dps against enemies (no skills) ===\n");
console.log("weapon | mode     | dmg/shot | shots/s | dps");
console.log("-------+----------+----------+---------+------");

const modesByBranch = new Map([["gunslinger", ["single"]], ["arcanist", ["single"]]]);
for (const node of skills.nodes.filter((n) => n.mode)) {
    modesByBranch.get(BRANCH_OF_COLUMN.get(node.column)).push(node.mode.id);
}

const modeById = new Map([
    ["single", progression.weapons.singleMode],
    ...skills.nodes.filter((n) => n.mode).map((n) => [n.mode.id, n.mode]),
]);

for (const [branch, modeIds] of modesByBranch) {
    const weapon = branch === "arcanist" ? "staff" : "rifle";
    const base = ENEMY_DAMAGE * (weapon === "staff" ? staff.boltDamageMult : 1);

    for (const modeId of modeIds) {
        const mode = modeById.get(modeId);
        const perShot = base * mode.damageMult * (mode.projectiles || 1);

        let shotsPerSecond = 1000 / (mode.fireRateMs || progression.weapons[weapon].fireRateMs);
        if (mode.burstSize > 0) {
            shotsPerSecond = mode.burstSize / ((mode.fireRateMs * (mode.burstSize - 1) + mode.burstPauseMs) / 1000);
        }
        if (mode.chargeMs > 0) shotsPerSecond = 1000 / (mode.chargeMs + progression.weapons[weapon].fireRateMs);

        console.log(
            `${weapon.padEnd(6)} | ${modeId.padEnd(8)} | ${pad(perShot.toFixed(1), 8)} | ${pad(shotsPerSecond.toFixed(2), 7)} | ` +
            `${pad((perShot * shotsPerSecond).toFixed(1), 5)}`
        );
    }
}
