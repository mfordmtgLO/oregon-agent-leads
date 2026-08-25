import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import * as db from "./db";

const IDEMPOTENCY_WINDOW_MS = 20 * 60 * 60 * 1000;

/**
 * Background callback for user-configured New Pairings jobs. It is intentionally
 * review-safe: imported public-record rows are the source of truth, and this
 * callback records the run boundary without auto-approving or inventing pairs.
 */
export async function handleNewPairings(req: Request, res: Response) {
  const startedAt = new Date();
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const schedule = await db.getPairingDiscoveryScheduleByTaskUid(user.taskUid);
    if (!schedule || !schedule.enabled) return res.json({ ok: true, skipped: schedule ? "disabled" : "orphan" });
    if (schedule.lastRunStartedAt && Date.now() - schedule.lastRunStartedAt.getTime() < IDEMPOTENCY_WINDOW_MS) {
      return res.json({ ok: true, skipped: "already-running-or-recent", lastRunAt: schedule.lastRunAt });
    }
    await db.updatePairingDiscoverySchedule(schedule.id, { lastRunStartedAt: startedAt, lastRunStatus: "running" });
    const completedAt = new Date();
    await db.updatePairingDiscoverySchedule(schedule.id, {
      lastRunAt: completedAt,
      lastRunCompletedAt: completedAt,
      lastRunStatus: "complete",
      lastRunPairingsCreated: 0,
    });
    return res.json({ ok: true, mode: "background", status: "complete", importedRowsProcessed: 0, pairingsCreated: 0, reviewSafe: true, note: "No external public-record feed is connected; process licensed/imported rows when supplied." });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[NewPairings] Failed", error);
    return res.status(500).json({ error: message, stack: error instanceof Error ? error.stack : undefined, context: { url: req.originalUrl, taskUid: "cron-authenticated" }, timestamp: new Date().toISOString() });
  }
}
