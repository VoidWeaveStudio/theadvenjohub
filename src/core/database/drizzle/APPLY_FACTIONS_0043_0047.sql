-- src/core/database/drizzle/APPLY_FACTIONS_0043_0047.sql

BEGIN;

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

CREATE INDEX IF NOT EXISTS "idx_faction_ledger_faction_created" ON "faction_ledger" USING btree ("faction_id","created_at");
CREATE INDEX IF NOT EXISTS "idx_faction_ledger_user" ON "faction_ledger" USING btree ("user_id");

CREATE TABLE IF NOT EXISTS "faction_boosts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "faction_id" uuid NOT NULL REFERENCES "factions"("id") ON DELETE cascade,
    "game_id" uuid NOT NULL REFERENCES "games"("id"),
    "boost_id" varchar(32) NOT NULL,
    "expires_at" timestamp NOT NULL,
    "purchased_by_user_id" uuid REFERENCES "users"("id"),
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_faction_boosts_faction_boost" ON "faction_boosts" ("faction_id", "boost_id");
CREATE INDEX IF NOT EXISTS "idx_faction_boosts_expires" ON "faction_boosts" ("expires_at");

CREATE TABLE IF NOT EXISTS "faction_wars" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "game_id" uuid NOT NULL REFERENCES "games"("id"),
    "declarer_faction_id" uuid NOT NULL REFERENCES "factions"("id") ON DELETE cascade,
    "defender_faction_id" uuid NOT NULL REFERENCES "factions"("id") ON DELETE cascade,
    "status" varchar(16) DEFAULT 'active' NOT NULL,
    "stake_ash" integer DEFAULT 0 NOT NULL,
    "declarer_heart_hp" integer DEFAULT 0 NOT NULL,
    "defender_heart_hp" integer DEFAULT 0 NOT NULL,
    "heart_max_hp" integer DEFAULT 0 NOT NULL,
    "winner_faction_id" uuid REFERENCES "factions"("id"),
    "ended_by" varchar(16),
    "declared_by_user_id" uuid REFERENCES "users"("id"),
    "declared_at" timestamp DEFAULT now() NOT NULL,
    "ended_at" timestamp
);

CREATE INDEX IF NOT EXISTS "idx_faction_wars_declarer" ON "faction_wars" ("declarer_faction_id", "status");
CREATE INDEX IF NOT EXISTS "idx_faction_wars_defender" ON "faction_wars" ("defender_faction_id", "status");
CREATE INDEX IF NOT EXISTS "idx_faction_wars_game_status" ON "faction_wars" ("game_id", "status");

ALTER TABLE "factions" ADD COLUMN IF NOT EXISTS "war_cooldown_until" timestamp;

CREATE TABLE IF NOT EXISTS "faction_war_sides" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "war_id" uuid NOT NULL REFERENCES "faction_wars"("id") ON DELETE cascade,
    "user_id" uuid NOT NULL REFERENCES "users"("id"),
    "side_faction_id" uuid REFERENCES "factions"("id"),
    "paid_ash" integer DEFAULT 0 NOT NULL,
    "chosen_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_faction_war_sides_war_user" ON "faction_war_sides" ("war_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_faction_war_sides_user" ON "faction_war_sides" ("user_id");

ALTER TABLE "factions" ADD COLUMN IF NOT EXISTS "market_cap" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "factions" ADD COLUMN IF NOT EXISTS "market_cap_at" timestamp;

CREATE INDEX IF NOT EXISTS "idx_factions_market_cap_at" ON "factions" ("market_cap_at");

COMMIT;
