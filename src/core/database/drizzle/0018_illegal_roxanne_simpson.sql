CREATE TABLE "game_signs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"location_id" varchar(50) DEFAULT 'main-world' NOT NULL,
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
ALTER TABLE "game_signs" ADD CONSTRAINT "game_signs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_signs" ADD CONSTRAINT "game_signs_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_game_signs_game_location" ON "game_signs" USING btree ("game_id","location_id");--> statement-breakpoint
CREATE INDEX "idx_game_signs_user" ON "game_signs" USING btree ("user_id");