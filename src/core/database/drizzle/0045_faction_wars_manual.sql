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
