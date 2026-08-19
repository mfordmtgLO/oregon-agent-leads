/**
 * Contract tests for the Review Queue UI.
 *
 * The sandbox browser is currently behind a captcha on the preview host, so the
 * page's data contract is asserted here instead: every field the page reads must
 * exist on the procedure payloads, and the approve/dismiss actions the buttons
 * call must behave as the UI assumes.
 */
import { afterEach, describe, expect, it } from "vitest";
import { APP_SESSION_COOKIE, createSessionToken } from "./appAuth";
import * as db from "./db";
import { appRouter } from "./routers";
import { ingestResearchFindings, runVerificationSweep } from "./verificationRouter";
import type { TrpcContext } from "./_core/context";

function caller() {
  const ctx = {
    user: null,
    req: {
      protocol: "https",
      headers: { cookie: `${APP_SESSION_COOKIE}=${createSessionToken()}` },
    },
    res: { cookie: () => {}, clearCookie: () => {} },
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

const created: number[] = [];

async function tempAgent(fields: Record<string, unknown> = {}) {
  const id = Number(
    await db.createAgent({
      fullName: `ZZ UI Probe ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      state: "Oregon",
      brokerage: "Probe Brokerage",
      cityArea: "Probeville, OR",
      principalBrokerName: "Probe Broker",
      realtrendsTotalSides: 3,
      isCustom: true,
      ...fields,
    } as never),
  );
  created.push(id);
  return id;
}

afterEach(async () => {
  while (created.length) {
    try {
      await db.deleteAgent(created.pop()!);
    } catch {
      /* best effort */
    }
  }
});

/** Every property ReviewQueue.tsx reads off a queue row. */
const REQUIRED_FIELDS = [
  "id",
  "agentId",
  "agentName",
  "outcome",
  "recordedBrokerage",
  "recordedPrincipalBroker",
  "recordedCityArea",
  "proposedBrokerage",
  "proposedPrincipalBroker",
  "proposedPrincipalBrokerPhone",
  "proposedPrincipalBrokerEmail",
  "proposedCityArea",
  "proposedPhone",
  "proposedEmail",
  "proposedWebsiteBioUrl",
  "proposedZillowUrl",
  "proposedTotalSides",
  "proposedVolume",
  "evidenceNote",
  "evidenceUrl",
  "unverifiedReason",
  "confidence",
] as const;

describe("Review Queue data contract", () => {
  it("queue rows expose every field the page renders", async () => {
    const agentId = await tempAgent();
    const agent = await db.getAgentById(agentId);
    await ingestResearchFindings("Oregon", [
      {
        agentId,
        agentName: agent!.fullName,
        outcome: "changed",
        brokerage: "Probe Destination Realty",
        evidenceNote: "Probe note",
        evidenceUrl: "https://example.com/probe",
        confidence: "high",
      },
    ]);

    const rows = await caller().verification.queue({ state: "Oregon" });
    const row = rows.find(r => r.agentId === agentId)!;
    expect(row).toBeDefined();
    for (const field of REQUIRED_FIELDS) {
      expect(row, `missing field: ${field}`).toHaveProperty(field);
    }
  });

  it("runs history exposes the startedAt the page formats", async () => {
    const runs = await caller().verification.runs({ state: "Oregon" });
    expect(Array.isArray(runs)).toBe(true);
    for (const run of runs) {
      expect(run).toHaveProperty("startedAt");
      expect(new Date(run.startedAt as unknown as string).toString()).not.toBe("Invalid Date");
    }
  });

  it("only pending findings appear, so approving removes the row from the page", async () => {
    const agentId = await tempAgent();
    const agent = await db.getAgentById(agentId);
    await ingestResearchFindings("Oregon", [
      { agentId, agentName: agent!.fullName, outcome: "changed", brokerage: "Probe Destination Realty" },
    ]);

    const c = caller();
    const before = await c.verification.queue({ state: "Oregon" });
    const row = before.find(r => r.agentId === agentId)!;

    const result = await c.verification.approve({ id: row.id });
    expect(result.fieldsUpdated).toBeGreaterThan(0);

    const after = await c.verification.queue({ state: "Oregon" });
    expect(after.find(r => r.agentId === agentId)).toBeUndefined();
  });

  it("dismissing removes the row without changing the agent", async () => {
    const agentId = await tempAgent();
    const agent = await db.getAgentById(agentId);
    await ingestResearchFindings("Oregon", [
      { agentId, agentName: agent!.fullName, outcome: "changed", brokerage: "Never Applied Realty" },
    ]);

    const c = caller();
    const row = (await c.verification.queue({ state: "Oregon" })).find(r => r.agentId === agentId)!;
    await c.verification.reject({ id: row.id });

    const after = await c.verification.queue({ state: "Oregon" });
    expect(after.find(r => r.agentId === agentId)).toBeUndefined();
    expect((await db.getAgentById(agentId))!.brokerage).toBe("Probe Brokerage");
  });

  it("an unverified finding yields no proposal rows but is still actionable", async () => {
    const agentId = await tempAgent();
    const agent = await db.getAgentById(agentId);
    await ingestResearchFindings("Oregon", [
      {
        agentId,
        agentName: agent!.fullName,
        outcome: "unverified",
        unverifiedReason: "blocked",
        evidenceNote: "Site blocked the check.",
      },
    ]);

    const c = caller();
    const row = (await c.verification.queue({ state: "Oregon" })).find(r => r.agentId === agentId)!;
    expect(row.outcome).toBe("unverified");
    expect(row.unverifiedReason).toBe("blocked");
    expect(row.proposedBrokerage).toBeNull();

    // "Acknowledge" path: approving a no-change finding must not error.
    const result = await c.verification.approve({ id: row.id });
    expect(result.success).toBe(true);
    expect(result.fieldsUpdated).toBe(0);
  });

  it("queue is scoped to the selected territory", async () => {
    const rows = await caller().verification.queue({ state: "Texas" });
    expect(rows).toEqual([]);
  });
});

describe("Update Current Top Agents sweep", () => {
  it("records a run and only queues the non-confirmed findings", async () => {
    // Two throwaway agents: one whose page still shows the recorded brokerage,
    // one whose page is blocked. Fetching is stubbed so the test is deterministic
    // and makes no network calls.
    const okId = await tempAgent({ websiteBioUrl: "https://example.com/ok" });
    const blockedId = await tempAgent({ websiteBioUrl: "https://example.com/blocked" });

    const summary = await runVerificationSweep("Oregon", {
      agentIds: [okId, blockedId],
      fetchImpl: async (url: string) =>
        url.includes("blocked")
          ? { ok: false, status: 403, text: "Access Denied", blocked: true }
          : { ok: true, status: 200, text: "<p>Probe Brokerage — still here</p>", blocked: false },
    });

    expect(summary.agentsChecked).toBe(2);
    expect(summary.confirmedCount).toBe(1);
    expect(summary.unverifiedCount).toBe(1);
    expect(summary.runId).toBeGreaterThan(0);

    const c = caller();

    // The run shows up in history, which is what the "Last checked" stat reads.
    const runs = await c.verification.runs({ state: "Oregon" });
    expect(runs.some(r => r.id === summary.runId)).toBe(true);

    // Confirmations stay out of the review queue; the blocked one needs a decision.
    const queue = await c.verification.queue({ state: "Oregon" });
    expect(queue.find(r => r.agentId === okId)).toBeUndefined();
    const blockedRow = queue.find(r => r.agentId === blockedId);
    expect(blockedRow?.outcome).toBe("unverified");
    expect(blockedRow?.unverifiedReason).toBe("blocked");

    // But the full run detail includes the confirmation, for the audit trail.
    const detail = await c.verification.runDetail({ runId: summary.runId });
    expect(detail.find(r => r.agentId === okId)?.outcome).toBe("confirmed");
  });
});
