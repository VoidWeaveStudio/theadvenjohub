CREATE TABLE "game_companion_loadouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"companion_id" varchar(40),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_companions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"item_id" varchar(40) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"acquired_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_crate_openings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"item_id" varchar(40) NOT NULL,
	"rarity" varchar(20) NOT NULL,
	"source" varchar(20) DEFAULT 'crate' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_meme_wallet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"fragments" integer DEFAULT 0 NOT NULL,
	"crates" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_companion_loadouts" ADD CONSTRAINT "game_companion_loadouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_companion_loadouts" ADD CONSTRAINT "game_companion_loadouts_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_companions" ADD CONSTRAINT "game_companions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_companions" ADD CONSTRAINT "game_companions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_crate_openings" ADD CONSTRAINT "game_crate_openings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_crate_openings" ADD CONSTRAINT "game_crate_openings_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_meme_wallet" ADD CONSTRAINT "game_meme_wallet_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_meme_wallet" ADD CONSTRAINT "game_meme_wallet_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_game_companion_loadouts_user_game" ON "game_companion_loadouts" USING btree ("user_id","game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_game_companions_user_game_item" ON "game_companions" USING btree ("user_id","game_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_game_companions_user_game" ON "game_companions" USING btree ("user_id","game_id");--> statement-breakpoint
CREATE INDEX "idx_game_crate_openings_user_game" ON "game_crate_openings" USING btree ("user_id","game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_game_meme_wallet_user_game" ON "game_meme_wallet" USING btree ("user_id","game_id");