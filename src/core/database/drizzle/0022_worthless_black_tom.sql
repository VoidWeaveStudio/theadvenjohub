ALTER TABLE "factions" ADD COLUMN "creation_tx" varchar(88);--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_creation_tx_unique" UNIQUE("creation_tx");