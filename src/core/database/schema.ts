// src/core/database/schema.ts
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  serial,
  text,
  index,
  boolean,
  bigint,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";


export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: serial("number").unique(),
  wallet: varchar("wallet", { length: 44 }).notNull().unique(),
  isBanned: boolean("is_banned").default(false).notNull(),
  bannedAt: timestamp("banned_at"),
  banReason: text("ban_reason"),
  isOnline: boolean("is_online").default(false).notNull(),
  lastSeenAt: timestamp("last_seen_at"),
  mutedUntil: timestamp("muted_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_users_wallet").on(table.wallet),
]);

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull().unique(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  coverImage: varchar("cover_image", { length: 512 }),
  backgroundImage: varchar("background_image", { length: 512 }),
  publisher: varchar("publisher", { length: 255 }),
  developer: varchar("developer", { length: 255 }),
  price: bigint("price", { mode: "number" }).default(0).notNull(),
  releaseDate: timestamp("release_date"),
  platform: varchar("platform", { length: 50 }),
  status: varchar("status", { length: 20 }).default("development").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_games_slug").on(table.slug),
  index("idx_games_price").on(table.price),
  index("idx_games_active").on(table.isActive),
  index("idx_games_status").on(table.status),
]);

export const gameLicenses = pgTable("game_licenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  gameId: uuid("game_id").notNull().references(() => games.id),
  wallet: varchar("wallet", { length: 44 }).notNull(),
  txSignature: varchar("tx_signature", { length: 88 }).unique(),
  price: bigint("price", { mode: "number" }).notNull(),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true).notNull(),
  grantedViaPromoFactionId: uuid("granted_via_promo_faction_id").references(() => factions.id, { onDelete: "set null" }),
  promoCodeUsed: varchar("promo_code_used", { length: 20 }),
}, (table) => [
  index("idx_licenses_user_game").on(table.userId, table.gameId),
  uniqueIndex("idx_licenses_user_game_active").on(table.userId, table.gameId).where(sql`is_active = true`),
  index("idx_licenses_wallet").on(table.wallet),
  index("idx_licenses_tx").on(table.txSignature),
  index("idx_licenses_active").on(table.isActive),
  index("idx_licenses_promo_faction").on(table.grantedViaPromoFactionId),
]);

export const marketplaceLots = pgTable("marketplace_lots", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").references(() => games.id),
  name: text("name").notNull(),
  price: bigint("price", { mode: "number" }).notNull(),
  type: varchar("type", { length: 20 }).notNull().default("standard"),
  imageUrl: varchar("image_url", { length: 512 }),
  status: varchar("status", { length: 20 }).notNull().default("available"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_lots_game").on(table.gameId),
  index("idx_lots_status").on(table.status),
  index("idx_lots_type").on(table.type),
  index("idx_lots_created").on(table.createdAt),
]);

export const marketplaceTransactions = pgTable("marketplace_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  lotId: uuid("lot_id").notNull().references(() => marketplaceLots.id),
  buyerId: uuid("buyer_id").notNull().references(() => users.id),
  sellerId: uuid("seller_id"),
  price: integer("price").notNull(),
  txSignature: varchar("tx_signature", { length: 88 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_transactions_lot").on(table.lotId),
  index("idx_transactions_buyer").on(table.buyerId),
  index("idx_transactions_created").on(table.createdAt),
]);

export const marketplacePurchases = pgTable("marketplace_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  wallet: varchar("wallet", { length: 44 }).notNull(),
  lotId: uuid("lot_id").notNull().references(() => marketplaceLots.id),
  txSignature: varchar("tx_signature", { length: 88 }).notNull().unique(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("confirmed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_marketplace_user").on(table.userId),
  index("idx_marketplace_wallet").on(table.wallet),
  index("idx_marketplace_tx").on(table.txSignature),
  index("idx_marketplace_lot").on(table.lotId),
  index("idx_marketplace_created").on(table.createdAt),
]);

export const gameScreenshots = pgTable("game_screenshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  url: varchar("url", { length: 512 }).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_screenshots_game").on(table.gameId),
  index("idx_screenshots_order").on(table.gameId, table.sortOrder),
]);

export const gameVideos = pgTable("game_videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  url: varchar("url", { length: 512 }).notNull(),
  title: varchar("title", { length: 255 }),
  type: varchar("type", { length: 20 }).default("trailer").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_game_videos_game").on(table.gameId),
  index("idx_game_videos_type").on(table.type),
]);

export const gameDescriptions = pgTable("game_descriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  language: varchar("language", { length: 5 }).notNull(),
  shortDescription: text("short_description"),
  fullDescription: text("full_description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_game_desc_game_lang").on(table.gameId, table.language),
]);

export const gameFeatures = pgTable("game_features", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
}, (table) => [
  index("idx_features_game").on(table.gameId),
]);

export const gameSystemRequirements = pgTable("game_system_requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(),
  os: text("os"),
  processor: text("processor"),
  memory: varchar("memory", { length: 50 }),
  graphics: text("graphics"),
  storage: varchar("storage", { length: 50 }),
  additionalNotes: text("additional_notes"),
}, (table) => [
  index("idx_game_sysreq_game").on(table.gameId),
  index("idx_game_sysreq_type").on(table.gameId, table.type),
]);

