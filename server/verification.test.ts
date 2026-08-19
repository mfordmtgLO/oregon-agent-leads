import { describe, expect, it } from "vitest";
import type { Agent } from "../drizzle/schema";
import {
  buildAgentUpdate,
  checkAgent,
  containsOrgPhrase,
  detectPrincipalBroker,
  extractVisibleText,
  isPlaceholder,
  isDistinctiveOrgName,
  looksBlocked,
  normalizeOrgName,
  pickCheckUrl,
  recomputeRanks,
  sameOrg,
  samePerson,
  type FetchedPage,
} from "./verification";

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 1,
    fullName: "Dirk Hmura",
    state: "Oregon",
    brokerage: "The Agency Portland",
    cityArea: "Portland, OR",
    phone: "(503) 740-0070",
    email: null,
    websiteBioUrl: "https://dirkhmura.com/",
    zillowUrl: "https://www.zillow.com/profile/Dirk%20Hmura",
    headshotUrl: null,
    buyerSideTransactions: null,
    salesLast12Months: null,
    otherProductionStats: null,
    realtrendsRank: 1,
    realtrendsTotalSides: 102,
    realtrendsVolume: "$87.98M",
    realtrendsVolumeNum: 87_980_000,
    dataSources: null,
    principalBrokerName: "Andrew Misk",
    principalBrokerTitle: "Principal Broker",
    principalBrokerPhone: null,
    principalBrokerEmail: null,
    principalBrokerHeadshotUrl: null,
    officeBuysideTransactions: 175,
    officeBuysideRank: 36,
    officeEstimationNotes: null,
    officeDataConfidence: "medium",
    officeDataSources: null,
    notes: null,
    isCustom: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Agent;
}

function page(overrides: Partial<FetchedPage> = {}): FetchedPage {
  return { ok: true, status: 200, text: "", blocked: false, ...overrides };
}

describe("name normalization", () => {
  it("treats legal suffixes and punctuation as noise", () => {
    expect(sameOrg("RE/MAX Power Pros, LLC", "REMAX Power Pros")).toBe(true);
    expect(sameOrg("John L. Scott Medford", "John L Scott")).toBe(true);
  });

  it("does not conflate genuinely different brokerages", () => {
    expect(sameOrg("The Agency Portland", "Windermere Realty Trust")).toBe(false);
  });

  it("returns false when either side is missing", () => {
    expect(sameOrg(null, "Redfin")).toBe(false);
    expect(sameOrg("Redfin", "")).toBe(false);
  });

  it("keeps nicknames distinct so they surface for human review", () => {
    expect(samePerson("Michael Morris", "Mike Morris")).toBe(false);
    expect(samePerson("Jim  Remley", "jim remley")).toBe(true);
  });

  it("recognises source-data placeholders as missing", () => {
    expect(isPlaceholder("Not found")).toBe(true);
    expect(isPlaceholder("N/A")).toBe(true);
    expect(isPlaceholder("Andrew Misk")).toBe(false);
  });

  it("strips generic words when normalizing org names", () => {
    expect(normalizeOrgName("The Real Brokerage Inc.")).toBe("real");
  });
});

describe("extractVisibleText", () => {
  it("drops scripts, styles and tags", () => {
    const html = "<html><style>a{color:red}</style><script>var x='Windermere'</script><p>The Agency Portland</p></html>";
    const text = extractVisibleText(html);
    expect(text).toContain("The Agency Portland");
    expect(text).not.toContain("Windermere");
    expect(text).not.toContain("color:red");
  });
});

