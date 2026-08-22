-- 0038_tournaments_manual.sql
-- Idempotent — safe to paste into the Neon SQL editor or psql, and safe to
-- re-run. Adds the three billboard-tournament tables; nothing existing changes.

CREATE TABLE IF NOT EXISTS "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL REFERENCES "public"."games"("id"),
	"kind" varchar(20) NOT NULL,
	"title" varchar(80) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"rules_text" text DEFAULT '' NOT NULL,
	"reward_amount" numeric(20, 6) DEFAULT '0' NOT NULL,
	"reward_currency" varchar(8) DEFAULT 'USDC' NOT NULL,
	"reward_note" varchar(240) DEFAULT '' NOT NULL,
	"accent" varchar(9) DEFAULT '#f0b95c' NOT NULL,
	"max_entries" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"status" varchar(12) DEFAULT 'draft' NOT NULL,
	"winner_entry_id" uuid,
	"winner_decided_at" timestamp,
	"paid_at" timestamp,
	"payout_ref" varchar(200),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tournament_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL REFERENCES "public"."tournaments"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id"),
	"game_id" uuid NOT NULL REFERENCES "public"."games"("id"),
	"wallet" varchar(44) NOT NULL,
	"nickname" varchar(30),
	"skin_url" varchar(512),
	"shot_url" varchar(512),
	"x_post_url" varchar(512),
	"xp_at_join" integer DEFAULT 0 NOT NULL,
	"xp_gained" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(12) DEFAULT 'joined' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tournament_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL REFERENCES "public"."tournaments"("id") ON DELETE cascade,
	"entry_id" uuid NOT NULL REFERENCES "public"."tournament_entries"("id") ON DELETE cascade,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id"),
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tournaments_game_status" ON "tournaments" USING btree ("game_id","status");
CREATE INDEX IF NOT EXISTS "idx_tournaments_game_ends" ON "tournaments" USING btree ("game_id","ends_at");

-- One entry per player per tournament; the join route relies on this instead of
-- a read-then-write check.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tournament_entries_tournament_user" ON "tournament_entries" USING btree ("tournament_id","user_id");
CREATE INDEX IF NOT EXISTS "idx_tournament_entries_board" ON "tournament_entries" USING btree ("tournament_id","like_count");
CREATE INDEX IF NOT EXISTS "idx_tournament_entries_user" ON "tournament_entries" USING btree ("user_id");

-- The whole "strictly one like per account" rule. A vote is moved by deleting
-- and re-inserting inside one transaction, never by trusting the client.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tournament_likes_tournament_user" ON "tournament_likes" USING btree ("tournament_id","user_id");
CREATE INDEX IF NOT EXISTS "idx_tournament_likes_entry" ON "tournament_likes" USING btree ("entry_id");
