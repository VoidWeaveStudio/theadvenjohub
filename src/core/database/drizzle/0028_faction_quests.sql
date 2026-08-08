CREATE TABLE "faction_quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faction_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_by_wallet" varchar(44) NOT NULL,
	"quest_type" varchar(30) DEFAULT 'x_post_view' NOT NULL,
	"target_url" varchar(512) NOT NULL,
	"reward_ash" integer NOT NULL,
	"slots_total" integer NOT NULL,
	"slots_claimed" integer DEFAULT 0 NOT NULL,
	"bank_ash" integer NOT NULL,
	"paid_out_ash" integer DEFAULT 0 NOT NULL,
	"listing_fee_ash" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "faction_quest_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quest_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"reward_ash" integer NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "faction_quests" ADD CONSTRAINT "faction_quests_faction_id_factions_id_fk" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faction_quests" ADD CONSTRAINT "faction_quests_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faction_quests" ADD CONSTRAINT "faction_quests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faction_quest_completions" ADD CONSTRAINT "faction_quest_completions_quest_id_faction_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."faction_quests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faction_quest_completions" ADD CONSTRAINT "faction_quest_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faction_quest_completions" ADD CONSTRAINT "faction_quest_completions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_faction_quests_game_status" ON "faction_quests" USING btree ("game_id","status");--> statement-breakpoint
CREATE INDEX "idx_faction_quests_faction" ON "faction_quests" USING btree ("faction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_faction_quest_completions_quest_user" ON "faction_quest_completions" USING btree ("quest_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_faction_quest_completions_user" ON "faction_quest_completions" USING btree ("user_id");
