CREATE TABLE "game_character_progression" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"branch" varchar(20),
	"skills" text DEFAULT '{}' NOT NULL,
	"loadout" text DEFAULT '{}' NOT NULL,
	"fire_mode" varchar(20) DEFAULT 'single' NOT NULL,
	"respec_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_character_progression" ADD CONSTRAINT "game_character_progression_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_character_progression" ADD CONSTRAINT "game_character_progression_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_character_progression_user_game" ON "game_character_progression" USING btree ("user_id","game_id");--> statement-breakpoint
CREATE INDEX "idx_character_progression_game_level" ON "game_character_progression" USING btree ("game_id","level");