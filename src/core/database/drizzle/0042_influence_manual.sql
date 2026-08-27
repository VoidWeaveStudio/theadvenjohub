-- 0042_influence_manual.sql
-- Idempotent — safe to paste into the Neon SQL editor or psql, and safe to
-- re-run. Adds the entry ledger for the influence point; nothing existing
-- changes. The live state of the point itself lives in app_settings under
-- the "influence_state" key, the same way world_state does.

CREATE TABLE IF NOT EXISTS "influence_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL REFERENCES "public"."games"("id"),
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id"),
	"wallet" varchar(44) NOT NULL,
	"faction_id" uuid REFERENCES "public"."factions"("id") ON DELETE set null,
	"recipient_wallet" varchar(44),
	"currency" varchar(8) NOT NULL,
	"amount" numeric(20, 6) DEFAULT '0' NOT NULL,
	"tx" varchar(88),
	"credited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_influence_entries_game_created" ON "influence_entries" USING btree ("game_id","created_at");
CREATE INDEX IF NOT EXISTS "idx_influence_entries_faction" ON "influence_entries" USING btree ("faction_id");
CREATE INDEX IF NOT EXISTS "idx_influence_entries_user" ON "influence_entries" USING btree ("user_id");

-- One row per on-chain signature. This is what stops the same transaction
-- from paying for two entries; the ash path leaves tx NULL and is not covered
-- by the index, which is why the unique index has to tolerate NULLs.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_influence_entries_tx" ON "influence_entries" USING btree ("tx");
