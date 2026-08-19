import { describe, expect, it } from "vitest";
import { isAuthorizedSyncRequest, toOregonAgentSyncExport } from "./syncExport";

describe("Oregon direct agent sync export", () => {
  it("requires an exact bearer token", () => {
    expect(isAuthorizedSyncRequest("Bearer allowed-token", "allowed-token")).toBe(true);
    expect(isAuthorizedSyncRequest("Bearer wrong-token", "allowed-token")).toBe(false);
    expect(isAuthorizedSyncRequest(undefined, "allowed-token")).toBe(false);
    expect(isAuthorizedSyncRequest("Bearer allowed-token", "")).toBe(false);
  });

  it("emits a versioned Oregon-only profile payload sorted by source rank", () => {
    const rows = [
      {
        id: 2,
        state: "Oregon",
        fullName: "Second Oregon Agent",
        realtrendsRank: 2,
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
        updatedAt: new Date("2026-08-02T00:00:00.000Z"),
      },
      {
        id: 1,
        state: "Oregon",
        fullName: "First Oregon Agent",
        realtrendsRank: 1,
        brokerage: "Example Realty",
        cityArea: "Portland, OR",
        phone: "(503) 555-0100",
        email: "first@example.test",
        websiteBioUrl: "https://example.test",
        zillowUrl: null,
        headshotUrl: "https://example.test/headshot.jpg",
        buyerSideTransactions: null,
        salesLast12Months: null,
        otherProductionStats: null,
        realtrendsTotalSides: 100,
        realtrendsVolume: "$50M",
        realtrendsVolumeNum: 50_000_000,
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
        notes: "Approved source record",
        isCustom: false,
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-03T00:00:00.000Z"),
      },
      {
        id: 3,
        state: "Washington",
        fullName: "Excluded Agent",
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
        updatedAt: new Date("2026-08-03T00:00:00.000Z"),
      },
    ] as never[];

    const payload = toOregonAgentSyncExport(rows as never, new Date("2026-08-18T00:00:00.000Z"));

    expect(payload).toMatchObject({ source: "oregon-agent-leads", state: "Oregon", count: 2, topAgentCount: 2, principalBrokerCount: 0 });
    expect(payload.agents.map((agent) => agent.fullName)).toEqual(["First Oregon Agent", "Second Oregon Agent"]);
    expect(payload.agents[0]).toMatchObject({ sourceAgentId: 1, headshotUrl: "https://example.test/headshot.jpg" });
  });

  it("derives one standalone principal-broker record per named broker", () => {
    const row = {
      id: 12, state: "Oregon", fullName: "Top Agent", realtrendsRank: 1, brokerage: "Example Realty", cityArea: "Salem", phone: null, email: null,
      websiteBioUrl: null, zillowUrl: null, headshotUrl: null, buyerSideTransactions: null, salesLast12Months: null, otherProductionStats: null,
      realtrendsTotalSides: null, realtrendsVolume: null, realtrendsVolumeNum: null, dataSources: null,
      principalBrokerName: "Tiffany Johnson", principalBrokerTitle: "Managing Principal Broker", principalBrokerPhone: "541-555-0100", principalBrokerEmail: "tiffany@example.test", principalBrokerHeadshotUrl: "https://example.test/tiffany.jpg",
      officeBuysideTransactions: 325, officeBuysideRank: 23, officeEstimationNotes: null, officeDataConfidence: null, officeDataSources: null,
      notes: null, isCustom: false, createdAt: new Date(), updatedAt: new Date(),
    } as never;
    const payload = toOregonAgentSyncExport([row] as never);
    expect(payload).toMatchObject({ count: 2, topAgentCount: 1, principalBrokerCount: 1 });
    expect(payload.agents[1]).toMatchObject({ fullName: "Tiffany Johnson", recordType: "principal_broker", rankKind: "office", realtrendsRank: 23, rankTotal: 23 });
    expect(payload.agents[1].sourceProfileUrl).toContain("principalBroker=Tiffany");
  });
});
