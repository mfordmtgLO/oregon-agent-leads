import { timingSafeEqual } from "node:crypto";
import type { Agent } from "../drizzle/schema";

export const AGENT_SYNC_EXPORT_VERSION = 1 as const;

export type OregonAgentSyncProfile = {
  sourceAgentId: number;
  recordType: "agent" | "principal_broker";
  rankKind: "agent" | "office";
  fullName: string;
  state: string;
  brokerage: string | null;
  cityArea: string | null;
  phone: string | null;
  email: string | null;
  websiteBioUrl: string | null;
  zillowUrl: string | null;
  headshotUrl: string | null;
  buyerSideTransactions: string | null;
  salesLast12Months: string | null;
  otherProductionStats: string | null;
  realtrendsRank: number | null;
  rankTotal: number;
  realtrendsTotalSides: number | null;
  realtrendsVolume: string | null;
  realtrendsVolumeNum: number | null;
  dataSources: string | null;
  principalBrokerName: string | null;
  principalBrokerTitle: string | null;
  principalBrokerPhone: string | null;
  principalBrokerEmail: string | null;
  principalBrokerHeadshotUrl: string | null;
  sourceProfileUrl: string;
  principalBrokerProfileUrl: string | null;
  officeBuysideTransactions: number | null;
  officeBuysideRank: number | null;
  officeEstimationNotes: string | null;
  officeDataConfidence: string | null;
  officeDataSources: string | null;
  notes: string | null;
  sourceUpdatedAt: string;
};

export type OregonAgentSyncExport = {
  version: typeof AGENT_SYNC_EXPORT_VERSION;
  source: "oregon-agent-leads";
  state: "Oregon";
  exportedAt: string;
  count: number;
  topAgentCount: number;
  principalBrokerCount: number;
  agents: OregonAgentSyncProfile[];
};

export function readBearerToken(authorization: string | undefined): string | null {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function isAuthorizedSyncRequest(authorization: string | undefined, expectedToken: string): boolean {
  const provided = readBearerToken(authorization);
  if (!provided || !expectedToken) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expectedToken);
  return left.length === right.length && timingSafeEqual(left, right);
}

function stablePrincipalBrokerId(name: string): number {
  let hash = 5381;
  for (const char of name.toLowerCase()) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0;
  return -Math.max(1, hash % 2_000_000_000);
}

