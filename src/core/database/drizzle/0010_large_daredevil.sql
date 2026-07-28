DROP INDEX "idx_faction_members_user_game";--> statement-breakpoint
ALTER TABLE "faction_members" ADD COLUMN "is_displayed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "faction_members" SET "is_displayed" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_faction_members_user_faction" ON "faction_members" USING btree ("user_id","faction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_faction_members_one_displayed" ON "faction_members" USING btree ("user_id","game_id") WHERE "faction_members"."is_displayed" = true;--> statement-breakpoint
CREATE INDEX "idx_faction_members_user_game" ON "faction_members" USING btree ("user_id","game_id");