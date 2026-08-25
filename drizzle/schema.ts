import { boolean, double, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  /** Oregon Real Estate Agency license number when available for public-record matching. */
  realEstateLicense: varchar("real_estate_license", { length: 64 }),
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

/**
 * One row per "Update Current Top Agents" run. Groups the findings produced by
 * a single sweep so the dashboard can show "last checked" and per-run summaries.
 *
 * `source` distinguishes how the sweep was performed:
 *  - "automated": server-side fetch + compare, triggered from the dashboard button
 *  - "research":  findings pushed in via the token-protected sync endpoint after
 *                 an external (Manus session) research pass
 */
export const verificationRuns = mysqlTable("verification_runs", {
  id: int("id").autoincrement().primaryKey(),
  state: varchar("state", { length: 32 }).default("Oregon").notNull(),
  source: mysqlEnum("source", ["automated", "research"]).default("automated").notNull(),
  status: mysqlEnum("status", ["running", "complete", "failed"]).default("running").notNull(),
  agentsChecked: int("agentsChecked").default(0).notNull(),
  confirmedCount: int("confirmedCount").default(0).notNull(),
  changedCount: int("changedCount").default(0).notNull(),
  unverifiedCount: int("unverifiedCount").default(0).notNull(),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
});

export type VerificationRun = typeof verificationRuns.$inferSelect;
export type InsertVerificationRun = typeof verificationRuns.$inferInsert;

/**
 * A single finding about one agent from one verification run.
 *
 * Findings are never applied automatically — Mike approves or rejects each one.
 * `proposed*` columns hold only the fields that differ from the agent record.
 * Ranks are NEVER researched: realtrends figures stay as supplied, and rank is
 * recomputed from production numbers only when those numbers change on approval.
 */
export const agentVerifications = mysqlTable("agent_verifications", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(),
  agentId: int("agentId").notNull(),
  /** Snapshot of the agent name at check time, so the queue reads well even if the record changes. */
  agentName: varchar("agentName", { length: 255 }).notNull(),
  outcome: mysqlEnum("outcome", ["confirmed", "changed", "unverified"]).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "auto"]).default("pending").notNull(),
  /** What we had on record when the check ran. */
  recordedBrokerage: varchar("recordedBrokerage", { length: 255 }),
  recordedPrincipalBroker: varchar("recordedPrincipalBroker", { length: 255 }),
  recordedCityArea: varchar("recordedCityArea", { length: 255 }),
  /** What the check found. Null means "no change proposed for this field". */
  proposedBrokerage: varchar("proposedBrokerage", { length: 255 }),
  proposedPrincipalBroker: varchar("proposedPrincipalBroker", { length: 255 }),
  proposedPrincipalBrokerPhone: varchar("proposedPrincipalBrokerPhone", { length: 64 }),
  proposedPrincipalBrokerEmail: varchar("proposedPrincipalBrokerEmail", { length: 320 }),
  proposedPrincipalBrokerHeadshotUrl: text("proposedPrincipalBrokerHeadshotUrl"),
  proposedCityArea: varchar("proposedCityArea", { length: 255 }),
  proposedPhone: varchar("proposedPhone", { length: 64 }),
  proposedEmail: varchar("proposedEmail", { length: 320 }),
  proposedWebsiteBioUrl: text("proposedWebsiteBioUrl"),
  proposedZillowUrl: text("proposedZillowUrl"),
  /** Optional updated production figures (research source only). Rank recomputes if these change. */
  proposedTotalSides: double("proposedTotalSides"),
  proposedVolumeNum: double("proposedVolumeNum"),
  proposedVolume: varchar("proposedVolume", { length: 64 }),
  /** Why the checker reached this outcome, shown verbatim in the review queue. */
  evidenceNote: text("evidenceNote"),
  evidenceUrl: text("evidenceUrl"),
  /** "blocked" | "not_found" | "no_source" | "fetch_error" — only set when outcome=unverified. */
  unverifiedReason: varchar("unverifiedReason", { length: 64 }),
  confidence: varchar("confidence", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
});

export type AgentVerification = typeof agentVerifications.$inferSelect;
export type InsertAgentVerification = typeof agentVerifications.$inferInsert;

/**
 * Project-owned recurring verification schedule. The task UID is the authoritative
 * identifier used by the scheduled callback; the callback never trusts request body data.
 */