export const gameReviews = pgTable("game_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  title: varchar("title", { length: 200 }),
  content: text("content").notNull(),
  isPositive: boolean("is_positive").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_game_reviews_game").on(table.gameId),
  index("idx_game_reviews_user").on(table.userId),
  index("idx_game_reviews_rating").on(table.rating),
  uniqueIndex("idx_game_reviews_user_game").on(table.userId, table.gameId),
]);

export const gameTags = pgTable("game_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  tag: varchar("tag", { length: 50 }).notNull(),
}, (table) => [
  index("idx_game_tags_game").on(table.gameId),
  index("idx_game_tags_tag").on(table.tag),
  uniqueIndex("idx_game_tags_unique").on(table.gameId, table.tag),
]);

export const gameStats = pgTable("game_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }).unique(),
  reviewsCount: integer("reviews_count").default(0).notNull(),
  positivePercent: integer("positive_percent").default(0).notNull(),
  playersCount: varchar("players_count", { length: 20 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_stats_game").on(table.gameId),
]);

export const forumPosts = pgTable("forum_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 20 }).notNull().default("general"),
  commentsCount: integer("comments_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_forum_posts_user").on(table.userId),
  index("idx_forum_posts_category").on(table.category),
  index("idx_forum_posts_created").on(table.createdAt),
]);

export const forumComments = pgTable("forum_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull().references(() => forumPosts.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  parentId: uuid("parent_id"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_forum_comments_post").on(table.postId),
  index("idx_forum_comments_user").on(table.userId),
  index("idx_forum_comments_parent").on(table.parentId),
  index("idx_forum_comments_created").on(table.createdAt),
  index("idx_comments_post_created").on(table.postId, table.createdAt),
]);


export const gameProgress = pgTable("game_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  gameId: uuid("game_id").notNull().references(() => games.id),
  locationId: varchar("location_id", { length: 50 }).default("main-world").notNull(),
  positionX: varchar("position_x", { length: 20 }).default("0").notNull(),
  positionY: varchar("position_y", { length: 20 }).default("0").notNull(),
  positionZ: varchar("position_z", { length: 20 }).default("0").notNull(),
  rotation: varchar("rotation", { length: 20 }).default("0").notNull(),
  health: integer("health").default(100).notNull(),
  data: text("data").default("{}"),
  lastSavedAt: timestamp("last_saved_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_game_progress_user_game").on(table.userId, table.gameId),
  index("idx_game_progress_user").on(table.userId),
  index("idx_game_progress_game").on(table.gameId),
]);

