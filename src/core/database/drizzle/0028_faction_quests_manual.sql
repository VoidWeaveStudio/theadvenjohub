-- 0028_faction_quests_manual.sql
-- Idempotent version of 0028_faction_quests.sql — safe to paste into the Neon
-- SQL editor or psql and safe to re-run. Adds the two faction-quest tables;
-- no existing table is altered.

CREATE TABLE IF NOT EXISTS "faction_quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faction_id" uuid NOT NULL REFERENCES "public"."factions"("id") ON DELETE cascade,
	"game_id" uuid NOT NULL REFERENCES "public"."games"("id"),
	"created_by_user_id" uuid NOT NULL REFERENCES "public"."users"("id"),
	"created_by_wallet" varchar(44) NOT NULL,
	"quest_type" varchar(30) DEFAULT 'x_post_view' NOT NULL,
	"target_url" varchar(512) NOT NULL,
	"reward_ash" integer NOT NULL,
	"slots_total" integer NOT NULL,
	"slots_claimed" integer DEFAULT 0 NOT NULL,
	"bank_ash" integer NOT NULL,
	"paid_out_ash" integer DEFAULT 0 NOT NULL,
	"listing_fee_ash" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "faction_quest_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quest_id" uuid NOT NULL REFERENCES "public"."faction_quests"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id"),
	"game_id" uuid NOT NULL REFERENCES "public"."games"("id"),
	"wallet" varchar(44) NOT NULL,
	"reward_ash" integer NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_faction_quests_game_status" ON "faction_quests" USING btree ("game_id","status");
CREATE INDEX IF NOT EXISTS "idx_faction_quests_faction" ON "faction_quests" USING btree ("faction_id");

-- This unique index is what actually blocks a player from claiming the same
-- quest twice — the claim route inserts the completion row before reserving a slot.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_faction_quest_completions_quest_user" ON "faction_quest_completions" USING btree ("quest_id","user_id");
CREATE INDEX IF NOT EXISTS "idx_faction_quest_completions_user" ON "faction_quest_completions" USING btree ("user_id");
