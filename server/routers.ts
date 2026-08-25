import { TRPCError } from "@trpc/server";
import { parse as parseCookieHeader } from "cookie";
import { listHeartbeatJobs } from "./_core/heartbeat";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  APP_SESSION_COOKIE,
  createSessionToken,
  SESSION_TTL_MS,
  verifyCredentials,
  verifySessionToken,
} from "./appAuth";
import { agentsToCsv } from "./csv";
import * as db from "./db";
import { storagePut } from "./storage";
import { DEFAULT_STATE, US_STATES } from "@shared/states";
import {
  ingestResearchFindings,
  researchFindingSchema,
  verificationProcedures,
} from "./verificationRouter";

const stateSchema = z.enum(US_STATES);

function getAppSessionCookie(req: { headers: { cookie?: string } }): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  const parsed = parseCookieHeader(raw);
  return parsed[APP_SESSION_COOKIE] ?? undefined;
}

/** Procedure guarded by the single-user app session cookie. */
const sessionProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!verifySessionToken(getAppSessionCookie(ctx.req))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in" });
  }
  return next({ ctx });
});

const agentInputSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(255),
  state: stateSchema.optional().default(DEFAULT_STATE),
  brokerage: z.string().max(255).optional().default(""),
  cityArea: z.string().max(255).optional().default(""),
  phone: z.string().max(64).optional().default(""),
  email: z.string().max(320).optional().default(""),
  websiteBioUrl: z.string().optional().default(""),
  zillowUrl: z.string().optional().default(""),
  headshotUrl: z.string().optional().default(""),
  buyerSideTransactions: z.string().optional().default(""),
  salesLast12Months: z.string().optional().default(""),
  otherProductionStats: z.string().optional().default(""),
  realtrendsRank: z.number().int().nullable().optional(),
  realtrendsTotalSides: z.number().nullable().optional(),
  realtrendsVolume: z.string().max(64).optional().default(""),
  notes: z.string().optional().default(""),
});

