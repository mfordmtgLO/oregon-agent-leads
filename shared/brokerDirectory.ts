import type { Agent } from "../drizzle/schema";

/**
 * A directory row is either a real agent record from the database or a synthetic
 * principal-broker record derived from the office data attached to those agents.
 *
 * Broker rows deliberately carry `recordType: "principal_broker"` so the UI can label
 * their numbers as OFFICE production rather than personal agent production, and can
 * badge their rank as an office rank instead of a RealTrends agent rank.
 */
export type DirectoryRecord = Agent & {
  recordType: "agent" | "office" | "principal_broker";
  /** Synthetic broker rows are not editable/persistable (no DB row of their own). */
  isDerived: boolean;
  /** Representative persisted agent row used to store office-level notes. */
  brokerSourceAgentId?: number;
};

/** Deterministic negative id so broker rows never collide with real agent ids. */
export function stableBrokerId(name: string): number {
  let hash = 5381;
  for (const char of name.toLowerCase()) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0;
  return -Math.max(1, hash % 2_000_000_000);
}

export function toAgentRecord(agent: Agent): DirectoryRecord {
  return { ...agent, recordType: "agent", isDerived: false };
}

/**
 * Derive one deduplicated record per principal / managing principal broker.
 *
 * Fields that belong to the co-located agent rather than the broker (website, Zillow,
 * personal production, volume, buyer-side narrative) are cleared so a broker row never
 * shows another person's links or production numbers. Office figures are kept in the
 * office-specific fields and surfaced with office labels by the UI.
 */
export function derivePrincipalBrokerDirectory(agents: Agent[]): DirectoryRecord[] {
  const records = new Map<string, DirectoryRecord>();
  for (const agent of agents) {
    const name = agent.principalBrokerName?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (records.has(key)) continue;
    records.set(key, {
      ...agent,
      recordType: "principal_broker",
      isDerived: true,
      brokerSourceAgentId: agent.id,
      id: stableBrokerId(name),
      fullName: name,
      phone: agent.principalBrokerPhone,
      email: agent.principalBrokerEmail,
      headshotUrl: agent.principalBrokerHeadshotUrl,
      // Office-level rank/production live in the office fields; personal agent metrics
      // must not be inherited from whichever agent happened to reference this broker.
      realtrendsRank: null,
      realtrendsTotalSides: null,
      realtrendsVolume: null,
      realtrendsVolumeNum: null,
      salesLast12Months: null,
      buyerSideTransactions: null,
      otherProductionStats: null,
      dataSources: agent.officeDataSources,
      // Never inherit the agent's personal web presence.
      websiteBioUrl: null,
      zillowUrl: null,
      // The broker IS the principal broker, so drop the nested broker block.
      principalBrokerName: null,
      principalBrokerTitle: agent.principalBrokerTitle?.trim() || "Principal Broker",
      // Office notes are stored separately from the co-located agent's personal CRM notes.
      notes: agent.principalBrokerNotes ?? null,
      isCustom: false,
    });
  }
  return Array.from(records.values()).sort(
    (a, b) =>
      (a.officeBuysideRank ?? Number.MAX_SAFE_INTEGER) - (b.officeBuysideRank ?? Number.MAX_SAFE_INTEGER) ||
      a.fullName.localeCompare(b.fullName),
  );
}

export function deriveOfficeDirectory(agents: Agent[]): DirectoryRecord[] {
  const records = new Map<string, DirectoryRecord>();
  for (const agent of agents) {
    const office = agent.brokerage?.trim();
    if (!office) continue;
    const key = `${office.toLowerCase()}|${(agent.cityArea ?? "").toLowerCase()}`;
    if (records.has(key)) continue;
    records.set(key, {
      ...agent,
      recordType: "office",
      isDerived: true,
      brokerSourceAgentId: agent.id,
      id: stableBrokerId(`office:${key}`),
      fullName: office,
      phone: null,
      email: null,
      websiteBioUrl: null,
      zillowUrl: null,
      realtrendsRank: null,
      realtrendsTotalSides: null,
      realtrendsVolume: null,
      realtrendsVolumeNum: null,
      salesLast12Months: null,
      buyerSideTransactions: null,
      otherProductionStats: null,
      notes: null,
      isCustom: false,
    });
  }
  return Array.from(records.values()).sort((a, b) => (a.officeBuysideRank ?? Number.MAX_SAFE_INTEGER) - (b.officeBuysideRank ?? Number.MAX_SAFE_INTEGER) || a.fullName.localeCompare(b.fullName));
}

export function buildDirectory(agents: Agent[]): DirectoryRecord[] {
  return [...agents.map(toAgentRecord), ...deriveOfficeDirectory(agents), ...derivePrincipalBrokerDirectory(agents)];
}

export type DirectoryScope = "all" | "name" | "city" | "brokerage";

/** Search across agents AND broker rows. Broker rows match on their own name. */
export function filterDirectory(
  records: DirectoryRecord[],
  query: string,
  scope: DirectoryScope,
): DirectoryRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return records;
  return records.filter(record => {
    const name = record.fullName.toLowerCase();
    const city = (record.cityArea ?? "").toLowerCase();
    const brokerage = (record.brokerage ?? "").toLowerCase();
    if (scope === "name") return name.includes(q);
    if (scope === "city") return city.includes(q);
    if (scope === "brokerage") return brokerage.includes(q);
    return name.includes(q) || city.includes(q) || brokerage.includes(q);
  });
}
