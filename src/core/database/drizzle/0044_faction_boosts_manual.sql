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
