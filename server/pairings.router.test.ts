import { afterEach, describe, expect, it } from "vitest";
import { APP_SESSION_COOKIE, createSessionToken } from "./appAuth";
import * as db from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const created: number[] = [];
function caller() {
  const ctx = {
    user: null,
    req: { protocol: "https", headers: { cookie: `${APP_SESSION_COOKIE}=${createSessionToken()}` } },
    res: { cookie: () => {}, clearCookie: () => {} },
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

afterEach(async () => {
  while (created.length) {
    const id = created.pop()!;
    await db.deleteLoanOfficerAgentPairing(id);
  }
});

describe("loan officer / agent pairings", () => {
  it("ingests an evidenced closed-transaction pairing and supports approval", async () => {
    const result = await caller().pairings.ingest({
      pairings: [{
        state: "Oregon",
        agentId: 1,
        loanOfficerName: "Test Loan Officer",
        loanOfficerCompany: "Test Mortgage Co.",
        transactionAddress: "123 Test Street, Portland, OR",
        transactionClosedAt: "2026-01-15",
        transactionType: "buyer",
        sourceUrl: "https://example.com/closed-transaction",
        sourceTitle: "Closed transaction announcement",
        evidenceNote: "Public loan-officer-side announcement names both the officer and buyer agent.",
        confidence: "high",
      }],
    });
    expect(result.inserted).toBe(1);
    const rows = await caller().pairings.list({ state: "Oregon", status: "pending" });
    const row = rows.find(item => item.loanOfficerName === "Test Loan Officer");
    expect(row).toBeDefined();
    created.push(row!.id);
    expect(row!.agentName).toBe("Dirk Hmura");
    expect(row!.sourceUrl).toBe("https://example.com/closed-transaction");
    await caller().pairings.approve({ id: row!.id });
    expect((await caller().pairings.list({ state: "Oregon", status: "approved" })).some(item => item.id === row!.id)).toBe(true);
  });

  it("keeps pairings scoped to the selected state", async () => {
    expect(await caller().pairings.list({ state: "Texas" })).toEqual([]);
  });

  it("returns an empty Oregon queue when no sourced pairing has been ingested", async () => {
    const rows = await caller().pairings.list({ state: "Oregon", status: "pending" });
    expect(Array.isArray(rows)).toBe(true);
    for (const row of rows) {
      expect(row.sourceUrl).toMatch(/^https?:\/\//);
      expect(row.evidenceNote.length).toBeGreaterThanOrEqual(10);
    }
  });
});
