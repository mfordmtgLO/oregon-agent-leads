import { describe, expect, it } from "vitest";
import type { Agent } from "../drizzle/schema";
import { agentsToCsv, CSV_HEADERS } from "./csv";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 1,
    fullName: "Jane Doe",
    brokerage: "Acme Realty",
    cityArea: "Portland, OR",
    phone: "(503) 555-1234",
    email: "jane@acme.com",
    websiteBioUrl: "https://janedoe.com",
    zillowUrl: "https://zillow.com/profile/jane",
    headshotUrl: "https://img.example.com/jane.jpg",
    buyerSideTransactions: "~50",
    salesLast12Months: "40 (Zillow)",
    otherProductionStats: "Total sales 500",
    realtrendsRank: 10,
    realtrendsTotalSides: 55.5,
    realtrendsVolume: "$20.5M",
    realtrendsVolumeNum: 20500000,
    dataSources: "https://zillow.com",
    notes: null,
    isCustom: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("agentsToCsv", () => {
  it("includes the header row and one row per agent", () => {
    const csv = agentsToCsv([makeAgent(), makeAgent({ id: 2, fullName: "Bob Smith" })]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(CSV_HEADERS.join(","));
    expect(lines[2]).toContain("Bob Smith");
  });

  it("escapes commas, quotes, and newlines in notes", () => {
    const csv = agentsToCsv([
      makeAgent({ notes: 'Called 7/10 - "interested", follow up\nnext week' }),
    ]);
    expect(csv).toContain('"Called 7/10 - ""interested"", follow up\nnext week"');
  });

  it("marks manually added agents", () => {
    const csv = agentsToCsv([makeAgent({ isCustom: true })]);
    const dataRow = csv.split("\r\n")[1];
    expect(dataRow).toContain("Yes");
  });

  it("renders null fields as empty strings", () => {
    const csv = agentsToCsv([makeAgent({ email: null, phone: null })]);
    const dataRow = csv.split("\r\n")[1];
    expect(dataRow).toContain(",,");
  });
});