describe("looksBlocked", () => {
  it("treats 403 and 429 as blocked regardless of body", () => {
    expect(looksBlocked(403, "<p>hello</p>")).toBe(true);
    expect(looksBlocked(429, "")).toBe(true);
  });

  it("flags a short anti-bot interstitial", () => {
    expect(looksBlocked(200, "<html><body><h1>Pardon Our Interruption</h1></body></html>")).toBe(true);
  });

  it("does not flag a real site that merely embeds reCAPTCHA strings in scripts", () => {
    // Regression: leachitwood.com serves full content but its JS bundle contains
    // localisation keys like {"captcha":"Captcha"}. That must not read as blocked.
    const html =
      `<html><head><script>var i18n={"captcha":"Captcha","wrong_captcha":"You entered the wrong number in captcha."}</script></head>` +
      `<body><p>Lea Chitwood Real Estate | RE/MAX PowerPros. ${"Listings and homes for sale in Columbia County. ".repeat(120)}</p></body></html>`;
    expect(looksBlocked(200, html)).toBe(false);
  });

  it("does not flag a long page that happens to mention access denied in copy", () => {
    const html = `<html><body><p>${"Neighborhood guide content. ".repeat(200)} access denied</p></body></html>`;
    expect(looksBlocked(200, html)).toBe(false);
  });
});

describe("org phrase matching", () => {
  it("requires whole-word matches", () => {
    // Regression: "The Real Brokerage Inc." normalizes to "real", which previously
    // matched inside the word "really" in a testimonial and produced a false change.
    expect(containsOrgPhrase("she really listened to me", "real")).toBe(false);
    expect(containsOrgPhrase("agents at real up north", "real")).toBe(true);
  });

  it("matches brands whose page spelling closes up the spacing", () => {
    // Regression: page says "REMAX PowerPros", record says "RE/MAX Power Pros".
    expect(containsOrgPhrase("lea chitwood columbia county remax powerpros", "remax power pros")).toBe(true);
  });

  it("rejects single generic words as brokerage evidence", () => {
    expect(isDistinctiveOrgName("real")).toBe(false);
    expect(isDistinctiveOrgName("homes")).toBe(false);
    expect(isDistinctiveOrgName("windermere")).toBe(true);
    expect(isDistinctiveOrgName("remax power pros")).toBe(true);
  });
});

describe("detectPrincipalBroker", () => {
  it("confirms when the recorded broker appears on the page", () => {
    const result = detectPrincipalBroker("Our team is led by Andrew Misk in Portland.", "Andrew Misk");
    expect(result.status).toBe("confirmed");
  });

  it("flags a different labelled principal broker", () => {
    const result = detectPrincipalBroker("Sarah Whitfield, Principal Broker", "Andrew Misk");
    expect(result.status).toBe("different");
    expect(result.foundName).toBe("Sarah Whitfield");
  });

  it("reports absent when no labelled broker is present", () => {
    const result = detectPrincipalBroker("Just a list of listings and prices.", "Andrew Misk");
    expect(result.status).toBe("absent");
    expect(result.foundName).toBeNull();
  });

  it("does not treat a random capitalised name as the principal broker", () => {
    const result = detectPrincipalBroker("Listing shown by Jordan Baker, Buyer's Agent", "Andrew Misk");
    expect(result.status).toBe("absent");
  });
});

describe("pickCheckUrl", () => {
  it("prefers the personal website over Zillow", () => {
    expect(pickCheckUrl(agent()).kind).toBe("website");
  });

  it("falls back to Zillow when no website exists", () => {
    expect(pickCheckUrl(agent({ websiteBioUrl: null })).kind).toBe("zillow");
  });

  it("returns null when neither URL is usable", () => {
    expect(pickCheckUrl(agent({ websiteBioUrl: null, zillowUrl: null })).url).toBeNull();
  });
});

