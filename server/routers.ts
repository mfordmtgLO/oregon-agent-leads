import { TRPCError } from "@trpc/server";
import { parse as parseCookieHeader } from "cookie";
import { createHeartbeatJob, listHeartbeatJobs, updateHeartbeatJob } from "./_core/heartbeat";
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
import { buildDirectory } from "@shared/brokerDirectory";
import {
  ingestResearchFindings,
  researchFindingSchema,
  verificationProcedures,
} from "./verificationRouter";
import { pairingDiscoverySchedules } from "../drizzle/schema";

const stateSchema = z.enum(US_STATES);
const pairingSchema = z.object({
  state: stateSchema.default(DEFAULT_STATE),
  agentId: z.number().int().positive(),
  loanOfficerName: z.string().min(2).max(255),
  loanOfficerCompany: z.string().max(255).optional().nullable(),
  loanOfficerPhone: z.string().max(64).optional().nullable(),
  loanOfficerEmail: z.string().email().max(320).optional().nullable(),
  loanOfficerHeadshotUrl: z.string().url().max(2000).optional().nullable(),
  loanOfficerNmlsId: z.string().max(64).optional().nullable(),
  lenderName: z.string().max(255).optional().nullable(),
  transactionAddress: z.string().max(500).optional().nullable(),
  transactionClosedAt: z.coerce.date().optional().nullable(),
  transactionType: z.string().max(32).optional().nullable(),
  loanType: z.string().max(64).optional().nullable(),
  interestRate: z.number().nonnegative().optional().nullable(),
  loanAmount: z.number().nonnegative().optional().nullable(),
  purchasePrice: z.number().nonnegative().optional().nullable(),
  propertyZillowUrl: z.string().url().max(2000).optional().nullable(),
  sharedTransactionCount: z.number().int().min(1).default(1),
  totalSharedLoanVolume: z.number().nonnegative().optional().nullable(),
  firstSharedClose: z.coerce.date().optional().nullable(),
  latestSharedClose: z.coerce.date().optional().nullable(),
  matchMethod: z.string().max(64).default("manual"),
  sourceUrl: z.string().url().max(2000),
  sourceTitle: z.string().max(500).optional().nullable(),
  evidenceNote: z.string().min(10).max(5000),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
});

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
        return { success: true };
      }),
    updatePrincipalBrokerNotes: sessionProcedure
      .input(z.object({ agentId: z.number().int(), notes: z.string() }))
      .mutation(async ({ input }) => {
        await db.updatePrincipalBrokerNotes(input.agentId, input.notes);
        return { success: true };
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
      .input(z.object({ state: stateSchema.optional(), ids: z.array(z.number().int()).optional(), recordType: z.enum(["agent", "office", "principal_broker"]).optional() }).optional())
      .mutation(async ({ input }) => {
      const all = await db.listAgents(input?.state);
      const directory = input?.recordType ? buildDirectory(all).filter(record => record.recordType === input.recordType) : all;
      const scoped = input?.ids?.length ? directory.filter(record => input.ids!.includes(record.id)) : directory;
      const sorted = [...scoped].sort((a, b) => {
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
  pairings: router({
    list: sessionProcedure
      .input(z.object({ state: stateSchema.optional(), status: z.enum(["pending", "approved", "rejected"]).optional() }).optional())
      .query(({ input }) => db.listLoanOfficerAgentPairings(input?.state ?? DEFAULT_STATE, input?.status)),
    options: sessionProcedure
      .input(z.object({ state: stateSchema.optional(), windowDays: z.enum(["30", "60", "90", "120", "180", "365", "730"]).default("365"), customStartAt: z.coerce.date().nullable().optional(), customEndAt: z.coerce.date().nullable().optional() }).optional())
      .query(({ input }) => db.listLoanOfficerAgentPairingOptions(input?.state ?? DEFAULT_STATE, Number(input?.windowDays ?? "365"), input?.customStartAt, input?.customEndAt)),
    ingest: sessionProcedure
      .input(z.object({ pairings: z.array(pairingSchema).min(1).max(200) }))
      .mutation(({ input }) => db.insertLoanOfficerAgentPairings(input.pairings as never).then(() => ({ inserted: input.pairings.length }))),
    schedule: sessionProcedure
      .input(z.object({ cron: z.string().regex(/^\\d+ \\d+ \\d+ \\* \\* \\*$/), enabled: z.boolean().default(true), lookbackDays: z.number().int().min(30).max(730).default(365), customStartAt: z.coerce.date().nullable().optional(), customEndAt: z.coerce.date().nullable().optional() }))
      .mutation(async ({ input, ctx }) => {
        const ownerOpenId = "mike.ford";
        const existing = await db.getPairingDiscoveryScheduleByOwner(ownerOpenId);
        const fields = { state: DEFAULT_STATE, cronExpression: input.cron, enabled: input.enabled, lookbackDays: input.lookbackDays, customStartAt: input.customStartAt ?? null, customEndAt: input.customEndAt ?? null };
        const sessionToken = getAppSessionCookie(ctx.req) ?? "";
        let schedule = existing;
        if (!existing) {
          const job = await createHeartbeatJob({ name: "new-pairings-oregon", cron: input.cron, path: "/api/scheduled/newPairings", description: "User-configured public-record LO+Agent pairing discovery" }, sessionToken);
          schedule = await db.insertPairingDiscoverySchedule({ ownerOpenId, ...fields, scheduleCronTaskUid: job.taskUid });
        } else {
          if (existing.scheduleCronTaskUid) await updateHeartbeatJob(existing.scheduleCronTaskUid, { cron: input.cron, enable: input.enabled }, sessionToken);
          schedule = await db.updatePairingDiscoverySchedule(existing.id, fields);
        }
        return schedule;
      }),
    scheduleStatus: sessionProcedure.query(() => db.getPairingDiscoveryScheduleByOwner("mike.ford")),
    update: sessionProcedure
      .input(pairingSchema.partial().extend({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const { id, ...fields } = input;
        const clean = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
        await db.updateLoanOfficerAgentPairing(id, clean as never);
        return { success: true };
      }),
    approve: sessionProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(({ input }) => db.setLoanOfficerAgentPairingStatus(input.id, "approved").then(() => ({ success: true }))),
    reject: sessionProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(({ input }) => db.setLoanOfficerAgentPairingStatus(input.id, "rejected").then(() => ({ success: true }))),
  }),

  /** Inactive Big Purple Dot setup profile; credentials stay in secure configuration. */
  bigPurpleDot: router({
    status: sessionProcedure.query(() => db.getProviderConnectionByOwner("mike.ford")),
    save: sessionProcedure
      .input(z.object({
        product: z.string().max(120).optional().nullable(),
        connectionMode: z.enum(["not_configured", "api", "oauth", "webhook", "licensed_export"]).default("not_configured"),
        baseUrl: z.string().url().max(2000).optional().or(z.literal("")),
        apiKeyEnvVar: z.string().max(120).optional().nullable(),
        oauthClientIdEnvVar: z.string().max(120).optional().nullable(),
        webhookSecretEnvVar: z.string().max(120).optional().nullable(),
        webhookPath: z.string().max(255).optional().nullable(),
        territoryScope: z.string().max(255).default("Oregon"),
        historicalDepth: z.string().max(64).optional().nullable(),
        fieldMappingJson: z.string().max(20000).optional().nullable(),
        pairingThreshold: z.number().int().min(1).max(50).default(3),
        pairingLookbackDays: z.number().int().min(30).max(730).default(365),
        enabled: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const ownerOpenId = "mike.ford";
        const existing = await db.getProviderConnectionByOwner(ownerOpenId);
        const fields = {
          provider: "Big Purple Dot",
          product: input.product ?? null,
          connectionMode: input.connectionMode,
          baseUrl: input.baseUrl || null,
          apiKeyEnvVar: input.apiKeyEnvVar ?? null,
          oauthClientIdEnvVar: input.oauthClientIdEnvVar ?? null,
          webhookSecretEnvVar: input.webhookSecretEnvVar ?? null,
          webhookPath: input.webhookPath ?? null,
          territoryScope: input.territoryScope,
          historicalDepth: input.historicalDepth ?? null,
          fieldMappingJson: input.fieldMappingJson ?? null,
          pairingThreshold: input.pairingThreshold,
          pairingLookbackDays: input.pairingLookbackDays,
          enabled: input.enabled,
          readinessStatus: input.connectionMode === "not_configured" ? "needs_credentials" : "awaiting_provider_validation",
        };
        return existing
          ? db.updateProviderConnection(existing.id, fields)
          : db.insertProviderConnection({ ownerOpenId, ...fields });
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
