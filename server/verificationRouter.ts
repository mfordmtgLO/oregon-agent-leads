/**
 * tRPC procedures backing the "Update Current Top Agents" feature.
 *
 * Flow:
 *  1. `run` sweeps the agents for a state, fetching each profile page and comparing
 *     the brokerage on record. Findings land in the review queue as `pending`.
 *  2. `queue` lists pending findings for Mike to review.
 *  3. `approve` writes the proposed fields onto the agent record (and recomputes
 *     ranks if production figures changed); `reject` discards the finding.
 *  4. `ingest` accepts findings produced by an external research pass so accurate,
 *     human/agent-researched results can populate the same queue.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { InsertAgentVerification } from "../drizzle/schema";
import * as db from "./db";
import {
  buildAgentUpdate,
  checkAgent,
  recomputeRanks,
  type AgentCheckResult,
  type FetchedPage,
} from "./verification";

/** Sweep concurrency: modest so a run stays well inside the request budget. */
const CONCURRENCY = 6;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function toRow(runId: number, result: AgentCheckResult): InsertAgentVerification {
  return {
    runId,
    agentId: result.agentId,
    agentName: result.agentName,
    outcome: result.outcome,
    // Confirmations need no decision from Mike, so they are filed as "auto".
    status: result.outcome === "confirmed" ? "auto" : "pending",
    recordedBrokerage: result.recordedBrokerage,
    recordedPrincipalBroker: result.recordedPrincipalBroker,
    recordedCityArea: result.recordedCityArea,
    proposedBrokerage: result.proposedBrokerage ?? null,
    proposedPrincipalBroker: result.proposedPrincipalBroker ?? null,
    proposedPrincipalBrokerPhone: result.proposedPrincipalBrokerPhone ?? null,
    proposedPrincipalBrokerEmail: result.proposedPrincipalBrokerEmail ?? null,
    proposedPrincipalBrokerHeadshotUrl: result.proposedPrincipalBrokerHeadshotUrl ?? null,
    proposedCityArea: result.proposedCityArea ?? null,
    proposedPhone: result.proposedPhone ?? null,
    proposedEmail: result.proposedEmail ?? null,
    proposedWebsiteBioUrl: result.proposedWebsiteBioUrl ?? null,
    proposedZillowUrl: result.proposedZillowUrl ?? null,
    proposedTotalSides: result.proposedTotalSides ?? null,
    proposedVolumeNum: result.proposedVolumeNum ?? null,
    proposedVolume: result.proposedVolume ?? null,
    evidenceNote: result.evidenceNote,
    evidenceUrl: result.evidenceUrl,
    unverifiedReason: result.unverifiedReason,
    confidence: result.confidence,
  };
}

/**
 * Run an automated sweep for one state and return the run summary.
 *
 * `agentIds` and `fetchImpl` exist so tests can drive a deterministic sweep over
 * throwaway agents without making network calls; production callers pass neither.
 */
