ALTER TABLE "event_configs" ADD COLUMN "starts_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_configs" ADD COLUMN "ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_configs" ADD COLUMN "repeat_days" integer DEFAULT 0 NOT NULL;