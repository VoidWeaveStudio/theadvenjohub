-- 0039_game_usdt_pricing_manual.sql
-- Idempotent — safe to paste into the Neon SQL editor or psql, and safe to
-- re-run. Lets a game be priced in USDT instead of a fixed TNJ amount.
--
-- Existing rows keep price_currency = 'tnj', so every game that is already on
-- sale behaves exactly as before until an admin switches it over.

ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "price_currency" varchar(8) DEFAULT 'tnj' NOT NULL;
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "price_usd_cents" integer DEFAULT 0 NOT NULL;
