import "dotenv/config";
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

const FILE = "./src/core/database/drizzle/0051_game_descriptions_i18n_manual.sql";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
    await client.query(readFileSync(FILE, "utf8"));
    console.log("applied", FILE);

    const rows = await client.query(`
        SELECT g.slug, count(*)::int AS languages, string_agg(d.language, ',' ORDER BY d.language) AS codes
        FROM game_descriptions d
        JOIN games g ON g.id = d.game_id
        GROUP BY g.slug
        ORDER BY g.slug
    `);

    console.table(rows.rows);

    const incomplete = rows.rows.filter((row) => row.languages < 12);
    if (incomplete.length > 0) {
        console.error("post-migration checks failed:", incomplete.map((row) => row.slug).join(", "));
        process.exitCode = 1;
    }
} finally {
    client.release();
    await pool.end();
}
