import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { createSessionToken } from "./appAuth";
import { appRouter } from "./routers";

function createCtx(cookies: Record<string, string> = {}): TrpcContext {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return {
    user: null,
    req: {
      protocol: "https",
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    } as unknown as TrpcContext["req"],
    res: {
      cookie: () => undefined,
      clearCookie: () => undefined,
    } as unknown as TrpcContext["res"],
  };
}

describe("appAuth router", () => {
  it("login succeeds with correct credentials", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.appAuth.login({ username: "mike.ford", password: "OregonMLO2025!" });
    expect(result.success).toBe(true);
  });

  it("login fails with wrong credentials", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.appAuth.login({ username: "mike.ford", password: "bad" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("session reports unauthenticated without cookie", async () => {
    const caller = appRouter.createCaller(createCtx());
    const session = await caller.appAuth.session();
    expect(session.authenticated).toBe(false);
  });

  it("session reports authenticated with a valid cookie", async () => {
    const caller = appRouter.createCaller(createCtx({ oal_session: createSessionToken() }));
    const session = await caller.appAuth.session();
    expect(session.authenticated).toBe(true);
    expect(session.username).toBe("mike.ford");
  });
});

describe("agents router guards", () => {
  it("rejects list without a session", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.agents.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects exportCsv without a session", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.agents.exportCsv()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
