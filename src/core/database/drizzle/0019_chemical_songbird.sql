CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"sender_wallet" varchar(44) NOT NULL,
	"sender_nickname" varchar(30) NOT NULL,
	"faction_id" uuid,
	"message" varchar(500) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_admin_wallet" varchar(44)
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chat_messages_game_created" ON "chat_messages" USING btree ("game_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_sender" ON "chat_messages" USING btree ("sender_user_id");