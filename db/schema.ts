import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const preferences = sqliteTable("preferences", {
  userId: text("user_id").primaryKey(),
  watchlist: text("watchlist").notNull().default('["IBM"]'),
  keyCipher: text("key_cipher"),
  dailyLimit: integer("daily_limit").notNull().default(25),
  updatedAt: text("updated_at").notNull(),
});
export const marketCache = sqliteTable("market_cache", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  body: text("body").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const usage = sqliteTable("provider_usage", {
  id: text("id").primaryKey(),
  calls: integer("calls").notNull().default(0),
});
export const holdings = sqliteTable("holdings", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  symbol: text("symbol").notNull(),
  quantity: real("quantity").notNull(),
  costBasis: real("cost_basis").notNull(),
  createdAt: text("created_at").notNull(),
});
export const forecastRecords = sqliteTable(
  "forecast_records",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    symbol: text("symbol").notNull(),
    horizon: integer("horizon").notNull(),
    modelVersion: text("model_version").notNull(),
    asOf: text("as_of").notNull(),
    target: text("target").notNull(),
    createdAt: text("created_at").notNull(),
    forecastJson: text("forecast_json").notNull(),
    actualReturn: real("actual_return"),
    settledAt: text("settled_at"),
  },
  (table) => [
    uniqueIndex("forecast_identity").on(
      table.ownerId,
      table.symbol,
      table.horizon,
      table.modelVersion,
      table.asOf,
    ),
  ],
);