function parseVolumeNum(volume: string | null | undefined): number | null {
  if (!volume) return null;
  const m = volume.replace(/[$,\s]/g, "").match(/^([\d.]+)([MKB])?/i);
  if (!m) return null;
  const base = parseFloat(m[1]);
  if (!Number.isFinite(base)) return null;
  const mult = m[2]?.toUpperCase() === "B" ? 1e9 : m[2]?.toUpperCase() === "M" ? 1e6 : m[2]?.toUpperCase() === "K" ? 1e3 : 1;
  return base * mult;
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  appAuth: router({
    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(({ ctx, input }) => {
        if (!verifyCredentials(input.username.trim(), input.password)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username or password" });
        }
        const token = createSessionToken();
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(APP_SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_TTL_MS });
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(APP_SESSION_COOKIE, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    session: publicProcedure.query(({ ctx }) => {
      const authenticated = verifySessionToken(getAppSessionCookie(ctx.req));
      return { authenticated, username: authenticated ? "mike.ford" : null } as const;
    }),
  }),

  agents: router({
    list: sessionProcedure
      .input(z.object({ state: stateSchema.optional() }).optional())
      .query(({ input }) => db.listAgents(input?.state)),
    /** Treat placeholder strings like "Not found" as missing values. */
    /**
     * Office rankings: group agents by office (brokerage + rank), ranked 1-60
     * by estimated annual buyside transactions. Agents sharing an office share a rank.
     */
    officeRankings: sessionProcedure
      .input(z.object({ state: stateSchema.optional() }).optional())
      .query(async ({ input }) => {
      const all = await db.listAgents(input?.state);
      const clean = (v: string | null): string | null =>
        v && !/^not\s+found$/i.test(v.trim()) ? v : null;
      const withOffice = all.filter(a => a.officeBuysideRank !== null);
      const byOffice = new Map<
        string,
        {
          officeBuysideRank: number;
          brokerage: string | null;
          cityArea: string | null;
          principalBrokerName: string | null;
          principalBrokerTitle: string | null;
          principalBrokerPhone: string | null;
          principalBrokerEmail: string | null;
          principalBrokerHeadshotUrl: string | null;
          officeBuysideTransactions: number | null;
          officeDataConfidence: string | null;
          agents: { id: number; fullName: string; headshotUrl: string | null }[];
        }
      >();
      for (const a of withOffice) {
        const key = `${a.officeBuysideRank}::${a.brokerage ?? ""}::${a.principalBrokerName ?? ""}`;
        const existing = byOffice.get(key);
        if (existing) {
          existing.agents.push({ id: a.id, fullName: a.fullName, headshotUrl: a.headshotUrl });
        } else {
          byOffice.set(key, {
            officeBuysideRank: a.officeBuysideRank!,
            brokerage: a.brokerage,
            cityArea: a.cityArea,
            principalBrokerName: clean(a.principalBrokerName),
            principalBrokerTitle: clean(a.principalBrokerTitle),
            principalBrokerPhone: clean(a.principalBrokerPhone),
            principalBrokerEmail: clean(a.principalBrokerEmail),
            principalBrokerHeadshotUrl: clean(a.principalBrokerHeadshotUrl),
            officeBuysideTransactions: a.officeBuysideTransactions,
            officeDataConfidence: a.officeDataConfidence,
            agents: [{ id: a.id, fullName: a.fullName, headshotUrl: a.headshotUrl }],
          });
        }
      }
      return Array.from(byOffice.values()).sort((x, y) => x.officeBuysideRank - y.officeBuysideRank);
    }),
    get: sessionProcedure
      .input(z.object({ id: z.number().int() }))
      .query(async ({ input }) => {
        const agent = await db.getAgentById(input.id);
        if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
        return agent;
      }),
    create: sessionProcedure.input(agentInputSchema).mutation(async ({ input }) => {
      const id = await db.createAgent({
        ...input,
        realtrendsRank: input.realtrendsRank ?? null,
        realtrendsTotalSides: input.realtrendsTotalSides ?? null,
        realtrendsVolumeNum: parseVolumeNum(input.realtrendsVolume),
        isCustom: true,
      });
      return { id } as const;
    }),
    updateNotes: sessionProcedure
      .input(z.object({ id: z.number().int(), notes: z.string() }))
      .mutation(async ({ input }) => {
        await db.updateAgentNotes(input.id, input.notes);
        return { success: true } as const;
      }),
    update: sessionProcedure
      .input(agentInputSchema.partial().extend({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const { id, ...fields } = input;
        await db.updateAgent(id, {
          ...fields,
          ...(fields.realtrendsVolume !== undefined
            ? { realtrendsVolumeNum: parseVolumeNum(fields.realtrendsVolume) }
            : {}),
        });
        return { success: true } as const;
      }),
    delete: sessionProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const agent = await db.getAgentById(input.id);
        if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
        if (!agent.isCustom) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Pre-loaded agents cannot be deleted" });
        }
        await db.deleteAgent(input.id);
        return { success: true } as const;
      }),
    exportCsv: sessionProcedure
      .input(z.object({ state: stateSchema.optional() }).optional())
      .mutation(async ({ input }) => {
      const all = await db.listAgents(input?.state);
      const sorted = [...all].sort((a, b) => {
        const ra = a.realtrendsRank ?? Number.MAX_SAFE_INTEGER;
        const rb = b.realtrendsRank ?? Number.MAX_SAFE_INTEGER;
        return ra - rb;
      });
      return { csv: agentsToCsv(sorted), count: sorted.length } as const;
    }),
    uploadHeadshot: sessionProcedure
      .input(z.object({ base64: z.string(), fileName: z.string(), mimeType: z.string() }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        if (buffer.length > 8 * 1024 * 1024) {
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Image must be under 8MB" });
        }
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `headshots/${Date.now()}-${safeName}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url } as const;
      }),
  }),

  /** "Update Current Top Agents" verification queue. */
  verification: router({
    /** Trigger an automated sweep of the selected state's agents. */
    run: sessionProcedure
      .input(z.object({ state: stateSchema.optional(), limit: z.number().int().min(1).max(200).optional() }).optional())
      .mutation(({ input }) => verificationProcedures.run(input?.state ?? DEFAULT_STATE, input?.limit)),
    /** Findings awaiting a decision. */
    queue: sessionProcedure
      .input(z.object({ state: stateSchema.optional() }).optional())
      .query(({ input }) => db.listPendingVerifications(input?.state)),
    /** Recent run history, for the "last checked" line. */
    runs: sessionProcedure
      .input(z.object({ state: stateSchema.optional() }).optional())
      .query(({ input }) => db.listVerificationRuns(input?.state ?? DEFAULT_STATE, 10)),
    /** All findings from one run, including confirmations. */
    runDetail: sessionProcedure
      .input(z.object({ runId: z.number().int() }))
      .query(({ input }) => db.listVerificationsByRun(input.runId)),
    approve: sessionProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(({ input }) => verificationProcedures.approve(input.id)),
    reject: sessionProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(({ input }) => verificationProcedures.reject(input.id)),
    /** Ingest findings from an external research pass. */
    ingest: sessionProcedure
      .input(z.object({ state: stateSchema.optional(), findings: z.array(researchFindingSchema) }))
      .mutation(({ input }) => ingestResearchFindings(input.state ?? DEFAULT_STATE, input.findings)),
    /** Monthly production job status for the review dashboard. */
    scheduleStatus: sessionProcedure.query(async () => {
      const schedule = await db.getVerificationScheduleByName("monthly-oregon-agent-verification");
      const heartbeat = await listHeartbeatJobs("");
      const job = heartbeat.jobs.find(item => item.name === "monthly-oregon-agent-verification");
      const pending = await db.listPendingVerifications(DEFAULT_STATE);
      return {
        configured: Boolean(schedule && job),
        enabled: Boolean(schedule?.enabled && job?.isEnable),
        cronExpression: schedule?.cronExpression ?? job?.cronExpression ?? null,
        lastRunAt: schedule?.lastRunAt ?? null,
        lastRunId: schedule?.lastRunId ?? null,
        lastNotificationSentAt: schedule?.lastNotificationSentAt ?? null,
        nextExecutionAt: job?.nextExecutionAt ?? null,
        pendingApprovalCount: pending.length,
        taskUid: schedule?.scheduleCronTaskUid ?? job?.taskUid ?? null,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
