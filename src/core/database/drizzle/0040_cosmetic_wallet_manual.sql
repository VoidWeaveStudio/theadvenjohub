-- 0040_cosmetic_wallet_manual.sql
-- Idempotent — safe to paste into the Neon SQL editor or psql, and safe to
-- re-run. Adds the cosmetic fragment/crate wallet that shipped in schema.ts
-- without a migration; nothing existing changes.

CREATE TABLE IF NOT EXISTS "game_cosmetic_wallet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id"),
	"game_id" uuid NOT NULL REFERENCES "public"."games"("id"),
	"fragments" integer DEFAULT 0 NOT NULL,
	"crates" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- One wallet row per player per game; ensureWalletRow() relies on this for its
-- ON CONFLICT DO NOTHING insert.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_game_cosmetic_wallet_user_game" ON "game_cosmetic_wallet" USING btree ("user_id","game_id");