export function toOregonAgentSyncExport(rows: Agent[], exportedAt = new Date()): OregonAgentSyncExport {
  const oregonAgents = rows.filter((agent) => agent.state === "Oregon");
  const agentRankTotal = Math.max(
    oregonAgents.length,
    ...oregonAgents.map((agent) => agent.realtrendsRank ?? 0)
  );
  const officeRankTotal = Math.max(
    0,
    ...oregonAgents.map((agent) => agent.officeBuysideRank ?? 0)
  );
  const publicBaseUrl = "https://oregonleads-bqkuz5cc.manus.space";
  const sourceProfileUrl = (agentId: number) => `${publicBaseUrl}/?agent=${agentId}`;
  const principalBrokerProfileUrl = (principalBrokerName: unknown) => {
    if (typeof principalBrokerName !== "string" || !principalBrokerName.trim()) return null;
    return `${publicBaseUrl}/?principalBroker=${encodeURIComponent(principalBrokerName.trim())}`;
  };
  const topAgents = oregonAgents
    .sort((a, b) => (a.realtrendsRank ?? Number.MAX_SAFE_INTEGER) - (b.realtrendsRank ?? Number.MAX_SAFE_INTEGER))
    .map((agent) => ({
      sourceAgentId: agent.id,
      recordType: "agent" as const,
      rankKind: "agent" as const,
      fullName: agent.fullName,
      state: agent.state,
      brokerage: agent.brokerage,
      cityArea: agent.cityArea,
      phone: agent.phone,
      email: agent.email,
      websiteBioUrl: agent.websiteBioUrl,
      zillowUrl: agent.zillowUrl,
      headshotUrl: agent.headshotUrl,
      buyerSideTransactions: agent.buyerSideTransactions,
      salesLast12Months: agent.salesLast12Months,
      otherProductionStats: agent.otherProductionStats,
      realtrendsRank: agent.realtrendsRank,
      rankTotal: agentRankTotal,
      realtrendsTotalSides: agent.realtrendsTotalSides,
      realtrendsVolume: agent.realtrendsVolume,
      realtrendsVolumeNum: agent.realtrendsVolumeNum,
      dataSources: agent.dataSources,
      principalBrokerName: agent.principalBrokerName,
      principalBrokerTitle: agent.principalBrokerTitle,
      principalBrokerPhone: agent.principalBrokerPhone,
      principalBrokerEmail: agent.principalBrokerEmail,
      principalBrokerHeadshotUrl: agent.principalBrokerHeadshotUrl,
      sourceProfileUrl: sourceProfileUrl(agent.id),
      principalBrokerProfileUrl: principalBrokerProfileUrl(agent.principalBrokerName),
      officeBuysideTransactions: agent.officeBuysideTransactions,
      officeBuysideRank: agent.officeBuysideRank,
      officeEstimationNotes: agent.officeEstimationNotes,
      officeDataConfidence: agent.officeDataConfidence,
      officeDataSources: agent.officeDataSources,
      notes: agent.notes,
      sourceUpdatedAt: agent.updatedAt.toISOString(),
    }));

  const brokerRecords = new Map<string, OregonAgentSyncProfile>();
  for (const agent of oregonAgents) {
    const name = agent.principalBrokerName?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (brokerRecords.has(key)) continue;
    brokerRecords.set(key, {
      sourceAgentId: stablePrincipalBrokerId(name),
      recordType: "principal_broker",
      rankKind: "office",
      fullName: name,
      state: "Oregon",
      brokerage: agent.brokerage,
      cityArea: agent.cityArea,
      phone: agent.principalBrokerPhone,
      email: agent.principalBrokerEmail,
      websiteBioUrl: null,
      zillowUrl: null,
      headshotUrl: agent.principalBrokerHeadshotUrl,
      buyerSideTransactions: null,
      salesLast12Months: null,
      otherProductionStats: null,
      realtrendsRank: agent.officeBuysideRank,
      rankTotal: officeRankTotal,
      realtrendsTotalSides: agent.officeBuysideTransactions,
      realtrendsVolume: null,
      realtrendsVolumeNum: null,
      dataSources: agent.officeDataSources,
      principalBrokerName: name,
      principalBrokerTitle: agent.principalBrokerTitle ?? "Principal Broker",
      principalBrokerPhone: agent.principalBrokerPhone,
      principalBrokerEmail: agent.principalBrokerEmail,
      principalBrokerHeadshotUrl: agent.principalBrokerHeadshotUrl,
      sourceProfileUrl: principalBrokerProfileUrl(name)!,
      principalBrokerProfileUrl: principalBrokerProfileUrl(name),
      officeBuysideTransactions: agent.officeBuysideTransactions,
      officeBuysideRank: agent.officeBuysideRank,
      officeEstimationNotes: agent.officeEstimationNotes,
      officeDataConfidence: agent.officeDataConfidence,
      officeDataSources: agent.officeDataSources,
      notes: agent.officeEstimationNotes,
      sourceUpdatedAt: agent.updatedAt.toISOString(),
    });
  }
  const principalBrokers = Array.from(brokerRecords.values()).sort(
    (a, b) => (a.realtrendsRank ?? Number.MAX_SAFE_INTEGER) - (b.realtrendsRank ?? Number.MAX_SAFE_INTEGER) || a.fullName.localeCompare(b.fullName),
  );
  const agents = [...topAgents, ...principalBrokers];

  return {
    version: AGENT_SYNC_EXPORT_VERSION,
    source: "oregon-agent-leads",
    state: "Oregon",
    exportedAt: exportedAt.toISOString(),
    count: agents.length,
    topAgentCount: topAgents.length,
    principalBrokerCount: principalBrokers.length,
    agents,
  };
}
