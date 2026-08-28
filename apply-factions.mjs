// apply-factions.mjs
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

const FILE = "./src/core/database/drizzle/APPLY_FACTIONS_0043_0047.sql";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
    await client.query(readFileSync(FILE, "utf8"));
    console.log("applied", FILE);

    const tables = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('faction_ledger','faction_boosts','faction_wars','faction_war_sides')
        ORDER BY table_name
    `);

    const factionCols = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'factions'
          AND column_name IN ('treasury_ash','treasury_companion_fragments','treasury_cosmetic_fragments','war_cooldown_until','market_cap','market_cap_at')
        ORDER BY column_name
    `);

    const memberCols = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'faction_members'
          AND column_name IN ('permissions','role_title')
        ORDER BY column_name
    `);

    console.log(`tables   ${tables.rows.length}/4 :`, tables.rows.map((r) => r.table_name).join(", "));
    console.log(`factions ${factionCols.rows.length}/6 :`, factionCols.rows.map((r) => r.column_name).join(", "));
    console.log(`members  ${memberCols.rows.length}/2 :`, memberCols.rows.map((r) => r.column_name).join(", "));

    const complete = tables.rows.length === 4 && factionCols.rows.length === 6 && memberCols.rows.length === 2;
    console.log(complete ? "\nOK — all faction objects are in place" : "\nSOMETHING IS MISSING — see the counts above");
    if (!complete) process.exitCode = 1;
} catch (err) {
    console.error("FAILED, nothing was committed:", err.message);
    process.exitCode = 1;
} finally {
    client.release();
    await pool.end();
}
