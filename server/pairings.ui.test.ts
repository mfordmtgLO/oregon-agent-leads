import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/Pairings.tsx", import.meta.url), "utf8");

describe("Mortgage Pairings UI contract", () => {
  it("has a conservative empty state and evidence standard", () => {
    expect(source).toContain("No evidenced pairings yet");
    expect(source).toContain("Every pairing requires a public source");
    expect(source).toContain("Use the protected ingest procedure");
  });

  it("renders source links and review actions for sourced findings", () => {
    expect(source).toContain('href={pairing.sourceUrl}');
    expect(source).toContain("View source");
    expect(source).toContain('approve.mutate({ id: pairing.id })');
    expect(source).toContain('reject.mutate({ id: pairing.id })');
  });
});
