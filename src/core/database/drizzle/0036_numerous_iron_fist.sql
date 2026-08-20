CREATE TABLE "shop_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"item_id" varchar(60) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price_tnj" bigint NOT NULL,
	"tx_signature" varchar(100) NOT NULL,
	"status" varchar(20) NOT NULL,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shop_purchases_tx_signature_unique" UNIQUE("tx_signature")
);
--> statement-breakpoint
ALTER TABLE "shop_purchases" ADD CONSTRAINT "shop_purchases_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_purchases" ADD CONSTRAINT "shop_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_shop_purchases_user" ON "shop_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_shop_purchases_game" ON "shop_purchases" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_shop_purchases_tx" ON "shop_purchases" USING btree ("tx_signature");