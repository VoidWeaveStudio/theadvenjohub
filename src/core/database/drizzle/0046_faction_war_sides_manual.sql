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
