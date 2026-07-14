import { boolean, double, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Real estate agent leads. Pre-loaded from oregon_agents_data.json (isCustom=false)
 * plus manually added agents (isCustom=true).
 */
export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  /** US state this agent belongs to, e.g. "Oregon". Only Oregon has data today. */
  state: varchar("state", { length: 32 }).default("Oregon").notNull(),
  brokerage: varchar("brokerage", { length: 255 }),
  cityArea: varchar("cityArea", { length: 255 }),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 320 }),
  websiteBioUrl: text("websiteBioUrl"),
  zillowUrl: text("zillowUrl"),
  headshotUrl: text("headshotUrl"),
  buyerSideTransactions: text("buyerSideTransactions"),
  salesLast12Months: varchar("salesLast12Months", { length: 255 }),
  otherProductionStats: text("otherProductionStats"),
  realtrendsRank: int("realtrendsRank"),
  realtrendsTotalSides: double("realtrendsTotalSides"),
  realtrendsVolume: varchar("realtrendsVolume", { length: 64 }),
  realtrendsVolumeNum: double("realtrendsVolumeNum"),
  dataSources: text("dataSources"),
  // Principal broker & office-level buyside data (from office_broker_data.json)
  principalBrokerName: varchar("principalBrokerName", { length: 255 }),
  principalBrokerTitle: varchar("principalBrokerTitle", { length: 255 }),
  principalBrokerPhone: varchar("principalBrokerPhone", { length: 64 }),
  principalBrokerEmail: varchar("principalBrokerEmail", { length: 320 }),
  principalBrokerHeadshotUrl: text("principalBrokerHeadshotUrl"),
  officeBuysideTransactions: int("officeBuysideTransactions"),
  officeBuysideRank: int("officeBuysideRank"),
  officeEstimationNotes: text("officeEstimationNotes"),
  officeDataConfidence: varchar("officeDataConfidence", { length: 32 }),
  officeDataSources: text("officeDataSources"),
  notes: text("notes"),
  isCustom: boolean("isCustom").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;