describe("checkAgent", () => {
  it("confirms when the recorded brokerage is on the page", async () => {
    const result = await checkAgent(agent(), {
      fetchImpl: async () => page({ text: "<p>The Agency Portland — Dirk Hmura</p>" }),
    });
    expect(result.outcome).toBe("confirmed");
    expect(result.proposedBrokerage).toBeUndefined();
  });

  it("reports blocked pages as unverified rather than confirmed", async () => {
    const result = await checkAgent(agent(), {
      fetchImpl: async () => page({ ok: false, status: 403, blocked: true, text: "Access Denied" }),
    });
    expect(result.outcome).toBe("unverified");
    expect(result.unverifiedReason).toBe("blocked");
  });

  it("reports a dead page as not_found without inventing a destination", async () => {
    const result = await checkAgent(agent(), {
      fetchImpl: async () => page({ ok: false, status: 404 }),
    });
    expect(result.outcome).toBe("unverified");
    expect(result.unverifiedReason).toBe("not_found");
    expect(result.proposedBrokerage).toBeUndefined();
  });

  it("proposes a single recognised alternative brokerage", async () => {
    const result = await checkAgent(agent(), {
      knownBrokerages: ["Windermere Realty Trust", "Redfin"],
      fetchImpl: async () => page({ text: "<p>Dirk Hmura, Windermere Realty Trust</p>" }),
    });
    expect(result.outcome).toBe("changed");
    expect(result.proposedBrokerage).toBe("Windermere Realty Trust");
  });

  it("refuses to guess when several brokerages appear", async () => {
    const result = await checkAgent(agent(), {
      knownBrokerages: ["Windermere Realty Trust", "Redfin"],
      fetchImpl: async () => page({ text: "<p>Windermere Realty Trust and Redfin</p>" }),
    });
    expect(result.outcome).toBe("unverified");
    expect(result.proposedBrokerage).toBeUndefined();
  });

  it("flags a principal broker change even when the brokerage still matches", async () => {
    const result = await checkAgent(agent(), {
      fetchImpl: async () =>
        page({ text: "<p>The Agency Portland</p><p>Sarah Whitfield, Principal Broker</p>" }),
    });
    expect(result.outcome).toBe("changed");
    expect(result.proposedPrincipalBroker).toBe("Sarah Whitfield");
    expect(result.proposedBrokerage).toBeUndefined();
  });

  it("marks agents with no checkable URL as no_source", async () => {
    const result = await checkAgent(agent({ websiteBioUrl: null, zillowUrl: null }));
    expect(result.outcome).toBe("unverified");
    expect(result.unverifiedReason).toBe("no_source");
  });

  it("treats network failures as fetch_error", async () => {
    const result = await checkAgent(agent(), {
      fetchImpl: async () => page({ ok: false, status: 0, error: "timeout" }),
    });
    expect(result.unverifiedReason).toBe("fetch_error");
  });
});

describe("recomputeRanks", () => {
  it("ranks by total sides descending", () => {
    const ranks = recomputeRanks([
      { id: 1, realtrendsTotalSides: 50 },
      { id: 2, realtrendsTotalSides: 102 },
      { id: 3, realtrendsTotalSides: 97 },
    ]);
    expect(ranks.get(2)).toBe(1);
    expect(ranks.get(3)).toBe(2);
    expect(ranks.get(1)).toBe(3);
  });

  it("shares a rank for ties and skips the next rank", () => {
    const ranks = recomputeRanks([
      { id: 1, realtrendsTotalSides: 61 },
      { id: 2, realtrendsTotalSides: 61 },
      { id: 3, realtrendsTotalSides: 40 },
    ]);
    expect(ranks.get(1)).toBe(1);
    expect(ranks.get(2)).toBe(1);
    expect(ranks.get(3)).toBe(3);
  });

  it("sorts agents with no sides data to the bottom", () => {
    const ranks = recomputeRanks([
      { id: 1, realtrendsTotalSides: null },
      { id: 2, realtrendsTotalSides: 10 },
    ]);
    expect(ranks.get(2)).toBe(1);
    expect(ranks.get(1)).toBe(2);
  });
});

describe("buildAgentUpdate", () => {
  it("maps only present proposals onto agent columns", () => {
    const update = buildAgentUpdate({
      proposedBrokerage: "Windermere Realty Trust",
      proposedPrincipalBroker: null,
      proposedTotalSides: 88,
    });
    expect(update).toEqual({ brokerage: "Windermere Realty Trust", realtrendsTotalSides: 88 });
  });

  it("returns an empty object when nothing was proposed", () => {
    expect(buildAgentUpdate({})).toEqual({});
  });
})
