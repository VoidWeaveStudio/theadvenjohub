CREATE TABLE "faction_gates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faction_id" uuid NOT NULL,
	"purchase_tx" varchar(88) NOT NULL,
	"purchased_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "faction_gates_faction_id_unique" UNIQUE("faction_id"),
	CONSTRAINT "faction_gates_purchase_tx_unique" UNIQUE("purchase_tx")
);
--> statement-breakpoint
ALTER TABLE "faction_gates" ADD CONSTRAINT "faction_gates_faction_id_factions_id_fk" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;