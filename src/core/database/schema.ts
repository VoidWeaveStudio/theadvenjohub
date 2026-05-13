//src\core\database\schema.ts
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
  publisher: varchar("publisher", { length: 255 }),
  price: bigint("price", { mode: "number" }).default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_games_slug").on(table.slug),
  index("idx_games_price").on(table.price),
  index("idx_games_active").on(table.isActive),
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
  gameId: uuid("game_id").notNull().references(() => games.id),
  url: varchar("url", { length: 512 }).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_screenshots_game").on(table.gameId),
  index("idx_screenshots_order").on(table.gameId, table.sortOrder),
]);

export const gameFeatures = pgTable("game_features", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id),
  text: text("text").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
}, (table) => [
  index("idx_features_game").on(table.gameId),
]);

export const gameStats = pgTable("game_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id).unique(),
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


export const gamesRelations = relations(games, ({ many }) => ({
  licenses: many(gameLicenses),
  lots: many(marketplaceLots),
  screenshots: many(gameScreenshots),
}));

export const gameScreenshotsRelations = relations(gameScreenshots, ({ one }) => ({
  game: one(games, { fields: [gameScreenshots.gameId], references: [games.id] }),
}));

export const gameFeaturesRelations = relations(gameFeatures, ({ one }) => ({
  game: one(games, { fields: [gameFeatures.gameId], references: [games.id] }),
}));

export const gameStatsRelations = relations(gameStats, ({ one }) => ({
  game: one(games, { fields: [gameStats.gameId], references: [games.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  licenses: many(gameLicenses),
  purchases: many(marketplacePurchases),
  boughtItems: many(marketplaceTransactions, { relationName: "buyer" }),
  soldItems: many(marketplaceTransactions, { relationName: "seller" }),
  forumPosts: many(forumPosts),
  forumComments: many(forumComments),
}));

export const gameLicensesRelations = relations(gameLicenses, ({ one }) => ({
  user: one(users, { fields: [gameLicenses.userId], references: [users.id] }),
  game: one(games, { fields: [gameLicenses.gameId], references: [games.id] }),
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

export const marketplaceLotsRelations = relations(marketplaceLots, ({ one, many }) => ({
  game: one(games, {
    fields: [marketplaceLots.gameId],
    references: [games.id],
  }),
  purchases: many(marketplacePurchases),
  transactions: many(marketplaceTransactions),
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


export type MarketplaceLot = typeof marketplaceLots.$inferSelect;
export type NewMarketplaceLot = typeof marketplaceLots.$inferInsert;

export type MarketplacePurchase = typeof marketplacePurchases.$inferSelect;
export type NewMarketplacePurchase = typeof marketplacePurchases.$inferInsert;

export type MarketplaceTransaction = typeof marketplaceTransactions.$inferSelect;
export type NewMarketplaceTransaction = typeof marketplaceTransactions.$inferInsert;

export type GameScreenshot = typeof gameScreenshots.$inferSelect;
export type NewGameScreenshot = typeof gameScreenshots.$inferInsert;

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

export type GameLicense = typeof gameLicenses.$inferSelect;
export type NewGameLicense = typeof gameLicenses.$inferInsert;

export type ForumPost = typeof forumPosts.$inferSelect;
export type NewForumPost = typeof forumPosts.$inferInsert;

export type ForumComment = typeof forumComments.$inferSelect;
export type NewForumComment = typeof forumComments.$inferInsert;