import { describe, expect, it } from "vitest";
import {
  buildDirectory,
  derivePrincipalBrokerDirectory,
  filterDirectory,
  stableBrokerId,
} from "../shared/brokerDirectory";
import type { Agent } from "../drizzle/schema";

function makeAgent(overrides: Partial<Agent> & { id: number; fullName: string }): Agent {
  return {
    state: "Oregon",
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
    realtrendsRank: null,
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
  } as Agent;
}

const dirk = makeAgent({
  id: 1,
  fullName: "Dirk Hmura",
  brokerage: "The Agency Portland",
  cityArea: "Portland, OR",
  realtrendsRank: 1,
  realtrendsTotalSides: 102,
  realtrendsVolume: "$87.98M",
  realtrendsVolumeNum: 87980000,
  websiteBioUrl: "https://dirkhmura.com/",
  zillowUrl: "https://www.zillow.com/profile/Dirk%20Hmura",
  notes: "Called 7/10 - interested in partnership",
  principalBrokerName: "Andrew Misk",
  principalBrokerTitle: "Managing Principal Broker / Co Founder",
  principalBrokerPhone: "(503) 880-6400",
  principalBrokerEmail: "andrew.misk@theagencyre.com",
  principalBrokerHeadshotUrl: "https://example.com/misk.jpg",
  officeBuysideTransactions: 175,
  officeBuysideRank: 36,
  officeEstimationNotes: "Estimated from office listing volume.",
  officeDataConfidence: "High",
});

const shannon = makeAgent({
  id: 2,
  fullName: "Shannon Mahar-Krug",
  brokerage: "John L. Scott Medford",
  cityArea: "Medford, OR",
  realtrendsRank: 8,
  realtrendsTotalSides: 64.8 as unknown as number,
  websiteBioUrl: "https://shannonmaharkrug.johnlscott.com/about-me",
  zillowUrl: "https://www.zillow.com/profile/Shannon%20Mahar%20Krug",
  principalBrokerName: "Jim Remley",
  principalBrokerPhone: "(541) 734-5249",
  principalBrokerEmail: "jimremley@johnlscott.com",
  officeBuysideTransactions: 854,
  officeBuysideRank: 2,
});

const geoff = makeAgent({
  id: 3,
  fullName: "Geoff O'Neill",
  brokerage: "John L. Scott Medford",
  cityArea: "Medford, OR",
  realtrendsRank: 20,
  websiteBioUrl: "https://alexaaronson.johnlscott.com/",
  zillowUrl: "https://www.zillow.com/profile/Alex%20Aaronson",
  // Same broker as Shannon, different capitalization — must dedupe to one record.
  principalBrokerName: "jim remley",
  officeBuysideRank: 2,
  officeBuysideTransactions: 854,
});

describe("principal broker directory derivation", () => {
  it("derives one deduplicated record per broker, sorted by office rank", () => {
    const brokers = derivePrincipalBrokerDirectory([dirk, shannon, geoff]);
    expect(brokers.map(b => b.fullName)).toEqual(["Jim Remley", "Andrew Misk"]);
    expect(brokers.every(b => b.recordType === "principal_broker")).toBe(true);
    expect(brokers.every(b => b.isDerived)).toBe(true);
  });

  it("uses the broker's own contact details and headshot", () => {
    const [, misk] = derivePrincipalBrokerDirectory([dirk, shannon, geoff]);
    expect(misk.fullName).toBe("Andrew Misk");
    expect(misk.phone).toBe("(503) 880-6400");
    expect(misk.email).toBe("andrew.misk@theagencyre.com");
    expect(misk.headshotUrl).toBe("https://example.com/misk.jpg");
  });

  it("never inherits the co-located agent's website, Zillow, production, or notes", () => {
    const brokers = derivePrincipalBrokerDirectory([dirk, shannon, geoff]);
    for (const broker of brokers) {
      expect(broker.websiteBioUrl).toBeNull();
      expect(broker.zillowUrl).toBeNull();
      expect(broker.realtrendsRank).toBeNull();
      expect(broker.realtrendsTotalSides).toBeNull();
      expect(broker.realtrendsVolume).toBeNull();
      expect(broker.realtrendsVolumeNum).toBeNull();
      expect(broker.salesLast12Months).toBeNull();
      expect(broker.notes).toBeNull();
      // Nested broker block is dropped — the record IS the broker.
      expect(broker.principalBrokerName).toBeNull();
    }
  });

  it("keeps office figures on the office fields", () => {
    const [remley] = derivePrincipalBrokerDirectory([shannon]);
    expect(remley.officeBuysideRank).toBe(2);
    expect(remley.officeBuysideTransactions).toBe(854);
  });

  it("assigns stable, negative, non-colliding ids", () => {
    const directory = buildDirectory([dirk, shannon, geoff]);
    const ids = directory.map(record => record.id);
    expect(new Set(ids).size).toBe(ids.length);
    const brokerIds = directory.filter(r => r.isDerived).map(r => r.id);
    expect(brokerIds.every(id => id < 0)).toBe(true);
    expect(stableBrokerId("Andrew Misk")).toBe(stableBrokerId("andrew misk"));
  });

  it("skips agents without a principal broker name", () => {
    const solo = makeAgent({ id: 9, fullName: "Solo Agent", principalBrokerName: "   " });
    expect(derivePrincipalBrokerDirectory([solo])).toHaveLength(0);
  });
});

describe("directory search includes broker records", () => {
  const directory = buildDirectory([dirk, shannon, geoff]);

  it("matches a broker by name (the previous bug returned nothing)", () => {
    const hits = filterDirectory(directory, "Remley", "all");
    expect(hits.map(h => h.fullName)).toContain("Jim Remley");
    const byNameScope = filterDirectory(directory, "remley", "name");
    expect(byNameScope).toHaveLength(1);
    expect(byNameScope[0].recordType).toBe("principal_broker");
  });

  it("matches brokers by city and brokerage scope too", () => {
    const byCity = filterDirectory(directory, "Medford", "city");
    expect(byCity.some(h => h.recordType === "principal_broker")).toBe(true);
    const byBrokerage = filterDirectory(directory, "John L. Scott", "brokerage");
    expect(byBrokerage.some(h => h.recordType === "principal_broker")).toBe(true);
  });

  it("returns every record when the query is empty", () => {
    expect(filterDirectory(directory, "   ", "all")).toHaveLength(directory.length);
    expect(directory.filter(r => r.recordType === "agent")).toHaveLength(3);
    expect(directory.filter(r => r.recordType === "principal_broker")).toHaveLength(2);
  });

  it("still matches agents by name", () => {
    const hits = filterDirectory(directory, "Dirk", "all");
    expect(hits).toHaveLength(1);
    expect(hits[0].recordType).toBe("agent");
  });
});
