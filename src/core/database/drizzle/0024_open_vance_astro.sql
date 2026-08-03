CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"seller_wallet" varchar(44) NOT NULL,
	"buyer_id" uuid NOT NULL,
	"buyer_wallet" varchar(44) NOT NULL,
	"item_id" varchar(50) NOT NULL,
	"item_name" varchar(100) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price_tnj" bigint NOT NULL,
	"tx_signature" varchar(88) NOT NULL,
	"status" varchar(20) NOT NULL,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trades_tx_signature_unique" UNIQUE("tx_signature")
);
--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_trades_seller" ON "trades" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_trades_buyer" ON "trades" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "idx_trades_tx" ON "trades" USING btree ("tx_signature");--> statement-breakpoint
CREATE INDEX "idx_trades_created" ON "trades" USING btree ("created_at");