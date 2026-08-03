ALTER TABLE "trades" ADD COLUMN "game_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_trades_game" ON "trades" USING btree ("game_id");