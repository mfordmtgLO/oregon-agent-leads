import { describe, expect, it } from "vitest";
import * as db from "./db";
import { pickPrincipalBrokerSourceUrl } from "./verification";

const INCONCLUSIVE_AGENT_IDS = [1, 6, 8, 10, 13, 14, 19, 27, 29, 30, 31, 37, 39, 43];

describe("targeted broker source contract", () => {
  it("resolves a record-specific office or broker URL for all 14 inconclusive records", async () => {
    for (const id of INCONCLUSIVE_AGENT_IDS) {
      const agent = await db.getAgentById(id);
      expect(agent, `agent ${id} should exist`).toBeDefined();
      const source = pickPrincipalBrokerSourceUrl(agent!);
      expect(source, `agent ${id} should have a targeted source`).toMatch(/^https?:\/\//);
      expect(source, `agent ${id} should not resolve to a social or ranking URL`).not.toMatch(
        /zillow|realtrends|youtube|facebook|instagram|linkedin|experience\.com/i,
      );
    }
  });
});
