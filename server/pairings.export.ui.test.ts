import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/Pairings.tsx", import.meta.url), "utf8");

describe("selected pairing export contract", () => {
  it("exports only selected visible rows with the requested transaction columns", () => {
    expect(source).toContain("filtered.filter(row => selectedIds.includes(row.id))");
    expect(source).toContain("Property Address");
    expect(source).toContain("Loan Type");
    expect(source).toContain("Interest Rate");
    expect(source).toContain("Purchase Price");
    expect(source).toContain("Zillow Property URL");
    expect(source).toContain("lo-agent-pairings.csv");
  });
});
