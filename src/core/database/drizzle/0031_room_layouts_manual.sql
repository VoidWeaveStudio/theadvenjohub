CREATE TABLE IF NOT EXISTS "room_layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL REFERENCES "public"."games"("id"),
	"owner_type" varchar(10) NOT NULL,
	"owner_id" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_by_user_id" uuid REFERENCES "public"."users"("id"),
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_room_layouts_owner" ON "room_layouts" USING btree ("game_id","owner_type","owner_id");