export const gameNicknames = pgTable("game_nicknames", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  gameId: uuid("game_id").notNull().references(() => games.id),
  nickname: varchar("nickname", { length: 30 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_game_nicknames_user_game").on(table.userId, table.gameId),
  uniqueIndex("idx_game_nicknames_unique_ci").on(table.gameId, sql`lower(${table.nickname})`),
  index("idx_game_nicknames_nickname").on(table.nickname),
]);

export const gameBuildings = pgTable("game_buildings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  gameId: uuid("game_id").notNull().references(() => games.id),
  locationId: varchar("location_id", { length: 50 }).notNull(),
  gridX: integer("grid_x").notNull(),
  gridZ: integer("grid_z").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  rotation: integer("rotation").default(0).notNull(),
  data: text("data").default("{}"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_game_buildings_user").on(table.userId),
  index("idx_game_buildings_game").on(table.gameId),
  index("idx_game_buildings_location").on(table.locationId),
  uniqueIndex("idx_game_buildings_location_grid").on(table.userId, table.locationId, table.gridX, table.gridZ),
]);

export const gameInventories = pgTable("game_inventories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  gameId: uuid("game_id").notNull().references(() => games.id),
  slot: integer("slot").notNull(),
  itemId: varchar("item_id", { length: 50 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  data: text("data").default("{}"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_game_inventories_user_game_slot").on(table.userId, table.gameId, table.slot),
  index("idx_game_inventories_user_game").on(table.userId, table.gameId),
]);

export const gameSigns = pgTable("game_signs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  gameId: uuid("game_id").notNull().references(() => games.id),
  locationId: varchar("location_id", { length: 50 }).default("main-world").notNull(),
  positionX: varchar("position_x", { length: 20 }).notNull(),
  positionY: varchar("position_y", { length: 20 }).notNull(),
  positionZ: varchar("position_z", { length: 20 }).notNull(),
  rotation: varchar("rotation", { length: 20 }).default("0").notNull(),
  contentType: varchar("content_type", { length: 10 }),
  textContent: varchar("text_content", { length: 200 }),
  drawingUrl: varchar("drawing_url", { length: 512 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  contentSetAt: timestamp("content_set_at"),
}, (table) => [
  index("idx_game_signs_game_location").on(table.gameId, table.locationId),
  index("idx_game_signs_user").on(table.userId),
]);

export const gameStatistics = pgTable("game_statistics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  gameId: uuid("game_id").notNull().references(() => games.id),
  playtimeSeconds: integer("playtime_seconds").default(0).notNull(),
  kills: integer("kills").default(0).notNull(),
  deaths: integer("deaths").default(0).notNull(),
  shotsFired: integer("shots_fired").default(0).notNull(),
  buildingsPlaced: integer("buildings_placed").default(0).notNull(),
  lastPlayedAt: timestamp("last_played_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_game_statistics_user_game").on(table.userId, table.gameId),
]);

export const gameCharacterProgression = pgTable("game_character_progression", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  gameId: uuid("game_id").notNull().references(() => games.id),
  totalXp: integer("total_xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  branch: varchar("branch", { length: 20 }),
  skills: text("skills").default("{}").notNull(),
  loadout: text("loadout").default("{}").notNull(),
  fireMode: varchar("fire_mode", { length: 20 }).default("single").notNull(),
  respecCount: integer("respec_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_character_progression_user_game").on(table.userId, table.gameId),
  index("idx_character_progression_game_level").on(table.gameId, table.level),
]);

export const factions = pgTable("factions", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: serial("number").unique(),
  gameId: uuid("game_id").notNull().references(() => games.id),
  name: varchar("name", { length: 50 }).notNull(),
  symbol: varchar("symbol", { length: 20 }),
  image: varchar("image", { length: 512 }),
  description: text("description").default(""),
  tokenCa: varchar("token_ca", { length: 64 }),
  founderUserId: uuid("founder_user_id").notNull().references(() => users.id),
  founderWallet: varchar("founder_wallet", { length: 44 }).notNull(),
  tokenCreatorWallet: varchar("token_creator_wallet", { length: 44 }),
  verifiedCreatorUserId: uuid("verified_creator_user_id").references(() => users.id),
  verifiedCreatorWallet: varchar("verified_creator_wallet", { length: 44 }),
  activeTaskKey: varchar("active_task_key", { length: 40 }),
  activeTaskTarget: integer("active_task_target"),
  activeTaskProgress: integer("active_task_progress").default(0).notNull(),
  activeTaskRewardAsh: integer("active_task_reward_ash"),
  activeTaskAcceptedAt: timestamp("active_task_accepted_at"),
  activeTaskAcceptedByUserId: uuid("active_task_accepted_by_user_id").references(() => users.id),
  level: integer("level").default(1).notNull(),
  levelProgressAsh: integer("level_progress_ash").default(0).notNull(),
  roomAccess: varchar("room_access", { length: 12 }).default("members").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  promoCode: varchar("promo_code", { length: 20 }).unique(),
  promoCodePurchaseTx: varchar("promo_code_purchase_tx", { length: 88 }).unique(),
  promoCodePurchasedAt: timestamp("promo_code_purchased_at"),
  creationTx: varchar("creation_tx", { length: 88 }).unique(),
}, (table) => [
  uniqueIndex("idx_factions_game_name").on(table.gameId, table.name),
  index("idx_factions_token_ca").on(table.tokenCa),
  index("idx_factions_game").on(table.gameId),
]);

export const factionMembers = pgTable("faction_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  factionId: uuid("faction_id").notNull().references(() => factions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  gameId: uuid("game_id").notNull().references(() => games.id),
  wallet: varchar("wallet", { length: 44 }).notNull(),
  role: varchar("role", { length: 20 }).default("member").notNull(),
  isDisplayed: boolean("is_displayed").default(false).notNull(),
  contributionPoints: integer("contribution_points").default(0).notNull(),
  tasksContributed: integer("tasks_contributed").default(0).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_faction_members_user_faction").on(table.userId, table.factionId),
  index("idx_faction_members_user_game").on(table.userId, table.gameId),
  index("idx_faction_members_faction").on(table.factionId),
  uniqueIndex("idx_faction_members_one_displayed")
    .on(table.userId, table.gameId)
    .where(sql`${table.isDisplayed} = true`),
]);

export const factionTaskLog = pgTable("faction_task_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  factionId: uuid("faction_id").notNull().references(() => factions.id, { onDelete: "cascade" }),
  taskKey: varchar("task_key", { length: 40 }).notNull(),
  rewardAsh: integer("reward_ash").notNull(),
  rewardUserId: uuid("reward_user_id").notNull().references(() => users.id),
  rewardWallet: varchar("reward_wallet", { length: 44 }).notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
}, (table) => [
  index("idx_faction_task_log_faction").on(table.factionId),
]);

export const factionGates = pgTable("faction_gates", {
  id: uuid("id").primaryKey().defaultRandom(),
  factionId: uuid("faction_id").notNull().unique().references(() => factions.id, { onDelete: "cascade" }),
  purchaseTx: varchar("purchase_tx", { length: 88 }).unique(),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
});

export const gameCosmetics = pgTable("game_cosmetics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  gameId: uuid("game_id").notNull().references(() => games.id),
  itemId: varchar("item_id", { length: 40 }).notNull(),
  pricePaidAsh: integer("price_paid_ash").default(0).notNull(),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_game_cosmetics_user_game_item").on(table.userId, table.gameId, table.itemId),
  index("idx_game_cosmetics_user_game").on(table.userId, table.gameId),
]);

