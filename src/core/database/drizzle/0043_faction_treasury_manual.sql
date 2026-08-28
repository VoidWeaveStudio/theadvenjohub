-- 0043_faction_treasury_manual.sql
-- Idempotent — safe to paste into the Neon SQL editor or psql, and safe to
-- re-run. Adds the faction treasury, the ledger that every movement of it is
-- written to, and the per-member permission mask.
--
-- Nothing existing is dropped here: room_access stays until the public-bubble
-- step, and the old faction_task_log keeps its history.

ALTER TABLE "factions" ADD COLUMN IF NOT EXISTS "treasury_ash" integer DEFAULT 0 NOT NULL;
ALTER TABLE "factions" ADD COLUMN IF NOT EXISTS "treasury_companion_fragments" integer DEFAULT 0 NOT NULL;
ALTER TABLE "factions" ADD COLUMN IF NOT EXISTS "treasury_cosmetic_fragments" integer DEFAULT 0 NOT NULL;

ALTER TABLE "faction_members" ADD COLUMN IF NOT EXISTS "permissions" integer DEFAULT 0 NOT NULL;
ALTER TABLE "faction_members" ADD COLUMN IF NOT EXISTS "role_title" varchar(24);

CREATE TABLE IF NOT EXISTS "faction_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faction_id" uuid NOT NULL REFERENCES "public"."factions"("id") ON DELETE cascade,
	"game_id" uuid NOT NULL REFERENCES "public"."games"("id"),
	"kind" varchar(24) NOT NULL,
	"ash" integer DEFAULT 0 NOT NULL,
	"companion_fragments" integer DEFAULT 0 NOT NULL,
	"cosmetic_fragments" integer DEFAULT 0 NOT NULL,
	"user_id" uuid REFERENCES "public"."users"("id"),
	"note" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- The treasury tab reads the newest rows for one faction, so the index is on
-- that pair rather than on created_at alone.
CREATE INDEX IF NOT EXISTS "idx_faction_ledger_faction_created" ON "faction_ledger" USING btree ("faction_id","created_at");
CREATE INDEX IF NOT EXISTS "idx_faction_ledger_user" ON "faction_ledger" USING btree ("user_id");
