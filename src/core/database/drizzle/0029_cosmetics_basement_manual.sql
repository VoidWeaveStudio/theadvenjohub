CREATE TABLE IF NOT EXISTS "game_cosmetics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id"),
	"game_id" uuid NOT NULL REFERENCES "public"."games"("id"),
	"item_id" varchar(40) NOT NULL,
	"price_paid_ash" integer DEFAULT 0 NOT NULL,
	"purchased_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "game_cosmetic_loadouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id"),
	"game_id" uuid NOT NULL REFERENCES "public"."games"("id"),
	"skin_id" varchar(40),
	"accessory_id" varchar(40),
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "basement_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL REFERENCES "public"."games"("id"),
	"slot" integer NOT NULL,
	"token_ca" varchar(64),
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_game_cosmetics_user_game_item" ON "game_cosmetics" USING btree ("user_id","game_id","item_id");
CREATE INDEX IF NOT EXISTS "idx_game_cosmetics_user_game" ON "game_cosmetics" USING btree ("user_id","game_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_game_cosmetic_loadouts_user_game" ON "game_cosmetic_loadouts" USING btree ("user_id","game_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_basement_columns_game_slot" ON "basement_columns" USING btree ("game_id","slot");

INSERT INTO "basement_columns" ("game_id", "slot", "token_ca")
SELECT g.id, v.slot, v.token_ca
FROM "games" g
CROSS JOIN (VALUES
	(0, '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump'),
	(1, 'J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump'),
	(2, 'CFPkPq1eYPR8GLzEo59wUbbMioX4bshaTQiSGzTSpump'),
	(3, 'B4ptaVsUe6YbtBwAS38WFeweSrVNfQLCcj9JRrtjU8vn'),
	(4, 'Ge87EtsjwRQbHaqQmKRno69RFTwh9bfSsm99XNxTpump'),
	(5, '4MrsXQzaosYNyFd4wKDvgnC5xRtRqgXRrijFTGj9pump'),
	(6, 'BTUu1KQ1rhcmtMVGLm7unFbCR4CU6RCwxhTtK2xUpump'),
	(7, 'CWZ6BsdnjkDVTGkmL6bGbJXXig6ceef12KvyGQW14cMt'),
	(8, NULL),
	(9, NULL)
) AS v(slot, token_ca)
ON CONFLICT ("game_id", "slot") DO NOTHING;
