import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getVerificationScheduleByTaskUid: vi.fn(),
  getVerificationRun: vi.fn(),
  updateVerificationSchedule: vi.fn(),
  notifyOwner: vi.fn(),
  runVerificationSweep: vi.fn(),
  runPrincipalBrokerSweep: vi.fn(),
  listAgents: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./db", () => ({
  getVerificationScheduleByTaskUid: mocks.getVerificationScheduleByTaskUid,
  listAgents: mocks.listAgents,
  getVerificationRun: mocks.getVerificationRun,
  updateVerificationSchedule: mocks.updateVerificationSchedule,
}));
vi.mock("./_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));
vi.mock("./verificationRouter", () => ({ runVerificationSweep: mocks.runVerificationSweep }));
vi.mock("./verification", () => ({
  fetchPage: vi.fn(),
  runPrincipalBrokerSweep: mocks.runPrincipalBrokerSweep,
}));

const { handleMonthlyVerification } = await import("./scheduledVerification");

function response() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe("monthly verification callback", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rejects non-cron callers", async () => {
    mocks.authenticateRequest.mockResolvedValueOnce({ isCron: false });
    const res = response();
    await handleMonthlyVerification({ originalUrl: "/api/scheduled/monthlyVerification" } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "cron-only" });
  });

  it("treats an orphaned task as an idempotent success", async () => {
    mocks.authenticateRequest.mockResolvedValueOnce({ isCron: true, taskUid: "task-orphan" });
    mocks.getVerificationScheduleByTaskUid.mockResolvedValueOnce(undefined);
    const res = response();
    await handleMonthlyVerification({ originalUrl: "/api/scheduled/monthlyVerification" } as never, res as never);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, skipped: "orphan" });
  });

  it("runs the sequential sweep and notifies when approval is needed", async () => {
    mocks.authenticateRequest.mockResolvedValueOnce({ isCron: true, taskUid: "task-live" });
    mocks.getVerificationScheduleByTaskUid.mockResolvedValueOnce({
      id: 1,
      name: "monthly-oregon-agent-verification",
      state: "Oregon",
      enabled: true,
      cronExpression: "0 0 8 1 * *",
      lastRunAt: null,
      lastRunId: null,
    });
    mocks.listAgents.mockResolvedValueOnce([{ id: 1, fullName: "Test Agent" }]);
    mocks.runPrincipalBrokerSweep.mockResolvedValueOnce([
      { outcome: "confirmed" },
      { outcome: "unverified" },
    ]);
    mocks.runVerificationSweep.mockResolvedValueOnce({
      runId: 99,
      agentsChecked: 60,
      confirmedCount: 46,
      changedCount: 3,
      unverifiedCount: 11,
    });
    mocks.notifyOwner.mockResolvedValueOnce(true);
    const res = response();
    await handleMonthlyVerification({ originalUrl: "/api/scheduled/monthlyVerification" } as never, res as never);
    expect(mocks.runVerificationSweep).toHaveBeenCalledWith("Oregon", expect.objectContaining({ sequential: true }));
    expect(mocks.runPrincipalBrokerSweep).toHaveBeenCalledWith([{ id: 1, fullName: "Test Agent" }], expect.objectContaining({ fetchImpl: expect.any(Function) }));
    expect(mocks.notifyOwner).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining("14 items need approval"),
      content: expect.stringContaining("RealTrends 2026 ranks were not changed"),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, runId: 99, notificationSent: true, brokerSourcesChecked: 2 }));
  });

  it("suppresses a duplicate callback while the previous run is recent", async () => {
    mocks.authenticateRequest.mockResolvedValueOnce({ isCron: true, taskUid: "task-live" });
    mocks.getVerificationScheduleByTaskUid.mockResolvedValueOnce({
      id: 1,
      name: "monthly-oregon-agent-verification",
      state: "Oregon",
      enabled: true,
      cronExpression: "0 0 8 1 * *",
      lastRunAt: new Date(),
      lastRunId: 99,
    });
    mocks.getVerificationRun.mockResolvedValueOnce({ status: "complete", id: 99 });
    const res = response();
    await handleMonthlyVerification({ originalUrl: "/api/scheduled/monthlyVerification" } as never, res as never);
    expect(mocks.runVerificationSweep).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, skipped: "already-running-or-complete", runId: 99 });
  });
});