export const gameCosmeticLoadouts = pgTable("game_cosmetic_loadouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  gameId: uuid("game_id").notNull().references(() => games.id),
  skinId: varchar("skin_id", { length: 40 }),
  accessoryId: varchar("accessory_id", { length: 40 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_game_cosmetic_loadouts_user_game").on(table.userId, table.gameId),
]);

export const shopItemPrices = pgTable("shop_item_prices", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id),
  itemId: varchar("item_id", { length: 60 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("ash").notNull(),
  priceAsh: integer("price_ash").default(0).notNull(),
  priceTnj: integer("price_tnj").default(0).notNull(),
  priceUsdCents: integer("price_usd_cents").default(0).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_shop_item_prices_game_item").on(table.gameId, table.itemId),
]);

export const basementColumns = pgTable("basement_columns", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id),
  slot: integer("slot").notNull(),
  tokenCa: varchar("token_ca", { length: 64 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_basement_columns_game_slot").on(table.gameId, table.slot),
]);

// Per-event settings behind each door in the Events Hall. A missing row means
// the event runs on the defaults shipped in the client catalog and stays sealed.
export const eventConfigs = pgTable("event_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id),
  eventId: varchar("event_id", { length: 40 }).notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  title: varchar("title", { length: 60 }),
  tagline: varchar("tagline", { length: 60 }),
  description: text("description"),
  rewardText: varchar("reward_text", { length: 240 }),
  scheduleNote: varchar("schedule_note", { length: 120 }),
  // Null start/end means the door follows `enabled` alone. With a window set,
  // repeatDays > 0 makes it recur every N days from the first occurrence.
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  repeatDays: integer("repeat_days").default(0).notNull(),
  minParty: integer("min_party").default(1).notNull(),
  maxParty: integer("max_party").default(4).notNull(),
  cooldownMinutes: integer("cooldown_minutes").default(60).notNull(),
  ashPerWave: integer("ash_per_wave").default(25).notNull(),
  xpPerWave: integer("xp_per_wave").default(50).notNull(),
  ashCap: integer("ash_cap").default(1500).notNull(),
  xpCap: integer("xp_cap").default(3000).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_event_configs_game_event").on(table.gameId, table.eventId),
]);

// One row per finished event run, per participant. The door leaderboard reads
// the best row per player, so history is kept rather than overwritten.
export const eventRuns = pgTable("event_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id),
  eventId: varchar("event_id", { length: 40 }).notNull(),
  userId: uuid("user_id").notNull().references(() => users.id),
  wallet: varchar("wallet", { length: 44 }).notNull(),
  wavesCleared: integer("waves_cleared").notNull(),
  partySize: integer("party_size").default(1).notNull(),
  durationSeconds: integer("duration_seconds").default(0).notNull(),
  ashAwarded: integer("ash_awarded").default(0).notNull(),
  xpAwarded: integer("xp_awarded").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_event_runs_board").on(table.gameId, table.eventId, table.wavesCleared),
  index("idx_event_runs_user").on(table.userId),
]);

export const factionQuests = pgTable("faction_quests", {
  id: uuid("id").primaryKey().defaultRandom(),
  factionId: uuid("faction_id").notNull().references(() => factions.id, { onDelete: "cascade" }),
  gameId: uuid("game_id").notNull().references(() => games.id),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
  createdByWallet: varchar("created_by_wallet", { length: 44 }).notNull(),
  questType: varchar("quest_type", { length: 30 }).default("x_post_view").notNull(),
  targetUrl: varchar("target_url", { length: 512 }).notNull(),
  rewardAsh: integer("reward_ash").notNull(),
  slotsTotal: integer("slots_total").notNull(),
  slotsClaimed: integer("slots_claimed").default(0).notNull(),
  bankAsh: integer("bank_ash").notNull(),
  paidOutAsh: integer("paid_out_ash").default(0).notNull(),
  listingFeeAsh: integer("listing_fee_ash").default(0).notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_faction_quests_game_status").on(table.gameId, table.status),
  index("idx_faction_quests_faction").on(table.factionId),
]);

export const factionQuestCompletions = pgTable("faction_quest_completions", {
  id: uuid("id").primaryKey().defaultRandom(),
  questId: uuid("quest_id").notNull().references(() => factionQuests.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  gameId: uuid("game_id").notNull().references(() => games.id),
  wallet: varchar("wallet", { length: 44 }).notNull(),
  rewardAsh: integer("reward_ash").notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_faction_quest_completions_quest_user").on(table.questId, table.userId),
  index("idx_faction_quest_completions_user").on(table.userId),
]);

export const personalRooms = pgTable("personal_rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  gameId: uuid("game_id").notNull().references(() => games.id),
  access: varchar("access", { length: 12 }).default("public").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_personal_rooms_user_game").on(table.userId, table.gameId),
]);

