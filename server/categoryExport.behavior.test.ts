import { describe, expect, it } from "vitest";
import { agentsToCsv } from "./csv";
import { buildDirectory } from "../shared/brokerDirectory";
import type { Agent } from "../drizzle/schema";

function agent(id: number, brokerage: string, broker: string, title: string): Agent {
  return {
    id, fullName: `Agent ${id}`, state: "Oregon", brokerage, cityArea: "Portland, OR",
    phone: null, email: null, websiteBioUrl: null, zillowUrl: null, headshotUrl: null,
    buyerSideTransactions: null, salesLast12Months: null, otherProductionStats: null,
    realtrendsRank: id, realtrendsTotalSides: null, realtrendsVolume: null, realtrendsVolumeNum: null,
    dataSources: null, principalBrokerName: broker, principalBrokerTitle: title,
    principalBrokerPhone: null, principalBrokerEmail: null, principalBrokerHeadshotUrl: null,
    officeBuysideTransactions: 100, officeBuysideRank: id, officeEstimationNotes: null,
    officeDataConfidence: null, officeDataSources: null, notes: null, principalBrokerNotes: null,
    isCustom: false, createdAt: new Date(), updatedAt: new Date(),
  } as Agent;
}

describe("category-aware visible export", () => {
  const records = buildDirectory([
    agent(1, "Office A", "Principal A", "Principal Broker"),
    agent(2, "Office A", "Principal A", "Principal Broker"),
    agent(3, "Office B", "Manager B", "Managing Broker"),
  ]);
  it("exports the exact filtered category count", () => {
    const agents = records.filter(r => r.recordType === "agent").slice(0, 2);
    const offices = records.filter(r => r.recordType === "office");
    const brokers = records.filter(r => r.recordType === "principal_broker");
    expect(agentsToCsv(agents).split("\r\n")).toHaveLength(3);
    expect(offices).toHaveLength(2);
    expect(brokers).toHaveLength(2);
  });
  it("labels office and broker rows without changing their category", () => {
    const csv = agentsToCsv(records.filter(r => r.recordType !== "agent"));
    expect(csv).toContain("Record Category,Broker Role");
    expect(csv).toContain("office,,Office A");
    expect(csv).toContain("principal_broker,Principal Broker,Principal A");
    expect(csv).toContain("principal_broker,Managing Broker,Manager B");
  });
});
