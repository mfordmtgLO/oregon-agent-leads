import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  agents,
  agentVerifications,
  InsertAgent,
  InsertAgentVerification,
  InsertUser,
  InsertVerificationRun,
  users,
  verificationRuns,
  verificationSchedules,
  InsertVerificationSchedule,
  loanOfficerAgentPairings,
  InsertLoanOfficerAgentPairing,
  propertyTransactions,
  pairingDiscoverySchedules,
  InsertPairingDiscoverySchedule,
  providerConnections,
  InsertProviderConnection,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ---------------------------------------------------------------------------
// Agent queries
// ---------------------------------------------------------------------------

export async function listAgents(state?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (state) return db.select().from(agents).where(eq(agents.state, state));
  return db.select().from(agents);
}

export async function getAgentById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createAgent(agent: InsertAgent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(agents).values(agent);
  return result[0].insertId;
}

export async function updateAgentNotes(id: number, notes: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(agents).set({ notes }).where(eq(agents.id, id));
}

export async function updatePrincipalBrokerNotes(agentId: number, notes: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(agents).set({ principalBrokerNotes: notes }).where(eq(agents.id, agentId));
}

export async function updateAgent(id: number, fields: Partial<InsertAgent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(agents).set(fields).where(eq(agents.id, id));
}

export async function deleteAgent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(agents).where(eq(agents.id, id));
}

export async function countAgents() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ id: agents.id }).from(agents);
  return rows.length;
}

// ---------------------------------------------------------------------------
// Verification queries
// ---------------------------------------------------------------------------

export async function createVerificationRun(run: InsertVerificationRun) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(verificationRuns).values(run);
  return result[0].insertId;
}

export async function updateVerificationRun(id: number, fields: Partial<InsertVerificationRun>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(verificationRuns).set(fields).where(eq(verificationRuns.id, id));
}

