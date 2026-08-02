ALTER TABLE "game_licenses" ALTER COLUMN "tx_signature" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "promo_code" varchar(20);--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "promo_code_purchase_tx" varchar(88);--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "promo_code_purchased_at" timestamp;--> statement-breakpoint
ALTER TABLE "game_licenses" ADD COLUMN "granted_via_promo_faction_id" uuid;--> statement-breakpoint
ALTER TABLE "game_licenses" ADD COLUMN "promo_code_used" varchar(20);--> statement-breakpoint
ALTER TABLE "game_licenses" ADD CONSTRAINT "game_licenses_granted_via_promo_faction_id_factions_id_fk" FOREIGN KEY ("granted_via_promo_faction_id") REFERENCES "public"."factions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_licenses_promo_faction" ON "game_licenses" USING btree ("granted_via_promo_faction_id");--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_promo_code_unique" UNIQUE("promo_code");--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_promo_code_purchase_tx_unique" UNIQUE("promo_code_purchase_tx");