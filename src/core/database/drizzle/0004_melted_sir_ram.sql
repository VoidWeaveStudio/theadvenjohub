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
CREATE TABLE "game_descriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"language" varchar(5) NOT NULL,
	"short_description" text,
	"full_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"text" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"tx_signature" varchar(88) NOT NULL,
	"price" bigint NOT NULL,
	"purchased_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "game_licenses_tx_signature_unique" UNIQUE("tx_signature")
);
--> statement-breakpoint
CREATE TABLE "game_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar(200),
	"content" text NOT NULL,
	"is_positive" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_screenshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"url" varchar(512) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"reviews_count" integer DEFAULT 0 NOT NULL,
	"positive_percent" integer DEFAULT 0 NOT NULL,
	"players_count" varchar(20),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_stats_game_id_unique" UNIQUE("game_id")
);
--> statement-breakpoint
CREATE TABLE "game_system_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"os" text,
	"processor" text,
	"memory" varchar(50),
	"graphics" text,
	"storage" varchar(50),
	"additional_notes" text
);
--> statement-breakpoint
CREATE TABLE "game_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"tag" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"url" varchar(512) NOT NULL,
	"title" varchar(255),
	"type" varchar(20) DEFAULT 'trailer' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"cover_image" varchar(512),
	"background_image" varchar(512),
	"publisher" varchar(255),
	"developer" varchar(255),
	"price" bigint DEFAULT 0 NOT NULL,
	"release_date" timestamp,
	"platform" varchar(50),
	"status" varchar(20) DEFAULT 'development' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "games_title_unique" UNIQUE("title"),
	CONSTRAINT "games_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "marketplace_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid,
	"name" text NOT NULL,
	"price" bigint NOT NULL,
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
	"wallet" varchar(44) NOT NULL,
	"lot_id" uuid NOT NULL,
	"tx_signature" varchar(88) NOT NULL,
	"amount" bigint NOT NULL,
	"status" varchar(20) DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "marketplace_purchases_tx_signature_unique" UNIQUE("tx_signature")
);
--> statement-breakpoint
CREATE TABLE "marketplace_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
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
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_wallet_unique" UNIQUE("wallet")
);
--> statement-breakpoint
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_descriptions" ADD CONSTRAINT "game_descriptions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_features" ADD CONSTRAINT "game_features_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_licenses" ADD CONSTRAINT "game_licenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_licenses" ADD CONSTRAINT "game_licenses_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_reviews" ADD CONSTRAINT "game_reviews_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_reviews" ADD CONSTRAINT "game_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_screenshots" ADD CONSTRAINT "game_screenshots_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_stats" ADD CONSTRAINT "game_stats_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_system_requirements" ADD CONSTRAINT "game_system_requirements_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_tags" ADD CONSTRAINT "game_tags_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_videos" ADD CONSTRAINT "game_videos_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_lots" ADD CONSTRAINT "marketplace_lots_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_purchases" ADD CONSTRAINT "marketplace_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_purchases" ADD CONSTRAINT "marketplace_purchases_lot_id_marketplace_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."marketplace_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_lot_id_marketplace_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."marketplace_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_transactions" ADD CONSTRAINT "marketplace_transactions_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_forum_comments_post" ON "forum_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_forum_comments_user" ON "forum_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_forum_comments_parent" ON "forum_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_forum_comments_created" ON "forum_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_comments_post_created" ON "forum_comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_forum_posts_user" ON "forum_posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_forum_posts_category" ON "forum_posts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_forum_posts_created" ON "forum_posts" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_game_desc_game_lang" ON "game_descriptions" USING btree ("game_id","language");--> statement-breakpoint
CREATE INDEX "idx_features_game" ON "game_features" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_licenses_user_game" ON "game_licenses" USING btree ("user_id","game_id");--> statement-breakpoint
CREATE INDEX "idx_licenses_wallet" ON "game_licenses" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX "idx_licenses_tx" ON "game_licenses" USING btree ("tx_signature");--> statement-breakpoint
CREATE INDEX "idx_licenses_active" ON "game_licenses" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_game_reviews_game" ON "game_reviews" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_reviews_user" ON "game_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_game_reviews_rating" ON "game_reviews" USING btree ("rating");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_game_reviews_user_game" ON "game_reviews" USING btree ("user_id","game_id");--> statement-breakpoint
CREATE INDEX "idx_screenshots_game" ON "game_screenshots" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_screenshots_order" ON "game_screenshots" USING btree ("game_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_stats_game" ON "game_stats" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_sysreq_game" ON "game_system_requirements" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_sysreq_type" ON "game_system_requirements" USING btree ("game_id","type");--> statement-breakpoint
CREATE INDEX "idx_game_tags_game" ON "game_tags" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_tags_tag" ON "game_tags" USING btree ("tag");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_game_tags_unique" ON "game_tags" USING btree ("game_id","tag");--> statement-breakpoint
CREATE INDEX "idx_game_videos_game" ON "game_videos" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_videos_type" ON "game_videos" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_games_slug" ON "games" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_games_price" ON "games" USING btree ("price");--> statement-breakpoint
CREATE INDEX "idx_games_active" ON "games" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_games_status" ON "games" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_lots_game" ON "marketplace_lots" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_lots_status" ON "marketplace_lots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_lots_type" ON "marketplace_lots" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_lots_created" ON "marketplace_lots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_marketplace_user" ON "marketplace_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_marketplace_wallet" ON "marketplace_purchases" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX "idx_marketplace_tx" ON "marketplace_purchases" USING btree ("tx_signature");--> statement-breakpoint
CREATE INDEX "idx_marketplace_lot" ON "marketplace_purchases" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "idx_marketplace_created" ON "marketplace_purchases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_transactions_lot" ON "marketplace_transactions" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_buyer" ON "marketplace_transactions" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_created" ON "marketplace_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_users_wallet" ON "users" USING btree ("wallet");