CREATE TABLE IF NOT EXISTS "shop_item_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL REFERENCES "public"."games"("id"),
	"item_id" varchar(60) NOT NULL,
	"currency" varchar(10) DEFAULT 'ash' NOT NULL,
	"price_ash" integer DEFAULT 0 NOT NULL,
	"price_tnj" integer DEFAULT 0 NOT NULL,
	"price_usd_cents" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "shop_item_prices" ADD COLUMN IF NOT EXISTS "price_tnj" integer DEFAULT 0 NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_shop_item_prices_game_item" ON "shop_item_prices" USING btree ("game_id","item_id");
