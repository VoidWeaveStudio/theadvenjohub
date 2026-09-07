// apply-0049.mjs
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

const FILE = "./src/core/database/drizzle/0049_faction_page_stats_manual.sql";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
    await client.query(readFileSync(FILE, "utf8"));
    console.log("applied", FILE);

    const columns = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'faction_page_stats'
        ORDER BY ordinal_position
    `);

    const index = await client.query(`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'faction_page_stats'
        ORDER BY indexname
    `);

    console.log("columns:", columns.rows.map((r) => r.column_name).join(", ") || "MISSING");
    console.log("indexes:", index.rows.map((r) => r.indexname).join(", ") || "MISSING");

    if (columns.rows.length === 0) {
        console.error("post-migration checks failed");
        process.exitCode = 1;
    }
} finally {
    client.release();
    await pool.end();
}
