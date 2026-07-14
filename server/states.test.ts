import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { APP_SESSION_COOKIE, createSessionToken } from "./appAuth";
import type { TrpcContext } from "./_core/context";
import { US_STATES, DEFAULT_STATE, isUSState } from "../shared/states";

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

describe("50-state support", () => {
  it("US_STATES contains exactly 50 states including Oregon", () => {
    expect(US_STATES).toHaveLength(50);
    expect(US_STATES).toContain("Oregon");
    expect(DEFAULT_STATE).toBe("Oregon");
    expect(isUSState("Oregon")).toBe(true);
    expect(isUSState("Narnia")).toBe(false);
  });

  it("agents.list filters by state: Oregon has data, other states are empty", async () => {
    const caller = appRouter.createCaller(createSessionCtx());
    const oregon = await caller.agents.list({ state: "Oregon" });
    expect(oregon.length).toBeGreaterThanOrEqual(60);
    expect(oregon.every(a => a.state === "Oregon")).toBe(true);

    const texas = await caller.agents.list({ state: "Texas" });
    expect(texas.filter(a => !a.isCustom)).toHaveLength(0);
  });

  it("officeRankings filters by state", async () => {
    const caller = appRouter.createCaller(createSessionCtx());
    const oregonOffices = await caller.agents.officeRankings({ state: "Oregon" });
    expect(oregonOffices.length).toBeGreaterThanOrEqual(59);

    const idahoOffices = await caller.agents.officeRankings({ state: "Idaho" });
    expect(idahoOffices).toHaveLength(0);
  });

  it("exportCsv includes the State column and respects the state filter", async () => {
    const caller = appRouter.createCaller(createSessionCtx());
    const scoped = await caller.agents.exportCsv({ state: "Oregon" });
    const header = scoped.csv.split("\r\n")[0];
    expect(header).toContain("State");
    expect(scoped.count).toBeGreaterThanOrEqual(60);
    // Every data row should carry Oregon in the State column (2nd column)
    const firstRow = scoped.csv.split("\r\n")[1];
    expect(firstRow).toContain("Oregon");

    const all = await caller.agents.exportCsv({});
    expect(all.count).toBeGreaterThanOrEqual(scoped.count);
  });

  it("rejects an invalid state value", async () => {
    const caller = appRouter.createCaller(createSessionCtx());
    await expect(
      // @ts-expect-error deliberately invalid
      caller.agents.list({ state: "Atlantis" }),
    ).rejects.toThrow();
  });
});
