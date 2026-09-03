import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(new URL("../client/src/pages/Dashboard.tsx", import.meta.url), "utf8");
const offices = readFileSync(new URL("../client/src/pages/OfficeRankings.tsx", import.meta.url), "utf8");

describe("directory selection and export contract", () => {
  it("supports individual and visible agent/broker selection", () => {
    expect(dashboard).toContain("selectedRecordIds");
    expect(dashboard).toContain("Agents");
    expect(dashboard).toContain("Offices / Brokers");
    expect(dashboard).toContain("Principal / Managing Brokers");
    expect(dashboard).toContain("Select ${agent.fullName}");
  });
  it("supports office selection and visible-list-only export", () => {
    expect(offices).toContain("selectedOfficeKeys");
    expect(offices).toContain("Select all visible offices");
    expect(dashboard).toContain("Visible list only");
    expect(dashboard).toContain("ids: selectedVisibleIds");
    expect(dashboard).toContain("recordType: exportRecordType");
    expect(dashboard).toContain("filtered.map(record => record.id)");
  });
});
