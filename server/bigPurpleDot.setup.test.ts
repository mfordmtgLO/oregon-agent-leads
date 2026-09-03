import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../client/src/pages/BigPurpleDotSetup.tsx", import.meta.url), "utf8");
const router = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

describe("Big Purple Dot setup workspace", () => {
  it("offers provider-approved connection modes and pairing defaults", () => {
    expect(page).toContain("Official API");
    expect(page).toContain("OAuth / SSO");
    expect(page).toContain("Webhook / event hook");
    expect(page).toContain("Licensed CSV / JSON export");
    expect(page).toContain("Shared closing threshold");
    expect(page).toContain("Field mapping JSON");
  });

  it("does not render a raw password input and keeps the provider procedure protected", () => {
    expect(page).not.toMatch(/type=["']password["']/i);
    expect(page).toContain("No raw password is stored here");
    expect(router).toContain("bigPurpleDot: router({");
    expect(router).toContain("status: sessionProcedure");
    expect(router).toContain("save: sessionProcedure");
  });
});
