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
export const paperAccounts = sqliteTable("paper_accounts", {
  ownerId: text("owner_id").primaryKey(),
  cashCents: integer("cash_cents").notNull().default(10000000),
  version: integer("version").notNull().default(0),
  benchmarkAdjusted: real("benchmark_adjusted").notNull(),
  benchmarkDate: text("benchmark_date").notNull(),
  createdAt: text("created_at").notNull(),
});
export const paperTrades = sqliteTable(
  "paper_trades",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    requestId: text("request_id").notNull(),
    accountVersion: integer("account_version").notNull(),
    symbol: text("symbol").notNull(),
    side: text("side").notNull(),
    quantityUnits: integer("quantity_units").notNull(),
    priceCents: integer("price_cents").notNull(),
    amountCents: integer("amount_cents").notNull(),
    feeCents: integer("fee_cents").notNull().default(0),
    priceDate: text("price_date").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("paper_order_identity").on(table.ownerId, table.requestId),
    uniqueIndex("paper_account_sequence").on(
      table.ownerId,
      table.accountVersion,
    ),
  ],
);
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
