CREATE TABLE IF NOT EXISTS "factions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"game_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"symbol" varchar(20),
	"image" varchar(512),
	"description" text DEFAULT '',
	"token_ca" varchar(64),
	"founder_user_id" uuid NOT NULL,
	"founder_wallet" varchar(44) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "factions_number_unique" UNIQUE("number")
);

CREATE TABLE IF NOT EXISTS "faction_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faction_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "factions" ADD COLUMN IF NOT EXISTS "symbol" varchar(20);
ALTER TABLE "factions" ADD COLUMN IF NOT EXISTS "image" varchar(512);

DO $$ BEGIN
  ALTER TABLE "faction_members" ADD CONSTRAINT "faction_members_faction_id_factions_id_fk" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "faction_members" ADD CONSTRAINT "faction_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "faction_members" ADD CONSTRAINT "faction_members_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "factions" ADD CONSTRAINT "factions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "factions" ADD CONSTRAINT "factions_founder_user_id_users_id_fk" FOREIGN KEY ("founder_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_faction_members_user_game" ON "faction_members" USING btree ("user_id","game_id");
CREATE INDEX IF NOT EXISTS "idx_faction_members_faction" ON "faction_members" USING btree ("faction_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_factions_game_name" ON "factions" USING btree ("game_id","name");
CREATE INDEX IF NOT EXISTS "idx_factions_token_ca" ON "factions" USING btree ("token_ca");
CREATE INDEX IF NOT EXISTS "idx_factions_game" ON "factions" USING btree ("game_id");

CREATE TABLE IF NOT EXISTS "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"friend_user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp
);

CREATE TABLE IF NOT EXISTS "mail_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"sender_wallet" varchar(44) NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"subject" varchar(100) NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "friendships" ADD CONSTRAINT "friendships_friend_user_id_users_id_fk" FOREIGN KEY ("friend_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_friendships_pair" ON "friendships" USING btree ("user_id","friend_user_id");
CREATE INDEX IF NOT EXISTS "idx_friendships_user" ON "friendships" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_friendships_friend" ON "friendships" USING btree ("friend_user_id");
CREATE INDEX IF NOT EXISTS "idx_mail_recipient" ON "mail_messages" USING btree ("recipient_user_id");
CREATE INDEX IF NOT EXISTS "idx_mail_sender" ON "mail_messages" USING btree ("sender_user_id");
