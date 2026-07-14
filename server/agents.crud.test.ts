import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { APP_SESSION_COOKIE, createSessionToken } from "./appAuth";
import type { TrpcContext } from "./_core/context";

function createAuthedCtx(): TrpcContext {
  const token = createSessionToken();
  return {
    user: null,
    req: {
      protocol: "https",
      headers: { cookie: `${APP_SESSION_COOKIE}=${token}` },
    } as unknown as TrpcContext["req"],
    res: {
      cookie: () => undefined,
      clearCookie: () => undefined,
    } as unknown as TrpcContext["res"],
  };
}

describe("agents CRUD flow (integration, real DB)", () => {
  it("creates an agent, updates notes, lists it, includes it in CSV export, then deletes it", async () => {
    const caller = appRouter.createCaller(createAuthedCtx());
    const marker = `Vitest CRUD Test ${Date.now()}`;

    // Create
    const created = await caller.agents.create({
      fullName: marker,
      brokerage: "Vitest Brokerage",
      cityArea: "Testville, OR",
      phone: "(555) 000-1234",
      email: "vitest@example.com",
      websiteBioUrl: "https://example.com",
      zillowUrl: "https://www.zillow.com/profile/vitest",
      headshotUrl: "",
      notes: "initial note",
    });
    expect(created.id).toBeGreaterThan(0);

    try {
      // List includes it, marked custom
      const list = await caller.agents.list();
      const found = list.find(a => a.id === created.id);
      expect(found).toBeDefined();
      expect(found?.fullName).toBe(marker);
      expect(Boolean(found?.isCustom)).toBe(true);
      expect(found?.notes).toBe("initial note");

      // Update notes
      await caller.agents.updateNotes({ id: created.id, notes: "Called 7/10 - vitest updated" });
      const listAfter = await caller.agents.list();
      expect(listAfter.find(a => a.id === created.id)?.notes).toBe("Called 7/10 - vitest updated");

      // CSV export includes the agent and its updated notes
      const { csv } = await caller.agents.exportCsv();
      expect(csv).toContain(marker);
      expect(csv).toContain("Called 7/10 - vitest updated");
    } finally {
      // Cleanup
      await caller.agents.delete({ id: created.id });
    }

    const finalList = await caller.agents.list();
    expect(finalList.find(a => a.id === created.id)).toBeUndefined();
  }, 30000);
});