export const roomInvites = pgTable("room_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerType: varchar("owner_type", { length: 10 }).notNull(),
  ownerId: uuid("owner_id").notNull(),
  invitedUserId: uuid("invited_user_id").notNull().references(() => users.id),
  usesLeft: integer("uses_left"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_room_invites_unique").on(table.ownerType, table.ownerId, table.invitedUserId),
  index("idx_room_invites_user").on(table.invitedUserId),
]);

export const placedFurniture = pgTable("placed_furniture", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  gameId: uuid("game_id").notNull().references(() => games.id),
  factionId: uuid("faction_id").notNull().references(() => factions.id, { onDelete: "cascade" }),
  itemId: varchar("item_id", { length: 50 }).notNull(),
  positionX: varchar("position_x", { length: 20 }).notNull(),
  positionY: varchar("position_y", { length: 20 }).notNull(),
  positionZ: varchar("position_z", { length: 20 }).notNull(),
  rotation: varchar("rotation", { length: 20 }).default("0").notNull(),
  contentType: varchar("content_type", { length: 10 }),
  textContent: varchar("text_content", { length: 200 }),
  drawingUrl: varchar("drawing_url", { length: 512 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  contentSetAt: timestamp("content_set_at"),
}, (table) => [
  index("idx_placed_furniture_faction").on(table.factionId),
  index("idx_placed_furniture_user").on(table.userId),
]);

// One row per buildable lot. The whole layout is a single JSON document
// instead of a row per piece: a multi-storey house is thousands of walls and
// floor tiles, and the editor always saves and loads the lot as a whole.
export const roomLayouts = pgTable("room_layouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id),
  ownerType: varchar("owner_type", { length: 10 }).notNull(),
  ownerId: uuid("owner_id").notNull(),
  revision: integer("revision").default(1).notNull(),
  data: jsonb("data").notNull(),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_room_layouts_owner").on(table.gameId, table.ownerType, table.ownerId),
]);

// P2P item trades between players. A row only ever exists for a resolved
// payment attempt (completed or failed) — in-progress negotiation (offer,
// ready checkboxes) lives only in game-server memory and never reaches here
// if no payment was ever submitted.
export const trades = pgTable("trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id),
  sellerId: uuid("seller_id").notNull().references(() => users.id),
  sellerWallet: varchar("seller_wallet", { length: 44 }).notNull(),
  buyerId: uuid("buyer_id").notNull().references(() => users.id),
  buyerWallet: varchar("buyer_wallet", { length: 44 }).notNull(),
  itemId: varchar("item_id", { length: 50 }).notNull(),
  itemName: varchar("item_name", { length: 100 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  priceTnj: bigint("price_tnj", { mode: "number" }).notNull(),
  txSignature: varchar("tx_signature", { length: 88 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull(),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_trades_game").on(table.gameId),
  index("idx_trades_seller").on(table.sellerId),
  index("idx_trades_buyer").on(table.buyerId),
  index("idx_trades_tx").on(table.txSignature),
  index("idx_trades_created").on(table.createdAt),
]);

export const shopPurchases = pgTable("shop_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  wallet: varchar("wallet", { length: 44 }).notNull(),
  itemId: varchar("item_id", { length: 60 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  priceTnj: bigint("price_tnj", { mode: "number" }).notNull(),
  txSignature: varchar("tx_signature", { length: 100 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull(),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_shop_purchases_user").on(table.userId),
  index("idx_shop_purchases_game").on(table.gameId),
  index("idx_shop_purchases_tx").on(table.txSignature),
]);

export const friendships = pgTable("friendships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  friendUserId: uuid("friend_user_id").notNull().references(() => users.id),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
}, (table) => [
  uniqueIndex("idx_friendships_pair").on(table.userId, table.friendUserId),
  index("idx_friendships_user").on(table.userId),
  index("idx_friendships_friend").on(table.friendUserId),
]);

export const playerBlocks = pgTable("player_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  blockerUserId: uuid("blocker_user_id").notNull().references(() => users.id),
  blockedUserId: uuid("blocked_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_player_blocks_pair").on(table.blockerUserId, table.blockedUserId),
  index("idx_player_blocks_blocker").on(table.blockerUserId),
]);

export const mailMessages = pgTable("mail_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderUserId: uuid("sender_user_id").notNull().references(() => users.id),
  senderWallet: varchar("sender_wallet", { length: 44 }).notNull(),
  recipientUserId: uuid("recipient_user_id").notNull().references(() => users.id),
  subject: varchar("subject", { length: 100 }).notNull(),
  body: text("body").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mail_recipient").on(table.recipientUserId),
  index("idx_mail_sender").on(table.senderUserId),
]);

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id),
  senderUserId: uuid("sender_user_id").notNull().references(() => users.id),
  senderWallet: varchar("sender_wallet", { length: 44 }).notNull(),
  senderNickname: varchar("sender_nickname", { length: 30 }).notNull(),
  factionId: uuid("faction_id"),
  message: varchar("message", { length: 500 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
  deletedByAdminWallet: varchar("deleted_by_admin_wallet", { length: 44 }),
}, (table) => [
  index("idx_chat_messages_game_created").on(table.gameId, table.createdAt),
  index("idx_chat_messages_sender").on(table.senderUserId),
]);

export const userAchievements = pgTable("user_achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  gameId: uuid("game_id").notNull().references(() => games.id),
  achievementKey: varchar("achievement_key", { length: 40 }).notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_user_achievements_user_game_key").on(table.userId, table.gameId, table.achievementKey),
  index("idx_user_achievements_user_game").on(table.userId, table.gameId),
]);

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 50 }).primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  gameId: uuid("game_id").notNull().references(() => games.id),
  wallet: varchar("wallet", { length: 44 }).notNull(),
  subject: varchar("subject", { length: 100 }).notNull().default(""),
  message: text("message").notNull(),
  status: varchar("status", { length: 20 }).default("open").notNull(),
  reply: text("reply"),
  repliedAt: timestamp("replied_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_support_tickets_status").on(table.status),
  index("idx_support_tickets_user").on(table.userId),
]);