export async function getVerificationRun(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(verificationRuns).where(eq(verificationRuns.id, id)).limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

/** Most recent runs for a state, newest first. */
export async function listVerificationRuns(state: string, limit = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(verificationRuns)
    .where(eq(verificationRuns.state, state))
    .orderBy(desc(verificationRuns.startedAt))
    .limit(limit);
}

export async function insertVerifications(rows: InsertAgentVerification[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (rows.length === 0) return;
  await db.insert(agentVerifications).values(rows);
}

/** Findings for one run (all outcomes). */
export async function listVerificationsByRun(runId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(agentVerifications)
    .where(eq(agentVerifications.runId, runId))
    .orderBy(desc(agentVerifications.id));
}

/** Everything still awaiting Mike's decision, newest first. */
export async function listPendingVerifications(state?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({ v: agentVerifications, agentState: agents.state })
    .from(agentVerifications)
    .leftJoin(agents, eq(agentVerifications.agentId, agents.id))
    .where(eq(agentVerifications.status, "pending"))
    .orderBy(desc(agentVerifications.id));
  const filtered = state ? rows.filter(r => r.agentState === state) : rows;
  return filtered.map(r => r.v);
}

export async function getVerification(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(agentVerifications).where(eq(agentVerifications.id, id)).limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

export async function setVerificationStatus(
  id: number,
  status: "pending" | "approved" | "rejected" | "auto",
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(agentVerifications)
    .set({ status, reviewedAt: new Date() })
    .where(eq(agentVerifications.id, id));
}

/** Mark every still-pending finding for a set of agents as superseded (rejected). */
export async function supersedePendingForAgents(agentIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (agentIds.length === 0) return;
  await db
    .update(agentVerifications)
    .set({ status: "rejected", reviewedAt: new Date() })
    .where(
      and(eq(agentVerifications.status, "pending"), inArray(agentVerifications.agentId, agentIds)),
    );
}

// ---------------------------------------------------------------------------
// Recurring verification schedule
// ---------------------------------------------------------------------------
export async function getVerificationScheduleByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(verificationSchedules)
    .where(eq(verificationSchedules.scheduleCronTaskUid, taskUid))
    .limit(1);
  return rows[0];
}

export async function getVerificationScheduleByName(name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(verificationSchedules)
    .where(eq(verificationSchedules.name, name))
    .limit(1);
  return rows[0];
}

export async function createVerificationSchedule(schedule: InsertVerificationSchedule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(verificationSchedules).values(schedule);
  return result[0].insertId;
}

export async function updateVerificationSchedule(
  id: number,
  fields: Partial<InsertVerificationSchedule>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(verificationSchedules).set(fields).where(eq(verificationSchedules.id, id));
}

// ---------------------------------------------------------------------------
// Publicly evidenced loan-officer / agent pairings
// ---------------------------------------------------------------------------
function normalizeMatchText(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function listLoanOfficerAgentPairings(state = "Oregon", status?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      pairing: loanOfficerAgentPairings,
      agentName: agents.fullName,
      agentBrokerage: agents.brokerage,
      agentPhone: agents.phone,
      agentEmail: agents.email,
      agentHeadshotUrl: agents.headshotUrl,
      agentCityArea: agents.cityArea,
      agentWebsiteBioUrl: agents.websiteBioUrl,
      agentZillowUrl: agents.zillowUrl,
      agentRealEstateLicense: agents.realEstateLicense,
    })
    .from(loanOfficerAgentPairings)
    .leftJoin(agents, eq(loanOfficerAgentPairings.agentId, agents.id))
    .where(eq(loanOfficerAgentPairings.state, state))
    .orderBy(desc(loanOfficerAgentPairings.createdAt));
  return rows
    .filter(row => !status || row.pairing.status === status)
    .map(row => ({
      ...row.pairing,
      agentName: row.agentName,
      agentBrokerage: row.agentBrokerage,
      agentPhone: row.agentPhone,
      agentEmail: row.agentEmail,
      agentHeadshotUrl: row.agentHeadshotUrl,
      agentCityArea: row.agentCityArea,
      agentWebsiteBioUrl: row.agentWebsiteBioUrl,
      agentZillowUrl: row.agentZillowUrl,
      agentRealEstateLicense: row.agentRealEstateLicense,
    }));
}

export async function listLoanOfficerAgentPairingOptions(state = "Oregon", windowDays = 365, customStartAt?: Date | null, customEndAt?: Date | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [pairingRows, transactions] = await Promise.all([
    db.select({ pairing: loanOfficerAgentPairings, agentName: agents.fullName, agentBrokerage: agents.brokerage, agentRealEstateLicense: agents.realEstateLicense })
      .from(loanOfficerAgentPairings)
      .leftJoin(agents, eq(loanOfficerAgentPairings.agentId, agents.id))
      .where(eq(loanOfficerAgentPairings.state, state))
      .orderBy(desc(loanOfficerAgentPairings.loanOfficerName)),
    db.select().from(propertyTransactions).where(eq(propertyTransactions.state, state)),
  ]);
  const cutoff = customStartAt?.getTime() ?? (Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const endCutoff = customEndAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return pairingRows.map(row => {
    const agentNameKey = normalizeMatchText(row.agentName);
    const licenseKey = normalizeMatchText(row.agentRealEstateLicense);
    const loNmlsKey = normalizeMatchText(row.pairing.loanOfficerNmlsId);
    const seen = new Set<string>();
    for (const transaction of transactions) {
      const recordedAt = new Date(transaction.recordingDate).getTime();
      if (recordedAt < cutoff || recordedAt > endCutoff) continue;
      if (loNmlsKey && normalizeMatchText(transaction.loanOfficerNmls) !== loNmlsKey) continue;
      const agentMatches = licenseKey && normalizeMatchText(transaction.buyerAgentLicense) === licenseKey;
      const nameMatches = agentNameKey && normalizeMatchText(transaction.buyerAgentName) === agentNameKey;
      if (!agentMatches && !nameMatches) continue;
      const key = transaction.sourceRecordId || transaction.apn || `${transaction.standardizedAddress ?? transaction.id}|${new Date(transaction.recordingDate).toISOString().slice(0, 10)}`;
      seen.add(key);
    }
    return { ...row.pairing, agentName: row.agentName, agentBrokerage: row.agentBrokerage, sharedClosingCount: seen.size };
  });
}

export async function insertLoanOfficerAgentPairings(rows: InsertLoanOfficerAgentPairing[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (rows.length === 0) return;
  await db.insert(loanOfficerAgentPairings).values(rows);
}

export async function getLoanOfficerAgentPairing(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(loanOfficerAgentPairings).where(eq(loanOfficerAgentPairings.id, id)).limit(1);
  return rows[0];
}

export async function setLoanOfficerAgentPairingStatus(id: number, status: "pending" | "approved" | "rejected") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(loanOfficerAgentPairings).set({ status, reviewedAt: new Date() }).where(eq(loanOfficerAgentPairings.id, id));
}

export async function deleteLoanOfficerAgentPairing(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(loanOfficerAgentPairings).where(eq(loanOfficerAgentPairings.id, id));
}

export async function updateLoanOfficerAgentPairing(id: number, fields: Partial<InsertLoanOfficerAgentPairing>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(loanOfficerAgentPairings).set(fields).where(eq(loanOfficerAgentPairings.id, id));
}

export async function getPairingDiscoveryScheduleByOwner(ownerOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(pairingDiscoverySchedules).where(eq(pairingDiscoverySchedules.ownerOpenId, ownerOpenId)).limit(1);
  return rows[0] ?? null;
}

export async function getPairingDiscoveryScheduleByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(pairingDiscoverySchedules).where(eq(pairingDiscoverySchedules.scheduleCronTaskUid, taskUid)).limit(1);
  return rows[0] ?? null;
}

export async function insertPairingDiscoverySchedule(row: InsertPairingDiscoverySchedule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(pairingDiscoverySchedules).values(row);
  return getPairingDiscoveryScheduleByOwner(row.ownerOpenId);
}

export async function updatePairingDiscoverySchedule(id: number, fields: Partial<InsertPairingDiscoverySchedule>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(pairingDiscoverySchedules).set(fields).where(eq(pairingDiscoverySchedules.id, id));
  const rows = await db.select().from(pairingDiscoverySchedules).where(eq(pairingDiscoverySchedules.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getProviderConnectionByOwner(ownerOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(providerConnections).where(eq(providerConnections.ownerOpenId, ownerOpenId)).limit(1);
  return rows[0] ?? null;
}

export async function insertProviderConnection(row: InsertProviderConnection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(providerConnections).values(row);
  return getProviderConnectionByOwner(row.ownerOpenId);
}

export async function updateProviderConnection(id: number, fields: Partial<InsertProviderConnection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(providerConnections).set(fields).where(eq(providerConnections.id, id));
  const rows = await db.select().from(providerConnections).where(eq(providerConnections.id, id)).limit(1);
  return rows[0] ?? null;
}
