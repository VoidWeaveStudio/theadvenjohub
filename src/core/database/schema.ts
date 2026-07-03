// src/core/database/schema.ts
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  text,
  index,
  boolean,
  bigint,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";


export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  wallet: varchar("wallet", { length: 44 }).notNull().unique(),
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
  txSignature: varchar("tx_signature", { length: 88 }).notNull().unique(),
  price: bigint("price", { mode: "number" }).notNull(),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
  index("idx_licenses_user_game").on(table.userId, table.gameId),
  index("idx_licenses_wallet").on(table.wallet),
  index("idx_licenses_tx").on(table.txSignature),
  index("idx_licenses_active").on(table.isActive),
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
  uniqueIndex("idx_game_buildings_location_grid").on(table.locationId, table.gridX, table.gridZ),
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


export const usersRelations = relations(users, ({ many }) => ({
  licenses: many(gameLicenses),
  purchases: many(marketplacePurchases),
  boughtItems: many(marketplaceTransactions, { relationName: "buyer" }),
  soldItems: many(marketplaceTransactions, { relationName: "seller" }),
  forumPosts: many(forumPosts),
  forumComments: many(forumComments),
  reviews: many(gameReviews),
  gameProgress: many(gameProgress),
  gameNicknames: many(gameNicknames),
  gameBuildings: many(gameBuildings),
  gameInventories: many(gameInventories),
  gameStatistics: many(gameStatistics),
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