export async function runVerificationSweep(
  state: string,
  options: {
    limit?: number;
    agentIds?: number[];
    fetchImpl?: (url: string) => Promise<FetchedPage>;
    /** Monthly low-credit mode: process one agent at a time instead of parallel fetches. */
    sequential?: boolean;
  } = {},
) {
  const { limit, agentIds, fetchImpl, sequential = false } = options;
  const all = await db.listAgents(state);
  // Only real agents are checked; office/broker rows are derived, not stored.
  let targets = agentIds ? all.filter(a => agentIds.includes(a.id)) : all;
  if (limit) targets = targets.slice(0, limit);
  const knownBrokerages = Array.from(
    new Set(all.map(a => a.brokerage).filter((b): b is string => !!b && b.trim().length > 3)),
  );

  const runId = await db.createVerificationRun({ state, source: "automated", status: "running" });

  try {
    const results = sequential
      ? await mapLimit(targets, 1, agent =>
          checkAgent(agent, { knownBrokerages, ...(fetchImpl ? { fetchImpl } : {}) }),
        )
      : await mapLimit(targets, CONCURRENCY, agent =>
          checkAgent(agent, { knownBrokerages, ...(fetchImpl ? { fetchImpl } : {}) }),
        );

    // A fresh sweep supersedes older undecided findings for the same agents,
    // so the queue never shows two competing proposals for one agent.
    await db.supersedePendingForAgents(results.map(r => r.agentId));
    await db.insertVerifications(results.map(r => toRow(runId, r)));

    const summary = {
      agentsChecked: results.length,
      confirmedCount: results.filter(r => r.outcome === "confirmed").length,
      changedCount: results.filter(r => r.outcome === "changed").length,
      unverifiedCount: results.filter(r => r.outcome === "unverified").length,
    };
    await db.updateVerificationRun(runId, {
      ...summary,
      status: "complete",
      finishedAt: new Date(),
    });
    return { runId, ...summary } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.updateVerificationRun(runId, {
      status: "failed",
      errorMessage: message,
      finishedAt: new Date(),
    });
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Verification failed: ${message}` });
  }
}

export const verificationProcedures = {
  run: (state: string, limit?: number) => runVerificationSweep(state, { limit }),

  /** Apply an approved finding to the agent record. */
  approve: async (verificationId: number) => {
    const finding = await db.getVerification(verificationId);
    if (!finding) throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found" });
    if (finding.status !== "pending") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This finding was already reviewed" });
    }
    const agent = await db.getAgentById(finding.agentId);
    if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent no longer exists" });

    const update = buildAgentUpdate(finding);
    if (Object.keys(update).length === 0) {
      // Nothing concrete to write (e.g. an "unverified" item Mike acknowledged).
      await db.setVerificationStatus(verificationId, "approved");
      return { success: true, fieldsUpdated: 0, ranksRecomputed: false } as const;
    }

    await db.updateAgent(finding.agentId, update);

    // Rank policy (confirmed with Mike): ranks are never researched. They stay as the
    // supplied RealTrends 2026 figures, and are recomputed only when a production
    // figure changes. Ordering is driven by total sides, so a sides change always
    // triggers a recompute; a volume-only change is recorded but cannot reorder ranks.
    let ranksRecomputed = false;
    if (update.realtrendsTotalSides !== undefined) {
      const stateAgents = await db.listAgents(agent.state);
      const ranks = recomputeRanks(
        stateAgents.map(a => ({
          id: a.id,
          realtrendsTotalSides:
            a.id === finding.agentId
              ? (update.realtrendsTotalSides as number)
              : a.realtrendsTotalSides,
        })),
      );
      for (const [id, rank] of Array.from(ranks.entries())) {
        const current = stateAgents.find(a => a.id === id);
        if (current && current.realtrendsRank !== rank) {
          await db.updateAgent(id, { realtrendsRank: rank });
        }
      }
      ranksRecomputed = true;
    }

    await db.setVerificationStatus(verificationId, "approved");
    return { success: true, fieldsUpdated: Object.keys(update).length, ranksRecomputed } as const;
  },

  reject: async (verificationId: number) => {
    const finding = await db.getVerification(verificationId);
    if (!finding) throw new TRPCError({ code: "NOT_FOUND", message: "Finding not found" });
    await db.setVerificationStatus(verificationId, "rejected");
    return { success: true } as const;
  },
};

/** Shape accepted from an external research pass (Manus session -> sync endpoint). */
export const researchFindingSchema = z.object({
  agentId: z.number().int().optional(),
  agentName: z.string().min(1),
  outcome: z.enum(["confirmed", "changed", "unverified"]),
  brokerage: z.string().max(255).nullish(),
  principalBrokerName: z.string().max(255).nullish(),
  principalBrokerPhone: z.string().max(64).nullish(),
  principalBrokerEmail: z.string().max(320).nullish(),
  principalBrokerHeadshotUrl: z.string().nullish(),
  cityArea: z.string().max(255).nullish(),
  phone: z.string().max(64).nullish(),
  email: z.string().max(320).nullish(),
  websiteBioUrl: z.string().nullish(),
  zillowUrl: z.string().nullish(),
  totalSides: z.number().nullish(),
  volume: z.string().max(64).nullish(),
  evidenceNote: z.string().nullish(),
  evidenceUrl: z.string().nullish(),
  confidence: z.enum(["high", "medium", "low"]).nullish(),
  unverifiedReason: z.enum(["blocked", "not_found", "no_source", "fetch_error"]).nullish(),
});

export type ResearchFinding = z.infer<typeof researchFindingSchema>;

function parseVolumeNum(volume: string | null | undefined): number | null {
  if (!volume) return null;
  const m = volume.replace(/[$,\s]/g, "").match(/^([\d.]+)([MKB])?/i);
  if (!m) return null;
  const base = parseFloat(m[1]);
  if (!Number.isFinite(base)) return null;
  const unit = m[2]?.toUpperCase();
  const mult = unit === "B" ? 1e9 : unit === "M" ? 1e6 : unit === "K" ? 1e3 : 1;
  return base * mult;
}

/**
 * Ingest externally researched findings into the same review queue.
 * Only fields that actually differ from the record become proposals, so the queue
 * never asks Mike to approve a no-op.
 */
export async function ingestResearchFindings(state: string, findings: ResearchFinding[]) {
  const agents = await db.listAgents(state);
  const byId = new Map(agents.map(a => [a.id, a]));
  const byName = new Map(agents.map(a => [a.fullName.trim().toLowerCase(), a]));

  const runId = await db.createVerificationRun({ state, source: "research", status: "running" });
  const rows: InsertAgentVerification[] = [];
  const unmatched: string[] = [];

  for (const f of findings) {
    const agent = (f.agentId ? byId.get(f.agentId) : undefined) ?? byName.get(f.agentName.trim().toLowerCase());
    if (!agent) {
      unmatched.push(f.agentName);
      continue;
    }

    const differs = (incoming: string | null | undefined, current: string | null) => {
      if (incoming === null || incoming === undefined || incoming === "") return null;
      return incoming.trim() === (current ?? "").trim() ? null : incoming.trim();
    };

    const proposedTotalSides =
      f.totalSides !== null && f.totalSides !== undefined && f.totalSides !== agent.realtrendsTotalSides
        ? f.totalSides
        : null;
    const proposedVolume = differs(f.volume, agent.realtrendsVolume);

    const row: InsertAgentVerification = {
      runId,
      agentId: agent.id,
      agentName: agent.fullName,
      outcome: f.outcome,
      status: f.outcome === "confirmed" ? "auto" : "pending",
      recordedBrokerage: agent.brokerage,
      recordedPrincipalBroker: agent.principalBrokerName,
      recordedCityArea: agent.cityArea,
      proposedBrokerage: differs(f.brokerage, agent.brokerage),
      proposedPrincipalBroker: differs(f.principalBrokerName, agent.principalBrokerName),
      proposedPrincipalBrokerPhone: differs(f.principalBrokerPhone, agent.principalBrokerPhone),
      proposedPrincipalBrokerEmail: differs(f.principalBrokerEmail, agent.principalBrokerEmail),
      proposedPrincipalBrokerHeadshotUrl: differs(
        f.principalBrokerHeadshotUrl,
        agent.principalBrokerHeadshotUrl,
      ),
      proposedCityArea: differs(f.cityArea, agent.cityArea),
      proposedPhone: differs(f.phone, agent.phone),
      proposedEmail: differs(f.email, agent.email),
      proposedWebsiteBioUrl: differs(f.websiteBioUrl, agent.websiteBioUrl),
      proposedZillowUrl: differs(f.zillowUrl, agent.zillowUrl),
      proposedTotalSides,
      proposedVolumeNum: proposedVolume ? parseVolumeNum(proposedVolume) : null,
      proposedVolume,
      evidenceNote: f.evidenceNote ?? null,
      evidenceUrl: f.evidenceUrl ?? null,
      unverifiedReason: f.unverifiedReason ?? null,
      confidence: f.confidence ?? null,
    };

    const hasProposal = [
      row.proposedBrokerage,
      row.proposedPrincipalBroker,
      row.proposedPrincipalBrokerPhone,
      row.proposedPrincipalBrokerEmail,
      row.proposedPrincipalBrokerHeadshotUrl,
      row.proposedCityArea,
      row.proposedPhone,
      row.proposedEmail,
      row.proposedWebsiteBioUrl,
      row.proposedZillowUrl,
      row.proposedTotalSides,
      row.proposedVolume,
    ].some(v => v !== null && v !== undefined);

    // A "changed" finding with nothing actually different is really a confirmation.
    if (f.outcome === "changed" && !hasProposal) {
      row.outcome = "confirmed";
      row.status = "auto";
      row.evidenceNote =
        (f.evidenceNote ? `${f.evidenceNote} ` : "") +
        "(Research reported a change but every field matches the record, so nothing needs approval.)";
    }

    rows.push(row);
  }

  await db.supersedePendingForAgents(rows.map(r => r.agentId));
  await db.insertVerifications(rows);

  const summary = {
    agentsChecked: rows.length,
    confirmedCount: rows.filter(r => r.outcome === "confirmed").length,
    changedCount: rows.filter(r => r.outcome === "changed").length,
    unverifiedCount: rows.filter(r => r.outcome === "unverified").length,
  };
  await db.updateVerificationRun(runId, { ...summary, status: "complete", finishedAt: new Date() });
  return { runId, ...summary, unmatched } as const;
}
