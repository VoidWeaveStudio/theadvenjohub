CREATE TABLE "personal_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"access" varchar(12) DEFAULT 'public' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" varchar(10) NOT NULL,
	"owner_id" uuid NOT NULL,
	"invited_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "room_access" varchar(12) DEFAULT 'members' NOT NULL;--> statement-breakpoint
ALTER TABLE "personal_rooms" ADD CONSTRAINT "personal_rooms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_rooms" ADD CONSTRAINT "personal_rooms_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_invites" ADD CONSTRAINT "room_invites_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_personal_rooms_user_game" ON "personal_rooms" USING btree ("user_id","game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_room_invites_unique" ON "room_invites" USING btree ("owner_type","owner_id","invited_user_id");--> statement-breakpoint
CREATE INDEX "idx_room_invites_user" ON "room_invites" USING btree ("invited_user_id");