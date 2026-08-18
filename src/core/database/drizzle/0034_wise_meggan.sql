CREATE TABLE "event_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"event_id" varchar(40) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"title" varchar(60),
	"tagline" varchar(60),
	"description" text,
	"reward_text" varchar(240),
	"schedule_note" varchar(120),
	"min_party" integer DEFAULT 1 NOT NULL,
	"max_party" integer DEFAULT 4 NOT NULL,
	"cooldown_minutes" integer DEFAULT 60 NOT NULL,
	"ash_per_wave" integer DEFAULT 25 NOT NULL,
	"xp_per_wave" integer DEFAULT 50 NOT NULL,
	"ash_cap" integer DEFAULT 1500 NOT NULL,
	"xp_cap" integer DEFAULT 3000 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"event_id" varchar(40) NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"waves_cleared" integer NOT NULL,
	"party_size" integer DEFAULT 1 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"ash_awarded" integer DEFAULT 0 NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_configs" ADD CONSTRAINT "event_configs_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_runs" ADD CONSTRAINT "event_runs_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_runs" ADD CONSTRAINT "event_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_event_configs_game_event" ON "event_configs" USING btree ("game_id","event_id");--> statement-breakpoint
CREATE INDEX "idx_event_runs_board" ON "event_runs" USING btree ("game_id","event_id","waves_cleared");--> statement-breakpoint
CREATE INDEX "idx_event_runs_user" ON "event_runs" USING btree ("user_id");