export const usersRelations = relations(users, ({ many }) => ({
  licenses: many(gameLicenses),
  purchases: many(marketplacePurchases),
  boughtItems: many(marketplaceTransactions, { relationName: "buyer" }),
  soldItems: many(marketplaceTransactions, { relationName: "seller" }),
  tradesSold: many(trades, { relationName: "trade_seller" }),
  tradesBought: many(trades, { relationName: "trade_buyer" }),
  forumPosts: many(forumPosts),
  forumComments: many(forumComments),
  reviews: many(gameReviews),
  gameProgress: many(gameProgress),
  gameNicknames: many(gameNicknames),
  gameBuildings: many(gameBuildings),
  gameInventories: many(gameInventories),
  gameStatistics: many(gameStatistics),
  characterProgression: many(gameCharacterProgression),
  achievements: many(userAchievements),
}));

export const gamesRelations = relations(games, ({ many, one }) => ({
  licenses: many(gameLicenses),
  lots: many(marketplaceLots),
  screenshots: many(gameScreenshots),
  videos: many(gameVideos),
  descriptions: many(gameDescriptions),
  features: many(gameFeatures),
  systemRequirements: many(gameSystemRequirements),
  reviews: many(gameReviews),
  tags: many(gameTags),
  stats: one(gameStats),
}));

export const gameLicensesRelations = relations(gameLicenses, ({ one }) => ({
  user: one(users, { fields: [gameLicenses.userId], references: [users.id] }),
  game: one(games, { fields: [gameLicenses.gameId], references: [games.id] }),
}));

export const tradesRelations = relations(trades, ({ one }) => ({
  seller: one(users, { fields: [trades.sellerId], references: [users.id], relationName: "trade_seller" }),
  buyer: one(users, { fields: [trades.buyerId], references: [users.id], relationName: "trade_buyer" }),
}));

export const marketplaceLotsRelations = relations(marketplaceLots, ({ one, many }) => ({
  game: one(games, {
    fields: [marketplaceLots.gameId],
    references: [games.id],
  }),
  purchases: many(marketplacePurchases),
  transactions: many(marketplaceTransactions),
}));

export const marketplaceTransactionsRelations = relations(marketplaceTransactions, ({ one }) => ({
  lot: one(marketplaceLots, {
    fields: [marketplaceTransactions.lotId],
    references: [marketplaceLots.id],
  }),
  buyer: one(users, {
    fields: [marketplaceTransactions.buyerId],
    references: [users.id],
  }),
  seller: one(users, {
    fields: [marketplaceTransactions.sellerId],
    references: [users.id],
  }),
}));

export const marketplacePurchasesRelations = relations(marketplacePurchases, ({ one }) => ({
  user: one(users, {
    fields: [marketplacePurchases.userId],
    references: [users.id],
  }),
  lot: one(marketplaceLots, {
    fields: [marketplacePurchases.lotId],
    references: [marketplaceLots.id],
  }),
}));

export const gameScreenshotsRelations = relations(gameScreenshots, ({ one }) => ({
  game: one(games, { fields: [gameScreenshots.gameId], references: [games.id] }),
}));

export const gameVideosRelations = relations(gameVideos, ({ one }) => ({
  game: one(games, { fields: [gameVideos.gameId], references: [games.id] }),
}));

export const gameDescriptionsRelations = relations(gameDescriptions, ({ one }) => ({
  game: one(games, { fields: [gameDescriptions.gameId], references: [games.id] }),
}));

export const gameFeaturesRelations = relations(gameFeatures, ({ one }) => ({
  game: one(games, { fields: [gameFeatures.gameId], references: [games.id] }),
}));

export const gameSystemRequirementsRelations = relations(gameSystemRequirements, ({ one }) => ({
  game: one(games, { fields: [gameSystemRequirements.gameId], references: [games.id] }),
}));

export const gameReviewsRelations = relations(gameReviews, ({ one }) => ({
  game: one(games, { fields: [gameReviews.gameId], references: [games.id] }),
  user: one(users, { fields: [gameReviews.userId], references: [users.id] }),
}));

export const gameTagsRelations = relations(gameTags, ({ one }) => ({
  game: one(games, { fields: [gameTags.gameId], references: [games.id] }),
}));

