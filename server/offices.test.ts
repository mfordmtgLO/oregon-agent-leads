import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { APP_SESSION_COOKIE, createSessionToken } from "./appAuth";
import { CSV_HEADERS } from "./csv";
import type { TrpcContext } from "./_core/context";

function createSessionCtx(): TrpcContext {
  const token = createSessionToken();
  return {
    user: null,
    req: {
      protocol: "https",
      headers: { cookie: `${APP_SESSION_COOKIE}=${token}` },
    } as unknown as TrpcContext["req"],
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

describe("agents.officeRankings", () => {
  it("rejects unauthenticated requests", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as unknown as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.agents.officeRankings()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns 60 offices ranked 1-60 with broker data, sorted ascending", async () => {
    const caller = appRouter.createCaller(createSessionCtx());
    const offices = await caller.agents.officeRankings();
    expect(offices.length).toBe(60);
    const ranks = offices.map(o => o.officeBuysideRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(60);
    expect(ranks[0]).toBe(1);
    expect(ranks[59]).toBe(60);
    for (const o of offices) {
      expect(o.officeBuysideTransactions).not.toBeNull();
      expect(o.agents.length).toBeGreaterThan(0);
    }
    // Broker names present for nearly all offices (one office has no identified broker in source data)
    const withBroker = offices.filter(o => o.principalBrokerName).length;
    expect(withBroker).toBeGreaterThanOrEqual(59);
  });

  it("CSV export includes the office/broker columns and values", async () => {
    expect(CSV_HEADERS).toContain("Principal Broker Name");
    expect(CSV_HEADERS).toContain("Office Annual Buyside Transactions (Est.)");
    expect(CSV_HEADERS).toContain("Office Buyside Rank (1-60)");
    const caller = appRouter.createCaller(createSessionCtx());
    const { csv } = await caller.agents.exportCsv();
    const header = csv.split("\r\n")[0];
    expect(header).toContain("Principal Broker Name");
    expect(header).toContain("Office Buyside Rank (1-60)");
    // Spot check a known broker from the seed data appears in the body
    expect(csv).toContain("Andrew Misk");
  });
});
