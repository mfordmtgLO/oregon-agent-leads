import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(new URL("../client/src/pages/Dashboard.tsx", import.meta.url), "utf8");
const directory = readFileSync(new URL("../shared/brokerDirectory.ts", import.meta.url), "utf8");

describe("directory category filters", () => {
  it("exposes agents, offices/brokers, and principal/managing broker modes", () => {
    expect(dashboard).toContain('type DirectoryCategory = "agents" | "offices" | "principal_managing"');
    expect(dashboard).toContain("Offices / Brokers");
    expect(dashboard).toContain("Principal / Managing Brokers");
    expect(dashboard).toContain("directoryCategory === \"agents\"");
    expect(dashboard).toContain('record.recordType === "office"');
    expect(dashboard).toContain('record.recordType === "principal_broker"');
  });
  it("preserves the broker role label instead of dropping managing brokers", () => {
    expect(directory).toContain('agent.principalBrokerTitle?.trim() || "Principal Broker"');
  });
});
