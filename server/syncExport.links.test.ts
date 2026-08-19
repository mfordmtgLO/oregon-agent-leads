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
  it("returns null when the principal broker is not an agent in the list", () => {
    const rows = [makeAgent({ id: 1, fullName: "Dirk Hmura", principalBrokerName: "Andrew Misk" })];
    const payload = toOregonAgentSyncExport(rows as never, new Date("2026-08-19T00:00:00.000Z"));
    expect(payload.agents[0].sourceProfileUrl).toMatch(/\/\?agent=1$/);
    expect(payload.agents[0].principalBrokerProfileUrl).toBeNull();
  });

  it("links to the broker's own record when the broker is also a listed agent", () => {
    const rows = [
      makeAgent({ id: 7, fullName: "Lea Chitwood", realtrendsRank: 2, principalBrokerName: "Lea Chitwood" }),
      makeAgent({ id: 8, fullName: "Someone Else", realtrendsRank: 3, principalBrokerName: "  lea   " }),
    ];
    const payload = toOregonAgentSyncExport(rows as never, new Date("2026-08-19T00:00:00.000Z"));
    expect(payload.agents[0].principalBrokerProfileUrl).toMatch(/\/\?agent=7$/);
    // A partial / non-matching name must not produce a dangling link
    expect(payload.agents[1].principalBrokerProfileUrl).toBeNull();
  });

  it("never emits a URL ending in a bare agent query param", () => {
    const rows = [
      makeAgent({ id: 1, fullName: "A", principalBrokerName: "Unknown Broker" }),
      makeAgent({ id: 2, fullName: "B", realtrendsRank: 2, principalBrokerName: "   " }),
      makeAgent({ id: 3, fullName: "C", realtrendsRank: 3, principalBrokerName: null }),
    ];
    const payload = toOregonAgentSyncExport(rows as never, new Date("2026-08-19T00:00:00.000Z"));
    for (const agent of payload.agents) {
      expect(agent.principalBrokerProfileUrl).toBeNull();
    }
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