export const gameStatsRelations = relations(gameStats, ({ one }) => ({
  game: one(games, { fields: [gameStats.gameId], references: [games.id] }),
}));

export const forumPostsRelations = relations(forumPosts, ({ one, many }) => ({
  user: one(users, {
    fields: [forumPosts.userId],
    references: [users.id],
  }),
  comments: many(forumComments),
}));

export const forumCommentsRelations = relations(forumComments, ({ one }) => ({
  post: one(forumPosts, {
    fields: [forumComments.postId],
    references: [forumPosts.id],
  }),
  user: one(users, {
    fields: [forumComments.userId],
    references: [users.id],
  }),
  parent: one(forumComments, {
    fields: [forumComments.parentId],
    references: [forumComments.id],
  }),
}));

export const gameProgressRelations = relations(gameProgress, ({ one }) => ({
  user: one(users, { fields: [gameProgress.userId], references: [users.id] }),
  game: one(games, { fields: [gameProgress.gameId], references: [games.id] }),
}));

export const gameNicknamesRelations = relations(gameNicknames, ({ one }) => ({
  user: one(users, { fields: [gameNicknames.userId], references: [users.id] }),
  game: one(games, { fields: [gameNicknames.gameId], references: [games.id] }),
}));

export const gameBuildingsRelations = relations(gameBuildings, ({ one }) => ({
  user: one(users, { fields: [gameBuildings.userId], references: [users.id] }),
  game: one(games, { fields: [gameBuildings.gameId], references: [games.id] }),
}));

export const gameInventoriesRelations = relations(gameInventories, ({ one }) => ({
  user: one(users, { fields: [gameInventories.userId], references: [users.id] }),
  game: one(games, { fields: [gameInventories.gameId], references: [games.id] }),
}));

export const gameStatisticsRelations = relations(gameStatistics, ({ one }) => ({
  user: one(users, { fields: [gameStatistics.userId], references: [users.id] }),
  game: one(games, { fields: [gameStatistics.gameId], references: [games.id] }),
}));

export const factionsRelations = relations(factions, ({ one, many }) => ({
  game: one(games, { fields: [factions.gameId], references: [games.id] }),
  founder: one(users, { fields: [factions.founderUserId], references: [users.id] }),
  verifiedCreator: one(users, { fields: [factions.verifiedCreatorUserId], references: [users.id] }),
  members: many(factionMembers),
  taskLog: many(factionTaskLog),
  quests: many(factionQuests),
}));

export const factionMembersRelations = relations(factionMembers, ({ one }) => ({
  faction: one(factions, { fields: [factionMembers.factionId], references: [factions.id] }),
  user: one(users, { fields: [factionMembers.userId], references: [users.id] }),
  game: one(games, { fields: [factionMembers.gameId], references: [games.id] }),
}));

export const factionTaskLogRelations = relations(factionTaskLog, ({ one }) => ({
  faction: one(factions, { fields: [factionTaskLog.factionId], references: [factions.id] }),
  rewardUser: one(users, { fields: [factionTaskLog.rewardUserId], references: [users.id] }),
}));

export const gameCosmeticsRelations = relations(gameCosmetics, ({ one }) => ({
  user: one(users, { fields: [gameCosmetics.userId], references: [users.id] }),
  game: one(games, { fields: [gameCosmetics.gameId], references: [games.id] }),
}));

export const gameCosmeticLoadoutsRelations = relations(gameCosmeticLoadouts, ({ one }) => ({
  user: one(users, { fields: [gameCosmeticLoadouts.userId], references: [users.id] }),
  game: one(games, { fields: [gameCosmeticLoadouts.gameId], references: [games.id] }),
}));

export const shopItemPricesRelations = relations(shopItemPrices, ({ one }) => ({
  game: one(games, { fields: [shopItemPrices.gameId], references: [games.id] }),
}));

export const basementColumnsRelations = relations(basementColumns, ({ one }) => ({
  game: one(games, { fields: [basementColumns.gameId], references: [games.id] }),
}));

export const eventConfigsRelations = relations(eventConfigs, ({ one }) => ({
  game: one(games, { fields: [eventConfigs.gameId], references: [games.id] }),
}));

export const eventRunsRelations = relations(eventRuns, ({ one }) => ({
  game: one(games, { fields: [eventRuns.gameId], references: [games.id] }),
  user: one(users, { fields: [eventRuns.userId], references: [users.id] }),
}));

export const factionQuestsRelations = relations(factionQuests, ({ one, many }) => ({
  faction: one(factions, { fields: [factionQuests.factionId], references: [factions.id] }),
  game: one(games, { fields: [factionQuests.gameId], references: [games.id] }),
  createdBy: one(users, { fields: [factionQuests.createdByUserId], references: [users.id] }),
  completions: many(factionQuestCompletions),
}));

export const factionQuestCompletionsRelations = relations(factionQuestCompletions, ({ one }) => ({
  quest: one(factionQuests, { fields: [factionQuestCompletions.questId], references: [factionQuests.id] }),
  user: one(users, { fields: [factionQuestCompletions.userId], references: [users.id] }),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  requester: one(users, {
    fields: [friendships.userId],
    references: [users.id],
    relationName: "friendRequester",
  }),
  recipient: one(users, {
    fields: [friendships.friendUserId],
    references: [users.id],
    relationName: "friendRecipient",
  }),
}));