export const verificationSchedules = mysqlTable(
  "verification_schedules",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull().unique(),
    state: varchar("state", { length: 32 }).default("Oregon").notNull(),
    scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }).unique(),
    cronExpression: varchar("cron_expression", { length: 64 }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    lastRunAt: timestamp("last_run_at"),
    lastRunId: int("last_run_id"),
    lastNotificationSentAt: timestamp("last_notification_sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ taskUidIdx: index("verification_schedules_task_uid_idx").on(table.scheduleCronTaskUid) }),
);

export type VerificationSchedule = typeof verificationSchedules.$inferSelect;
export type InsertVerificationSchedule = typeof verificationSchedules.$inferInsert;

/**
 * Publicly evidenced mortgage-loan-officer / agent closed-transaction pairings.
 * These rows are research leads only until Mike approves them; no relationship is
 * inferred from brokerage, lender brand, rankings, or transaction volume.
 */
export const loanOfficerAgentPairings = mysqlTable(
  "loan_officer_agent_pairings",
  {
    id: int("id").autoincrement().primaryKey(),
    state: varchar("state", { length: 32 }).default("Oregon").notNull(),
    agentId: int("agent_id").notNull(),
    loanOfficerName: varchar("loan_officer_name", { length: 255 }).notNull(),
    loanOfficerCompany: varchar("loan_officer_company", { length: 255 }),
    loanOfficerPhone: varchar("loan_officer_phone", { length: 64 }),
    loanOfficerEmail: varchar("loan_officer_email", { length: 320 }),
    loanOfficerHeadshotUrl: text("loan_officer_headshot_url"),
    loanOfficerNmlsId: varchar("loan_officer_nmls_id", { length: 64 }),
    lenderName: varchar("lender_name", { length: 255 }),
    transactionAddress: varchar("transaction_address", { length: 500 }),
    transactionClosedAt: timestamp("transaction_closed_at"),
    transactionType: varchar("transaction_type", { length: 32 }),
    loanType: varchar("loan_type", { length: 64 }),
    interestRate: double("interest_rate"),
    loanAmount: double("loan_amount"),
    purchasePrice: double("purchase_price"),
    propertyZillowUrl: text("property_zillow_url"),
    sharedTransactionCount: int("shared_transaction_count").default(1).notNull(),
    totalSharedLoanVolume: double("total_shared_loan_volume"),
    firstSharedClose: timestamp("first_shared_close"),
    latestSharedClose: timestamp("latest_shared_close"),
    matchMethod: varchar("match_method", { length: 64 }).default("manual").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceTitle: varchar("source_title", { length: 500 }),
    evidenceNote: text("evidence_note").notNull(),
    confidence: varchar("confidence", { length: 32 }).default("medium").notNull(),
    status: varchar("status", { length: 32 }).default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at"),
  },
  table => ({
    agentIdx: index("loan_officer_agent_pairings_agent_idx").on(table.agentId),
    stateIdx: index("loan_officer_agent_pairings_state_idx").on(table.state),
  }),
);

export type LoanOfficerAgentPairing = typeof loanOfficerAgentPairings.$inferSelect;
export type InsertLoanOfficerAgentPairing = typeof loanOfficerAgentPairings.$inferInsert;

/**
 * Normalized public-record transaction rows. These are raw/research inputs and
 * are never treated as a verified LO–agent relationship until matched and reviewed.
 */
export const propertyTransactions = mysqlTable(
  "property_transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    state: varchar("state", { length: 32 }).default("Oregon").notNull(),
    countyFips: varchar("county_fips", { length: 5 }),
    county: varchar("county", { length: 120 }),
    apn: varchar("apn", { length: 80 }),
    standardizedAddress: varchar("standardized_address", { length: 500 }),
    recordingDate: timestamp("recording_date").notNull(),
    salePrice: double("sale_price"),
    loanAmount: double("loan_amount"),
    purchasePrice: double("purchase_price"),
    interestRate: double("interest_rate"),
    loanType: varchar("loan_type", { length: 64 }),
    propertyZillowUrl: text("property_zillow_url"),
    lenderName: varchar("lender_name", { length: 255 }),
    buyerName: varchar("buyer_name", { length: 255 }),
    sellerName: varchar("seller_name", { length: 255 }),
    buyerAgentLicense: varchar("buyer_agent_license", { length: 64 }),
    buyerAgentName: varchar("buyer_agent_name", { length: 255 }),
    loanOfficerNmls: varchar("loan_officer_nmls", { length: 64 }),
    loanOfficerName: varchar("loan_officer_name", { length: 255 }),
    sourceType: varchar("source_type", { length: 64 }).notNull(),
    sourceUrl: text("source_url"),
    sourceRecordId: varchar("source_record_id", { length: 255 }),
    rawPayload: text("raw_payload"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => ({
    dateIdx: index("property_transactions_recording_date_idx").on(table.recordingDate),
    apnIdx: index("property_transactions_apn_idx").on(table.apn),
    pairIdx: index("property_transactions_pair_idx").on(table.buyerAgentLicense, table.loanOfficerNmls),
  }),
);

export type PropertyTransaction = typeof propertyTransactions.$inferSelect;
export type InsertPropertyTransaction = typeof propertyTransactions.$inferInsert;

/** User-configured public-record pairing discovery schedule. */
export const pairingDiscoverySchedules = mysqlTable(
  "pairing_discovery_schedules",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerOpenId: varchar("owner_open_id", { length: 64 }).notNull().unique(),
    state: varchar("state", { length: 32 }).default("Oregon").notNull(),
    scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }).unique(),
    cronExpression: varchar("cron_expression", { length: 64 }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    lookbackDays: int("lookback_days").default(365).notNull(),
    customStartAt: timestamp("custom_start_at"),
    customEndAt: timestamp("custom_end_at"),
    lastRunAt: timestamp("last_run_at"),
    lastRunStartedAt: timestamp("last_run_started_at"),
    lastRunCompletedAt: timestamp("last_run_completed_at"),
    lastRunStatus: varchar("last_run_status", { length: 32 }),
    lastRunPairingsCreated: int("last_run_pairings_created").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ taskUidIdx: index("pairing_discovery_task_uid_idx").on(table.scheduleCronTaskUid) }),
);

export type PairingDiscoverySchedule = typeof pairingDiscoverySchedules.$inferSelect;
export type InsertPairingDiscoverySchedule = typeof pairingDiscoverySchedules.$inferInsert;
