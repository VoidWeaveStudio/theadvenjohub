// apply-0048.mjs
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

const FILE = "./src/core/database/drizzle/0048_faction_public_page_manual.sql";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
    await client.query(readFileSync(FILE, "utf8"));
    console.log("applied", FILE);

    const columns = await client.query(`
        SELECT column_name, column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'factions'
          AND column_name IN ('slug','promo_seats','promo_seats_used','promo_min_usd_cents','page_hidden')
        ORDER BY column_name
    `);

    const index = await client.query(`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'factions' AND indexname = 'idx_factions_game_slug'
    `);

    const health = await client.query(`
        SELECT
          (SELECT count(*) FROM factions WHERE slug IS NULL)::int AS missing_slugs,
          (SELECT count(*) FROM (
             SELECT game_id, slug FROM factions GROUP BY game_id, slug HAVING count(*) > 1
           ) d)::int AS duplicate_slugs,
          (SELECT count(*) FROM factions WHERE promo_seats_used > promo_seats)::int AS over_capacity
    `);

    console.log("columns:", columns.rows.map((r) => `${r.column_name}=${r.column_default ?? "null"}`).join(", "));
    console.log("index:", index.rows.length ? index.rows[0].indexname : "MISSING");
    console.log("health:", JSON.stringify(health.rows[0]));

    const bad = health.rows[0];
    if (bad.missing_slugs > 0 || bad.duplicate_slugs > 0 || bad.over_capacity > 0 || index.rows.length === 0) {
        console.error("post-migration checks failed");
        process.exitCode = 1;
    }
} finally {
    client.release();
    await pool.end();
}
