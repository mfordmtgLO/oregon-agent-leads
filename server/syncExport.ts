import { timingSafeEqual } from "node:crypto";
import type { Agent } from "../drizzle/schema";

export const AGENT_SYNC_EXPORT_VERSION = 1 as const;

export type OregonAgentSyncProfile = {
  sourceAgentId: number;
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

export function toOregonAgentSyncExport(rows: Agent[], exportedAt = new Date()): OregonAgentSyncExport {
  const oregonAgents = rows.filter((agent) => agent.state === "Oregon");
  const publicBaseUrl = "https://oregonleads-bqkuz5cc.manus.space";
  const sourceProfileUrl = (agentId: number) => `${publicBaseUrl}/?agent=${agentId}`;
  const principalBrokerProfileUrl = (principalBrokerName: unknown) => {
    if (typeof principalBrokerName !== "string" || !principalBrokerName.trim()) return null;
    const normalizedName = principalBrokerName.trim().toLowerCase();
    const match = oregonAgents.find((candidate) => candidate.fullName.trim().toLowerCase() === normalizedName);
    return match ? sourceProfileUrl(match.id) : null;
  };
  const agents = oregonAgents
    .sort((a, b) => (a.realtrendsRank ?? Number.MAX_SAFE_INTEGER) - (b.realtrendsRank ?? Number.MAX_SAFE_INTEGER))
    .map((agent) => ({
      sourceAgentId: agent.id,
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
      rankTotal: oregonAgents.length,
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

  return {
    version: AGENT_SYNC_EXPORT_VERSION,
    source: "oregon-agent-leads",
    state: "Oregon",
    exportedAt: exportedAt.toISOString(),
    count: agents.length,
    agents,
  };
}
