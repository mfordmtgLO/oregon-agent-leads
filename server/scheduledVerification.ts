import type { Request, Response } from "express";
import { notifyOwner } from "./_core/notification";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { fetchPage, runPrincipalBrokerSweep } from "./verification";
import { runVerificationSweep } from "./verificationRouter";

const SCHEDULE_NAME = "monthly-oregon-agent-verification";
const STATE = "Oregon";
const LOW_CREDIT_AGENT_FETCH_TIMEOUT_MS = 900;
const LOW_CREDIT_BROKER_FETCH_TIMEOUT_MS = 500;
const IDEMPOTENCY_WINDOW_MS = 20 * 60 * 60 * 1000;
const LIVE_REVIEW_URL = "https://oregonleads-bqkuz5cc.manus.space/review";

/**
 * Monthly callback: one fetch at a time, checking each stored agent profile and
 * the paired principal/managing principal broker evidence on that page. Findings
 * never update agent records automatically; only Mike's approval does that.
 */
export async function handleMonthlyVerification(req: Request, res: Response) {
  const startedAt = new Date();
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const schedule = await db.getVerificationScheduleByTaskUid(user.taskUid);
    if (!schedule || !schedule.enabled || schedule.name !== SCHEDULE_NAME) {
      // An orphaned or disabled callback is a successful no-op so the platform
      // does not retry a business configuration issue forever.
      return res.json({ ok: true, skipped: schedule ? "disabled" : "orphan" });
    }

    // Heartbeat retries after a 5xx. A completed or in-flight run inside this
    // window is therefore treated as already handled.
    if (schedule.lastRunAt && Date.now() - schedule.lastRunAt.getTime() < IDEMPOTENCY_WINDOW_MS) {
      if (schedule.lastRunId) {
        const previous = await db.getVerificationRun(schedule.lastRunId);
        if (previous?.status === "complete" || previous?.status === "running") {
          return res.json({ ok: true, skipped: "already-running-or-complete", runId: schedule.lastRunId });
        }
      }
    }

    await db.updateVerificationSchedule(schedule.id, { lastRunAt: startedAt });
    const result = await runVerificationSweep(STATE, {
      sequential: true,
      // Keep the full agent + paired-broker review inside the two-minute callback
      // budget. A page that cannot answer quickly is explicitly unverified.
      fetchImpl: url => fetchPage(url, LOW_CREDIT_AGENT_FETCH_TIMEOUT_MS),
    });
    const agents = await db.listAgents(STATE);
    const brokerChecks = await runPrincipalBrokerSweep(agents, {
      fetchImpl: url => fetchPage(url, LOW_CREDIT_BROKER_FETCH_TIMEOUT_MS),
    });
    const brokerConfirmedCount = brokerChecks.filter(check => check.outcome === "confirmed").length;
    const brokerUnverifiedCount = brokerChecks.length - brokerConfirmedCount;
    await db.updateVerificationSchedule(schedule.id, { lastRunId: result.runId });

    const needsApproval = result.changedCount + result.unverifiedCount;
    let notificationSent = false;
    if (needsApproval > 0) {
      notificationSent = await notifyOwner({
        title: `Oregon agent verification ready: ${needsApproval} items need approval`,
        content:
          `Monthly low-credit sequential verification checked ${result.agentsChecked} Oregon agents and separately checked ${brokerChecks.length} paired principal/managing principal broker source records. ` +
          `${result.confirmedCount} agent records were confirmed automatically; ${result.changedCount} changed and ${result.unverifiedCount} remain unverified. ` +
          `${brokerConfirmedCount} broker source records matched and ${brokerUnverifiedCount} were inconclusive. ` +
          `RealTrends 2026 ranks were not changed. Review the queue: ${LIVE_REVIEW_URL}`,
      });
      if (notificationSent) {
        await db.updateVerificationSchedule(schedule.id, { lastNotificationSentAt: new Date() });
      }
    }

    return res.json({
      ok: true,
      schedule: SCHEDULE_NAME,
      ...result,
      brokerSourcesChecked: brokerChecks.length,
      brokerConfirmedCount,
      brokerUnverifiedCount,
      notificationSent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[MonthlyVerification] Failed", error);
    return res.status(500).json({
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      context: { url: req.originalUrl, taskUid: "cron-authenticated" },
      timestamp: new Date().toISOString(),
    });
  }
}

export { SCHEDULE_NAME };
