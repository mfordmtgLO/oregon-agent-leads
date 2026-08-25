import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../client/src/pages/Pairings.tsx", import.meta.url), "utf8");
const router = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

describe("New Pairings schedule contract", () => {
  it("exposes every requested quick timeframe and custom date inputs", () => {
    for (const label of ["30 days", "60 days", "90 days", "120 days", "6 months", "1 year", "2 years"]) expect(page).toContain(label);
    expect(page).toContain('type="date"');
    expect(page).toContain("Save automation");
  });

  it("uses a protected schedule procedure and scheduled callback", () => {
    expect(router).toContain("schedule: sessionProcedure");
    expect(router).toContain("/api/scheduled/newPairings");
  });
});
