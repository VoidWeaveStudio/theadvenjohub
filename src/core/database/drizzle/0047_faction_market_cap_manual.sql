ALTER TABLE "factions" ADD COLUMN IF NOT EXISTS "market_cap" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "factions" ADD COLUMN IF NOT EXISTS "market_cap_at" timestamp;

CREATE INDEX IF NOT EXISTS "idx_factions_market_cap_at" ON "factions" ("market_cap_at");
