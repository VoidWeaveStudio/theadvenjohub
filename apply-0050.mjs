import "dotenv/config";
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

const FILE = "./src/core/database/drizzle/0050_game_platforms_manual.sql";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
    await client.query(readFileSync(FILE, "utf8"));
    console.log("applied", FILE);

    const column = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'store_links'
    `);

    const rows = await client.query(`
        SELECT slug, platform, status, store_links FROM games ORDER BY title
    `);

    console.log("store_links column:", column.rows.length === 1 ? "present" : "MISSING");
    console.table(rows.rows);

    const missing = ["memetic", "bloxaro", "skerra"].filter((slug) => !rows.rows.some((row) => row.slug === slug));
    if (column.rows.length !== 1 || missing.length > 0) {
        console.error("post-migration checks failed", missing.length > 0 ? `missing games: ${missing.join(", ")}` : "");
        process.exitCode = 1;
    }
} finally {
    client.release();
    await pool.end();
}
