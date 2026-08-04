CREATE TABLE "placed_furniture" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"faction_id" uuid NOT NULL,
	"item_id" varchar(50) NOT NULL,
	"position_x" varchar(20) NOT NULL,
	"position_y" varchar(20) NOT NULL,
	"position_z" varchar(20) NOT NULL,
	"rotation" varchar(20) DEFAULT '0' NOT NULL,
	"content_type" varchar(10),
	"text_content" varchar(200),
	"drawing_url" varchar(512),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"content_set_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "placed_furniture" ADD CONSTRAINT "placed_furniture_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placed_furniture" ADD CONSTRAINT "placed_furniture_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placed_furniture" ADD CONSTRAINT "placed_furniture_faction_id_factions_id_fk" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_placed_furniture_faction" ON "placed_furniture" USING btree ("faction_id");--> statement-breakpoint
CREATE INDEX "idx_placed_furniture_user" ON "placed_furniture" USING btree ("user_id");