import { describe, expect, it } from "vitest";
import { toOregonAgentSyncExport } from "./syncExport";

function makeAgent(overrides: Record<string, unknown>) {
  return {
    id: 1,
    state: "Oregon",
    fullName: "Agent One",
    realtrendsRank: 1,
    brokerage: null,
    cityArea: null,
    phone: null,
    email: null,
    websiteBioUrl: null,
    zillowUrl: null,
    headshotUrl: null,
    buyerSideTransactions: null,
    salesLast12Months: null,
    otherProductionStats: null,
    realtrendsTotalSides: null,
    realtrendsVolume: null,
    realtrendsVolumeNum: null,
    dataSources: null,
    principalBrokerName: null,
    principalBrokerTitle: null,
    principalBrokerPhone: null,
    principalBrokerEmail: null,
    principalBrokerHeadshotUrl: null,
    officeBuysideTransactions: null,
    officeBuysideRank: null,
    officeEstimationNotes: null,
    officeDataConfidence: null,
    officeDataSources: null,
    notes: null,
    isCustom: false,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("principal broker profile links", () => {
  it("points broker links at the principalBroker deep link, encoded, regardless of agent-list membership", () => {
    const rows = [makeAgent({ id: 1, fullName: "Dirk Hmura", principalBrokerName: "Andrew Misk" })];
    const payload = toOregonAgentSyncExport(rows as never, new Date("2026-08-19T00:00:00.000Z"));
    const agentRecord = payload.agents.find(record => record.recordType === "agent")!;
    expect(agentRecord.sourceProfileUrl).toMatch(/\/\?agent=1$/);
    expect(agentRecord.principalBrokerProfileUrl).toBe(
      "https://oregonleads-bqkuz5cc.manus.space/?principalBroker=Andrew%20Misk",
    );
  });

  it("returns null for blank or missing broker names, never a dangling query parameter", () => {
    const rows = [
      makeAgent({ id: 2, fullName: "B", realtrendsRank: 2, principalBrokerName: "   " }),
      makeAgent({ id: 3, fullName: "C", realtrendsRank: 3, principalBrokerName: null }),
    ];
    const payload = toOregonAgentSyncExport(rows as never, new Date("2026-08-19T00:00:00.000Z"));
    expect(payload.principalBrokerCount).toBe(0);
    for (const record of payload.agents) {
      expect(record.principalBrokerProfileUrl).toBeNull();
      expect(record.sourceProfileUrl).not.toMatch(/[?&](agent|principalBroker)=$/);
    }
  });

  it("emits one deduplicated principal_broker record per broker, ranked by office rank against the full source pool", () => {
    const rows = [
      makeAgent({ id: 1, fullName: "A", realtrendsRank: 1, principalBrokerName: "Jim Sparkman", officeBuysideRank: 24 }),
      makeAgent({ id: 2, fullName: "B", realtrendsRank: 2, principalBrokerName: "jim sparkman", officeBuysideRank: 25 }),
      makeAgent({ id: 3, fullName: "C", realtrendsRank: 87, principalBrokerName: "Jim Remley", officeBuysideRank: 2 }),
    ];
    const payload = toOregonAgentSyncExport(rows as never, new Date("2026-08-19T00:00:00.000Z"));
    const brokers = payload.agents.filter(record => record.recordType === "principal_broker");

    expect(payload.topAgentCount).toBe(3);
    expect(payload.principalBrokerCount).toBe(2);
    expect(payload.count).toBe(payload.topAgentCount + payload.principalBrokerCount);
    expect(brokers.map(broker => broker.fullName)).toEqual(["Jim Remley", "Jim Sparkman"]);
    expect(brokers.every(broker => broker.rankKind === "office" && broker.rankTotal === 87)).toBe(true);
    const ids = payload.agents.map(record => record.sourceAgentId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(brokers.every(broker => broker.sourceAgentId < 0)).toBe(true);
  });
});

describe("rankTotal denominator", () => {
  it("uses the agent count when no rank exceeds it", () => {
    const rows = [
      makeAgent({ id: 1, fullName: "A", realtrendsRank: 1 }),
      makeAgent({ id: 2, fullName: "B", realtrendsRank: 2 }),
      makeAgent({ id: 3, fullName: "C", realtrendsRank: 3 }),
    ];
    const payload = toOregonAgentSyncExport(rows as never, new Date("2026-08-19T00:00:00.000Z"));
    expect(payload.agents.every((agent) => agent.rankTotal === 3)).toBe(true);
  });

  it("uses the highest rank when ranks exceed the agent count (tied ranks / partial list)", () => {
    const rows = [
      makeAgent({ id: 1, fullName: "A", realtrendsRank: 10 }),
      makeAgent({ id: 2, fullName: "B", realtrendsRank: 10 }),
      makeAgent({ id: 3, fullName: "C", realtrendsRank: 60 }),
    ];
    const payload = toOregonAgentSyncExport(rows as never, new Date("2026-08-19T00:00:00.000Z"));
    expect(payload.agents.every((agent) => agent.rankTotal === 60)).toBe(true);
  });

  it("falls back to the agent count when ranks are missing", () => {
    const rows = [
      makeAgent({ id: 1, fullName: "A", realtrendsRank: null }),
      makeAgent({ id: 2, fullName: "B", realtrendsRank: null }),
    ];
    const payload = toOregonAgentSyncExport(rows as never, new Date("2026-08-19T00:00:00.000Z"));
    expect(payload.agents.every((agent) => agent.rankTotal === 2)).toBe(true);
  });
});
