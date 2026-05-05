CREATE TABLE "forum_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"category" varchar(20) DEFAULT 'general' NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_warden_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"total_earned" numeric DEFAULT '0' NOT NULL,
	"balance" numeric DEFAULT '0' NOT NULL,
	"burned" numeric DEFAULT '0' NOT NULL,
	"withdrawn" numeric DEFAULT '0' NOT NULL,
	"blocked" numeric DEFAULT '0' NOT NULL,
	"burn_bonus_percent" integer DEFAULT 0 NOT NULL,
	"upgrades" jsonb DEFAULT '{}' NOT NULL,
	"skins" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_action_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_warden_progress_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"cover_image" varchar(512),
	"developer" varchar(255),
	"publisher" varchar(255),
	"release_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "games_title_unique" UNIQUE("title"),
	CONSTRAINT "games_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "marketplace_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"rarity" varchar(20) DEFAULT 'common' NOT NULL,
	"type" varchar(20) DEFAULT 'item' NOT NULL,
	"image_url" varchar(512),
	"metadata" jsonb DEFAULT '{}',
	"stock" integer DEFAULT 1,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"type" varchar(20) DEFAULT 'standard' NOT NULL,
	"image_url" varchar(512),
	"status" varchar(20) DEFAULT 'available' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketplace_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet" varchar(44),
	"lot_id" uuid,
	"tx_signature" varchar(88) NOT NULL,
	"amount" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "marketplace_purchases_tx_signature_unique" UNIQUE("tx_signature")
);
--> statement-breakpoint
CREATE TABLE "marketplace_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid,
	"price" integer NOT NULL,
	"tx_signature" varchar(88) NOT NULL,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "marketplace_transactions_tx_signature_unique" UNIQUE("tx_signature")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_wallet_unique" UNIQUE("wallet")
);
--> statement-breakpoint
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_warden_progress" ADD CONSTRAINT "game_warden_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_items" ADD CONSTRAINT "marketplace_items_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_purchases" ADD CONSTRAINT "marketplace_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_purchases" ADD CONSTRAINT "marketplace_purchases_lot_id_marketplace_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."marketplace_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_item_id_marketplace_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."marketplace_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_forum_comments_post" ON "forum_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_forum_comments_user" ON "forum_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_forum_comments_parent" ON "forum_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_forum_comments_created" ON "forum_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_comments_post_created" ON "forum_comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_forum_posts_user" ON "forum_posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_forum_posts_category" ON "forum_posts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_forum_posts_created" ON "forum_posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_game_progress_user" ON "game_warden_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_game_progress_balance" ON "game_warden_progress" USING btree ("balance");--> statement-breakpoint
CREATE INDEX "idx_game_progress_last_action" ON "game_warden_progress" USING btree ("last_action_at");--> statement-breakpoint
CREATE INDEX "idx_games_slug" ON "games" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_games_active" ON "games" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_items_game" ON "marketplace_items" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_items_rarity" ON "marketplace_items" USING btree ("rarity");--> statement-breakpoint
CREATE INDEX "idx_items_price" ON "marketplace_items" USING btree ("price");--> statement-breakpoint
CREATE INDEX "idx_items_active" ON "marketplace_items" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_items_created" ON "marketplace_items" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_lots_status" ON "marketplace_lots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_lots_type" ON "marketplace_lots" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_lots_created" ON "marketplace_lots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_marketplace_user" ON "marketplace_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_marketplace_wallet" ON "marketplace_purchases" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX "idx_marketplace_tx" ON "marketplace_purchases" USING btree ("tx_signature");--> statement-breakpoint
CREATE INDEX "idx_marketplace_created" ON "marketplace_purchases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_transactions_item" ON "marketplace_transactions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_buyer" ON "marketplace_transactions" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_created" ON "marketplace_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_users_wallet" ON "users" USING btree ("wallet");