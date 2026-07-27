CREATE TABLE "faction_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faction_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"game_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text DEFAULT '',
	"token_ca" varchar(64),
	"founder_user_id" uuid NOT NULL,
	"founder_wallet" varchar(44) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "factions_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "faction_members" ADD CONSTRAINT "faction_members_faction_id_factions_id_fk" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faction_members" ADD CONSTRAINT "faction_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faction_members" ADD CONSTRAINT "faction_members_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_founder_user_id_users_id_fk" FOREIGN KEY ("founder_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_faction_members_user_game" ON "faction_members" USING btree ("user_id","game_id");--> statement-breakpoint
CREATE INDEX "idx_faction_members_faction" ON "faction_members" USING btree ("faction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_factions_game_name" ON "factions" USING btree ("game_id","name");--> statement-breakpoint
CREATE INDEX "idx_factions_token_ca" ON "factions" USING btree ("token_ca");--> statement-breakpoint
CREATE INDEX "idx_factions_game" ON "factions" USING btree ("game_id");
