import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const directorySource = readFileSync(new URL("../shared/brokerDirectory.ts", import.meta.url), "utf8");
const editorSource = readFileSync(new URL("../client/src/components/PrincipalBrokerNotesEditor.tsx", import.meta.url), "utf8");
const dashboardSource = readFileSync(new URL("../client/src/pages/Dashboard.tsx", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

describe("principal broker notes contract", () => {
  it("keeps office notes separate from individual agent notes", () => {
    expect(directorySource).toContain("principalBrokerNotes");
    expect(directorySource).toContain("notes: agent.principalBrokerNotes ?? null");
    expect(directorySource).toContain("brokerSourceAgentId: agent.id");
  });
  it("renders a protected office-note editor on broker cards and dialogs", () => {
    expect(editorSource).toContain("updatePrincipalBrokerNotes");
    expect(editorSource).toContain("Office Notes");
    expect(dashboardSource).toContain("<PrincipalBrokerNotesEditor");
    expect(routerSource).toContain("updatePrincipalBrokerNotes");
  });
});
