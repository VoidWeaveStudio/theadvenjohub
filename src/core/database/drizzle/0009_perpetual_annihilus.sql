CREATE TABLE "faction_task_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faction_id" uuid NOT NULL,
	"task_key" varchar(40) NOT NULL,
	"reward_ash" integer NOT NULL,
	"reward_user_id" uuid NOT NULL,
	"reward_wallet" varchar(44) NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "token_creator_wallet" varchar(44);--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "verified_creator_user_id" uuid;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "verified_creator_wallet" varchar(44);--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "active_task_key" varchar(40);--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "active_task_target" integer;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "active_task_progress" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "active_task_reward_ash" integer;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "active_task_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "active_task_accepted_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "faction_task_log" ADD CONSTRAINT "faction_task_log_faction_id_factions_id_fk" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faction_task_log" ADD CONSTRAINT "faction_task_log_reward_user_id_users_id_fk" FOREIGN KEY ("reward_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_faction_task_log_faction" ON "faction_task_log" USING btree ("faction_id");--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_verified_creator_user_id_users_id_fk" FOREIGN KEY ("verified_creator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_active_task_accepted_by_user_id_users_id_fk" FOREIGN KEY ("active_task_accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;