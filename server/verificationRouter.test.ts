/**
 * Integration tests for the verification queue procedures. These hit the real
 * database, so every test creates its own throwaway agent and cleans up after
 * itself — they must not disturb the 60 seeded Oregon agents.
 */
import { afterEach, describe, expect, it } from "vitest";
import { APP_SESSION_COOKIE, createSessionToken } from "./appAuth";
import * as db from "./db";
import { appRouter } from "./routers";
import { ingestResearchFindings } from "./verificationRouter";
import type { TrpcContext } from "./_core/context";

function authedCaller() {
  const token = createSessionToken();
  const ctx = {
    user: null,
    req: { protocol: "https", headers: { cookie: `${APP_SESSION_COOKIE}=${token}` } },
    res: { cookie: () => {}, clearCookie: () => {} },
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

const createdAgentIds: number[] = [];

async function makeAgent(fields: Record<string, unknown> = {}) {
  const id = await db.createAgent({
    fullName: `ZZ Test Agent ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    state: "Oregon",
    brokerage: "Testing Brokerage Alpha",
    cityArea: "Testville, OR",
    principalBrokerName: "Original Broker",
    realtrendsTotalSides: 5,
    isCustom: true,
    ...fields,
  } as never);
  createdAgentIds.push(Number(id));
  return Number(id);
}

afterEach(async () => {
  while (createdAgentIds.length) {
    const id = createdAgentIds.pop()!;
    try {
      await db.deleteAgent(id);
    } catch {
      // best effort cleanup
    }
  }
});

describe("verification queue procedures", () => {
  it("rejects unauthenticated access to the queue", async () => {
    const ctx = {
      user: null,
      req: { protocol: "https", headers: {} },
      res: { cookie: () => {}, clearCookie: () => {} },
    } as unknown as TrpcContext;
    await expect(appRouter.createCaller(ctx).verification.queue()).rejects.toThrow(/sign in/i);
  });

  it("ingests a researched change and surfaces it as pending", async () => {
    const agentId = await makeAgent();
    const agent = await db.getAgentById(agentId);

    const result = await ingestResearchFindings("Oregon", [
      {
        agentId,
        agentName: agent!.fullName,
        outcome: "changed",
        brokerage: "Windermere Testing Trust",
        principalBrokerName: "New Broker",
        evidenceNote: "Found on their new brokerage bio page.",
        evidenceUrl: "https://example.com/bio",
        confidence: "high",
      },
    ]);

    expect(result.changedCount).toBe(1);

    const queue = await db.listPendingVerifications("Oregon");
    const mine = queue.filter(q => q.agentId === agentId);
    expect(mine).toHaveLength(1);
    expect(mine[0].proposedBrokerage).toBe("Windermere Testing Trust");
    expect(mine[0].recordedBrokerage).toBe("Testing Brokerage Alpha");
  });

  it("treats a researched 'change' with identical fields as a confirmation", async () => {
    const agentId = await makeAgent();
    const agent = await db.getAgentById(agentId);

    await ingestResearchFindings("Oregon", [
      {
        agentId,
        agentName: agent!.fullName,
        outcome: "changed",
        brokerage: "Testing Brokerage Alpha",
        principalBrokerName: "Original Broker",
      },
    ]);

    const pending = (await db.listPendingVerifications("Oregon")).filter(q => q.agentId === agentId);
    expect(pending).toHaveLength(0);
  });

  it("approving a finding writes the proposed fields onto the agent", async () => {
    const agentId = await makeAgent();
    const agent = await db.getAgentById(agentId);
    await ingestResearchFindings("Oregon", [
      {
        agentId,
        agentName: agent!.fullName,
        outcome: "changed",
        brokerage: "Windermere Testing Trust",
        cityArea: "Newtown, OR",
      },
    ]);

    const finding = (await db.listPendingVerifications("Oregon")).find(q => q.agentId === agentId)!;
    const caller = authedCaller();
    const result = await caller.verification.approve({ id: finding.id });

    expect(result.success).toBe(true);
    expect(result.fieldsUpdated).toBe(2);

    const updated = await db.getAgentById(agentId);
    expect(updated!.brokerage).toBe("Windermere Testing Trust");
    expect(updated!.cityArea).toBe("Newtown, OR");

    // Same finding cannot be applied twice.
    await expect(caller.verification.approve({ id: finding.id })).rejects.toThrow(/already reviewed/i);
  });

  it("rejecting a finding leaves the agent untouched", async () => {
    const agentId = await makeAgent();
    const agent = await db.getAgentById(agentId);
    await ingestResearchFindings("Oregon", [
      { agentId, agentName: agent!.fullName, outcome: "changed", brokerage: "Should Not Apply Realty" },
    ]);

    const finding = (await db.listPendingVerifications("Oregon")).find(q => q.agentId === agentId)!;
    await authedCaller().verification.reject({ id: finding.id });

    const after = await db.getAgentById(agentId);
    expect(after!.brokerage).toBe("Testing Brokerage Alpha");
    const stillPending = (await db.listPendingVerifications("Oregon")).filter(q => q.agentId === agentId);
    expect(stillPending).toHaveLength(0);
  });

  it("recomputes ranks only when production figures change", async () => {
    const agentId = await makeAgent({ realtrendsTotalSides: 5 });
    const agent = await db.getAgentById(agentId);

    // Brokerage-only change: no rank recompute.
    await ingestResearchFindings("Oregon", [
      { agentId, agentName: agent!.fullName, outcome: "changed", brokerage: "Rank Neutral Realty" },
    ]);
    let finding = (await db.listPendingVerifications("Oregon")).find(q => q.agentId === agentId)!;
    let result = await authedCaller().verification.approve({ id: finding.id });
    expect(result.ranksRecomputed).toBe(false);

    // Sides change: ranks recompute.
    await ingestResearchFindings("Oregon", [
      { agentId, agentName: agent!.fullName, outcome: "changed", totalSides: 7 },
    ]);
    finding = (await db.listPendingVerifications("Oregon")).find(q => q.agentId === agentId)!;
    result = await authedCaller().verification.approve({ id: finding.id });
    expect(result.ranksRecomputed).toBe(true);

    const updated = await db.getAgentById(agentId);
    expect(updated!.realtrendsTotalSides).toBe(7);
  });

  it("reports research findings whose agent name does not match", async () => {
    const result = await ingestResearchFindings("Oregon", [
      { agentName: "Nobody By That Name At All", outcome: "changed", brokerage: "Ghost Realty" },
    ]);
    expect(result.unmatched).toContain("Nobody By That Name At All");
    expect(result.agentsChecked).toBe(0);
  });

  it("supersedes an older pending finding when a newer one arrives", async () => {
    const agentId = await makeAgent();
    const agent = await db.getAgentById(agentId);

    await ingestResearchFindings("Oregon", [
      { agentId, agentName: agent!.fullName, outcome: "changed", brokerage: "First Guess Realty" },
    ]);
    await ingestResearchFindings("Oregon", [
      { agentId, agentName: agent!.fullName, outcome: "changed", brokerage: "Second Guess Realty" },
    ]);

    const pending = (await db.listPendingVerifications("Oregon")).filter(q => q.agentId === agentId);
    expect(pending).toHaveLength(1);
    expect(pending[0].proposedBrokerage).toBe("Second Guess Realty");
  });
});
