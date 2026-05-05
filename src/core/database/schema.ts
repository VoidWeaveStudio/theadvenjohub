//src\core\database\schema.ts
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  text,
  index,
  numeric,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  wallet: varchar("wallet", { length: 44 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_users_wallet").on(table.wallet),
]);

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull().unique(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  coverImage: varchar("cover_image", { length: 512 }),
  developer: varchar("developer", { length: 255 }),
  publisher: varchar("publisher", { length: 255 }),
  releaseDate: timestamp("release_date"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_games_slug").on(table.slug),
  index("idx_games_active").on(table.isActive),
]);

export const marketplaceItems = pgTable("marketplace_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").references(() => games.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: integer("price").notNull(),
  rarity: varchar("rarity", { length: 20 }).notNull().default("common"),
  type: varchar("type", { length: 20 }).notNull().default("item"),
  imageUrl: varchar("image_url", { length: 512 }),
  metadata: jsonb("metadata").default("{}"),
  stock: integer("stock").default(1),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_items_game").on(table.gameId),
  index("idx_items_rarity").on(table.rarity),
  index("idx_items_price").on(table.price),
  index("idx_items_active").on(table.isActive),
  index("idx_items_created").on(table.createdAt),
]);

export const marketplaceTransactions = pgTable("marketplace_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => marketplaceItems.id),
  buyerId: uuid("buyer_id").notNull().references(() => users.id),
  sellerId: uuid("seller_id"),
  price: integer("price").notNull(),
  txSignature: varchar("tx_signature", { length: 88 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_transactions_item").on(table.itemId),
  index("idx_transactions_buyer").on(table.buyerId),
  index("idx_transactions_created").on(table.createdAt),
]);

export const marketplaceLots = pgTable("marketplace_lots", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(),
  type: varchar("type", { length: 20 }).notNull().default("standard"),
  imageUrl: varchar("image_url", { length: 512 }),
  status: varchar("status", { length: 20 }).notNull().default("available"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_lots_status").on(table.status),
  index("idx_lots_type").on(table.type),
  index("idx_lots_created").on(table.createdAt),
]);

export const marketplacePurchases = pgTable("marketplace_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  wallet: varchar("wallet", { length: 44 }),
  lotId: uuid("lot_id").references(() => marketplaceLots.id),
  txSignature: varchar("tx_signature", { length: 88 }).notNull().unique(),
  amount: integer("amount").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_marketplace_user").on(table.userId),
  index("idx_marketplace_wallet").on(table.wallet),
  index("idx_marketplace_tx").on(table.txSignature),
  index("idx_marketplace_created").on(table.createdAt),
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

export const gameWardenProgress = pgTable("game_warden_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id).unique(),
  totalEarned: numeric("total_earned").notNull().default("0"),
  balance: numeric("balance").notNull().default("0"),
  burned: numeric("burned").notNull().default("0"),
  withdrawn: numeric("withdrawn").notNull().default("0"),
  blocked: numeric("blocked").notNull().default("0"),
  burnBonusPercent: integer("burn_bonus_percent").notNull().default(0),
  upgrades: jsonb("upgrades").notNull().default("{}"),
  skins: jsonb("skins").notNull().default("{}"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastActionAt: timestamp("last_action_at").defaultNow().notNull(),
}, (table) => [
  index("idx_game_progress_user").on(table.userId),
  index("idx_game_progress_balance").on(table.balance),
  index("idx_game_progress_last_action").on(table.lastActionAt),
]);

export const gamesRelations = relations(games, ({ many }) => ({
  items: many(marketplaceItems),
}));

export const marketplaceItemsRelations = relations(marketplaceItems, ({ one, many }) => ({
  game: one(games, {
    fields: [marketplaceItems.gameId],
    references: [games.id],
  }),
  transactions: many(marketplaceTransactions),
}));

export const marketplaceTransactionsRelations = relations(marketplaceTransactions, ({ one }) => ({
  item: one(marketplaceItems, {
    fields: [marketplaceTransactions.itemId],
    references: [marketplaceItems.id],
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

export const marketplaceLotsRelations = relations(marketplaceLots, ({ many }) => ({
  purchases: many(marketplacePurchases),
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

export const usersRelations = relations(users, ({ one, many }) => ({
  wardenProgress: one(gameWardenProgress),
  purchases: many(marketplacePurchases),
  boughtItems: many(marketplaceTransactions, { relationName: "buyer" }),
  soldItems: many(marketplaceTransactions, { relationName: "seller" }),
}));

export const gameWardenProgressRelations = relations(gameWardenProgress, ({ one }) => ({
  user: one(users, {
    fields: [gameWardenProgress.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

export type MarketplaceItem = typeof marketplaceItems.$inferSelect;
export type NewMarketplaceItem = typeof marketplaceItems.$inferInsert;

export type MarketplaceTransaction = typeof marketplaceTransactions.$inferSelect;
export type NewMarketplaceTransaction = typeof marketplaceTransactions.$inferInsert;

export type MarketplaceLot = typeof marketplaceLots.$inferSelect;
export type NewMarketplaceLot = typeof marketplaceLots.$inferInsert;

export type MarketplacePurchase = typeof marketplacePurchases.$inferSelect;
export type NewMarketplacePurchase = typeof marketplacePurchases.$inferInsert;

export type ForumPost = typeof forumPosts.$inferSelect;
export type NewForumPost = typeof forumPosts.$inferInsert;

export type ForumComment = typeof forumComments.$inferSelect;
export type NewForumComment = typeof forumComments.$inferInsert;

export type GameWardenProgress = typeof gameWardenProgress.$inferSelect;
export type NewGameWardenProgress = typeof gameWardenProgress.$inferInsert;