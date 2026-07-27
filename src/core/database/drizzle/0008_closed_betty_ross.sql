CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"friend_user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "mail_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"sender_wallet" varchar(44) NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"subject" varchar(100) NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_friend_user_id_users_id_fk" FOREIGN KEY ("friend_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_messages" ADD CONSTRAINT "mail_messages_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_friendships_pair" ON "friendships" USING btree ("user_id","friend_user_id");--> statement-breakpoint
CREATE INDEX "idx_friendships_user" ON "friendships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_friendships_friend" ON "friendships" USING btree ("friend_user_id");--> statement-breakpoint
CREATE INDEX "idx_mail_recipient" ON "mail_messages" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "idx_mail_sender" ON "mail_messages" USING btree ("sender_user_id");