export const playerBlocksRelations = relations(playerBlocks, ({ one }) => ({
  blocker: one(users, {
    fields: [playerBlocks.blockerUserId],
    references: [users.id],
    relationName: "playerBlocksBlocker",
  }),
  blocked: one(users, {
    fields: [playerBlocks.blockedUserId],
    references: [users.id],
    relationName: "playerBlocksBlocked",
  }),
}));

export const mailMessagesRelations = relations(mailMessages, ({ one }) => ({
  sender: one(users, {
    fields: [mailMessages.senderUserId],
    references: [users.id],
    relationName: "mailSender",
  }),
  recipient: one(users, {
    fields: [mailMessages.recipientUserId],
    references: [users.id],
    relationName: "mailRecipient",
  }),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, { fields: [userAchievements.userId], references: [users.id] }),
  game: one(games, { fields: [userAchievements.gameId], references: [games.id] }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  user: one(users, { fields: [supportTickets.userId], references: [users.id] }),
  game: one(games, { fields: [supportTickets.gameId], references: [games.id] }),
}));


export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

export type GameLicense = typeof gameLicenses.$inferSelect;
export type NewGameLicense = typeof gameLicenses.$inferInsert;

export type MarketplaceLot = typeof marketplaceLots.$inferSelect;
export type NewMarketplaceLot = typeof marketplaceLots.$inferInsert;

export type MarketplacePurchase = typeof marketplacePurchases.$inferSelect;
export type NewMarketplacePurchase = typeof marketplacePurchases.$inferInsert;

export type MarketplaceTransaction = typeof marketplaceTransactions.$inferSelect;
export type NewMarketplaceTransaction = typeof marketplaceTransactions.$inferInsert;

export type GameScreenshot = typeof gameScreenshots.$inferSelect;
export type NewGameScreenshot = typeof gameScreenshots.$inferInsert;

export type GameVideo = typeof gameVideos.$inferSelect;
export type NewGameVideo = typeof gameVideos.$inferInsert;

export type GameDescription = typeof gameDescriptions.$inferSelect;
export type NewGameDescription = typeof gameDescriptions.$inferInsert;

export type GameSystemRequirement = typeof gameSystemRequirements.$inferSelect;
export type NewGameSystemRequirement = typeof gameSystemRequirements.$inferInsert;

export type GameReview = typeof gameReviews.$inferSelect;
export type NewGameReview = typeof gameReviews.$inferInsert;

export type GameTag = typeof gameTags.$inferSelect;
export type NewGameTag = typeof gameTags.$inferInsert;

export type ForumPost = typeof forumPosts.$inferSelect;
export type NewForumPost = typeof forumPosts.$inferInsert;

export type ForumComment = typeof forumComments.$inferSelect;
export type NewForumComment = typeof forumComments.$inferInsert;

export type GameProgress = typeof gameProgress.$inferSelect;
export type NewGameProgress = typeof gameProgress.$inferInsert;

export type GameNickname = typeof gameNicknames.$inferSelect;
export type NewGameNickname = typeof gameNicknames.$inferInsert;

export type GameBuilding = typeof gameBuildings.$inferSelect;
export type NewGameBuilding = typeof gameBuildings.$inferInsert;

export type GameInventory = typeof gameInventories.$inferSelect;
export type NewGameInventory = typeof gameInventories.$inferInsert;

export type GameStatistic = typeof gameStatistics.$inferSelect;
export type NewGameStatistic = typeof gameStatistics.$inferInsert;

export type Faction = typeof factions.$inferSelect;
export type NewFaction = typeof factions.$inferInsert;

export type FactionMember = typeof factionMembers.$inferSelect;
export type NewFactionMember = typeof factionMembers.$inferInsert;

export type FactionTaskLog = typeof factionTaskLog.$inferSelect;
export type NewFactionTaskLog = typeof factionTaskLog.$inferInsert;

export type Friendship = typeof friendships.$inferSelect;
export type NewFriendship = typeof friendships.$inferInsert;

export type PlayerBlock = typeof playerBlocks.$inferSelect;
export type NewPlayerBlock = typeof playerBlocks.$inferInsert;

export type MailMessage = typeof mailMessages.$inferSelect;
export type NewMailMessage = typeof mailMessages.$inferInsert;

export type UserAchievement = typeof userAchievements.$inferSelect;
export type NewUserAchievement = typeof userAchievements.$inferInsert;

export type GameCharacterProgression = typeof gameCharacterProgression.$inferSelect;
export type NewGameCharacterProgression = typeof gameCharacterProgression.$inferInsert;

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;

export type EventConfig = typeof eventConfigs.$inferSelect;
export type NewEventConfig = typeof eventConfigs.$inferInsert;

export type EventRun = typeof eventRuns.$inferSelect;
export type NewEventRun = typeof eventRuns.$inferInsert;

export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;