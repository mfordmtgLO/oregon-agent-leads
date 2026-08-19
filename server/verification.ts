/**
 * Agent verification engine.
 *
 * Purpose: check whether each agent on record still works at the brokerage/office
 * we have stored, and surface differences for Mike to approve or reject. Nothing is
 * ever applied to an agent record automatically.
 *
 * Honest limitations (documented deliberately, surfaced in the UI):
 *  - Zillow, Redfin and many brokerage sites block automated fetches. Those checks
 *    return outcome="unverified" with reason "blocked", NOT a false "confirmed".
 *  - A dead profile page proves the page is gone, not where the agent went. That is
 *    reported as "not_found" so it can be escalated to a research pass.
 *  - Ranks are never researched. RealTrends 2026 figures stay as supplied; rank is
 *    only recomputed when production numbers themselves change on approval.
 */

import type { Agent } from "../drizzle/schema";

export type VerificationOutcome = "confirmed" | "changed" | "unverified";
export type UnverifiedReason = "blocked" | "not_found" | "no_source" | "fetch_error";

export interface ProposedChanges {
  proposedBrokerage?: string | null;
  proposedPrincipalBroker?: string | null;
  proposedPrincipalBrokerPhone?: string | null;
  proposedPrincipalBrokerEmail?: string | null;
  proposedPrincipalBrokerHeadshotUrl?: string | null;
  proposedCityArea?: string | null;
  proposedPhone?: string | null;
  proposedEmail?: string | null;
  proposedWebsiteBioUrl?: string | null;
  proposedZillowUrl?: string | null;
  proposedTotalSides?: number | null;
  proposedVolumeNum?: number | null;
  proposedVolume?: string | null;
}

export interface AgentCheckResult extends ProposedChanges {
  agentId: number;
  agentName: string;
  outcome: VerificationOutcome;
  recordedBrokerage: string | null;
  recordedPrincipalBroker: string | null;
  recordedCityArea: string | null;
  evidenceNote: string | null;
  evidenceUrl: string | null;
  unverifiedReason: UnverifiedReason | null;
  confidence: string | null;
}

/**
 * Look for evidence about the office's principal / managing broker in page text.
 *
 * Deliberately conservative: it only reports a *different* named broker when the
 * name sits next to an explicit principal/managing-broker label. Brokerage pages
 * list dozens of agent names, so anything looser produces false positives.
 */
export function detectPrincipalBroker(
  visibleText: string,
  recordedBroker: string | null,
): { status: "confirmed" | "different" | "absent"; foundName: string | null } {
  if (!visibleText) return { status: "absent", foundName: null };

  if (recordedBroker && !isPlaceholder(recordedBroker)) {
    // Their name appearing anywhere on the office's own page is good enough to confirm.
    const escaped = recordedBroker.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    if (new RegExp(escaped, "i").test(visibleText)) {
      return { status: "confirmed", foundName: recordedBroker };
    }
  }

  // "Jane Doe, Principal Broker" / "Principal Broker: Jane Doe" / "managing principal broker".
  const labelled = [
    // Name first: "Jane Doe, Principal Broker". The name must stay Capitalized, so the
    // character classes are explicit rather than relying on the /i flag.
    // Only the two words immediately before the label are captured, so a preceding
    // city or brokerage word cannot be swallowed into the name.
    /([A-Z][a-zA-Z'’-]+\s+[A-Z][a-zA-Z'’-]+)\s*[,–—-]\s*(?:[Mm]anaging\s+)?[Pp]rincipal\s+[Bb]roker/,
    // Label first: "Principal Broker: Jane Doe".
    /(?:managing\s+)?principal\s+broker\s*[:–—-]\s*([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+){1,2})/i,
  ];
  for (const pattern of labelled) {
    const match = visibleText.match(pattern);
    const name = match?.[1]?.trim();
    if (name) {
      if (samePerson(name, recordedBroker)) return { status: "confirmed", foundName: name };
      return { status: "different", foundName: name };
    }
  }

  return { status: "absent", foundName: null };
}

/** Strip punctuation/suffixes so "RE/MAX Power Pros, LLC" ≈ "REMAX Power Pros". */
export function normalizeOrgName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    // Brand spellings that differ only by an internal separator: "RE/MAX" vs "REMAX".
    // Collapsed before punctuation becomes whitespace so both sides normalize alike.
    .replace(/re\s*\/\s*max/g, "remax")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(
      /\b(llc|inc|incorporated|corp|corporation|co|company|ltd|pc|pllc|group|realty|real estate|properties|brokerage|the)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize a person's name for comparison: "Michael Morris" ≈ "Mike  Morris" is NOT equal (deliberately). */
export function normalizePersonName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the two org names refer to the same brokerage as far as we can tell. */
export function sameOrg(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeOrgName(a);
  const nb = normalizeOrgName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Treat containment as a match: "john l scott medford" vs "john l scott".
  return na.includes(nb) || nb.includes(na);
}

/**
 * Whole-word containment test. Prevents "real" (what "The Real Brokerage Inc."
 * reduces to after stopword stripping) from matching inside the word "really".
 */
export function containsOrgPhrase(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(haystack)) return true;
  // Sites often close up brand spacing ("RE/MAX PowerPros" vs "RE/MAX Power Pros"),
  // so retry with all whitespace removed on both sides. Only done for multi-word
  // needles, where the despaced form is still distinctive enough to be safe.
  if (needle.includes(" ")) {
    const despacedNeedle = needle.replace(/\s+/g, "");
    if (despacedNeedle.length >= 8 && haystack.replace(/\s+/g, "").includes(despacedNeedle)) {
      return true;
    }
  }
  return false;
}

/**
 * A normalized brokerage name is only usable as page-matching evidence when enough
 * distinctive text survives stopword stripping. "The Real Brokerage Inc." collapses
 * to the single common word "real", which matches far too much prose to be evidence.
 */
export function isDistinctiveOrgName(normalized: string): boolean {
  if (!normalized) return false;
  const words = normalized.split(" ").filter(Boolean);
  if (words.length >= 2) return true;
  // Single-word brands are only trusted when reasonably long and not generic.
  const GENERIC = new Set([
    "real",
    "homes",
    "home",
    "estate",
    "premier",
    "premiere",
    "select",
    "pros",
    "partners",
    "advantage",
  ]);
  return words[0].length >= 6 && !GENERIC.has(words[0]);
}

export function samePerson(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePersonName(a);
  const nb = normalizePersonName(b);
  if (!na || !nb) return false;
  return na === nb;
}

/** Placeholder strings that came in with the source data and mean "missing". */
export function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) return true;
  return /^(not\s+found|n\/?a|unknown|none|-|—)$/i.test(value.trim());
}

export interface FetchedPage {
  ok: boolean;
  status: number;
  text: string;
  /** Set when the response looks like an anti-bot wall rather than real content. */
  blocked: boolean;
  error?: string;
}

const BLOCK_SIGNALS = [
  "captcha",
  "are you a human",
  "access denied",
  "unusual traffic",
  "request unsuccessful",
  "verify you are a human",
  "pardon our interruption",
  "cf-browser-verification",
  "attention required",
];

/**
 * Decide whether a 200 response is actually an anti-bot wall.
 *
 * Signals are matched against *visible* text only, and the page must also be short.
 * Real agent sites embed reCAPTCHA scripts and localisation strings containing the
 * word "captcha" while serving perfectly good content — matching raw HTML flagged
 * legitimate pages (leachitwood.com, judehodgebroker.com) as blocked.
 */
export function looksBlocked(status: number, html: string): boolean {
  if (status === 403 || status === 429) return true;
  const visible = extractVisibleText(html).toLowerCase();
  // A genuine block page is short; a full site that merely mentions a captcha is not.
  if (visible.length > 4_000) return false;
  return BLOCK_SIGNALS.some(signal => visible.includes(signal));
}

/**
 * Fetch one page with a short timeout and a browser-like UA. Never throws:
 * failures come back as ok=false so a single bad page cannot abort a sweep.
 */
export async function fetchPage(url: string, timeoutMs = 12_000): Promise<FetchedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const text = (await res.text()).slice(0, 400_000);
    const blocked = looksBlocked(res.status, text);
    return { ok: res.ok && !blocked, status: res.status, text, blocked };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: 0, text: "", blocked: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/** Remove tags/scripts so brokerage-name matching runs against visible text only. */
export function extractVisibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Decide which URL to check for an agent. Personal/brokerage sites are far more
 * fetchable than Zillow, so they are preferred.
 */
export function pickCheckUrl(agent: Agent): { url: string | null; kind: "website" | "zillow" | null } {
  if (agent.websiteBioUrl && /^https?:\/\//i.test(agent.websiteBioUrl)) {
    return { url: agent.websiteBioUrl, kind: "website" };
  }
  if (agent.zillowUrl && /^https?:\/\//i.test(agent.zillowUrl)) {
    return { url: agent.zillowUrl, kind: "zillow" };
  }
  return { url: null, kind: null };
}

/**
 * Check a single agent by fetching their profile page and looking for the
 * brokerage we have on record in the visible text.
 *
 * This intentionally only ever produces three verdicts:
 *  - confirmed: the recorded brokerage name appears on their own page
 *  - changed:   the page is live, the recorded brokerage is absent, and a different
 *               known brokerage name is present (a concrete alternative to propose)
 *  - unverified: anything else — blocked, dead, or ambiguous
 */
export async function checkAgent(
  agent: Agent,
  options: { knownBrokerages?: string[]; fetchImpl?: typeof fetchPage } = {},
): Promise<AgentCheckResult> {
  const doFetch = options.fetchImpl ?? fetchPage;
  const base = {
    agentId: agent.id,
    agentName: agent.fullName,
    recordedBrokerage: agent.brokerage ?? null,
    recordedPrincipalBroker: isPlaceholder(agent.principalBrokerName)
      ? null
      : agent.principalBrokerName ?? null,
    recordedCityArea: agent.cityArea ?? null,
  };

  const { url, kind } = pickCheckUrl(agent);
  if (!url) {
    return {
      ...base,
      outcome: "unverified",
      evidenceNote:
        "No website or Zillow URL on record for this agent, so there is nothing to check automatically. Needs a research pass.",
      evidenceUrl: null,
      unverifiedReason: "no_source",
      confidence: null,
    };
  }

  const page = await doFetch(url);

  if (page.blocked) {
    return {
      ...base,
      outcome: "unverified",
      evidenceNote: `The ${kind === "zillow" ? "Zillow" : "brokerage"} page blocked the automated check (HTTP ${page.status}). This is expected for Zillow/Redfin and does not mean anything changed. Needs a research pass.`,
      evidenceUrl: url,
      unverifiedReason: "blocked",
      confidence: null,
    };
  }

  if (!page.ok && page.status === 0) {
    return {
      ...base,
      outcome: "unverified",
      evidenceNote: `Could not reach the page (${page.error ?? "network error"}). Needs a research pass.`,
      evidenceUrl: url,
      unverifiedReason: "fetch_error",
      confidence: null,
    };
  }

  if (page.status === 404 || page.status === 410) {
    return {
      ...base,
      outcome: "unverified",
      evidenceNote: `Their profile page returns HTTP ${page.status} (gone). That is a strong hint they moved, but the page does not say where. Needs a research pass to find the new brokerage.`,
      evidenceUrl: url,
      unverifiedReason: "not_found",
      confidence: "medium",
    };
  }

  if (!page.ok) {
    return {
      ...base,
      outcome: "unverified",
      evidenceNote: `Page responded with HTTP ${page.status}, which is not usable for verification. Needs a research pass.`,
      evidenceUrl: url,
      unverifiedReason: "fetch_error",
      confidence: null,
    };
  }

  const visible = extractVisibleText(page.text);
  const haystack = normalizeOrgName(visible);
  const recorded = normalizeOrgName(agent.brokerage);
  const brokerCheck = detectPrincipalBroker(visible, base.recordedPrincipalBroker);

  if (recorded && containsOrgPhrase(haystack, recorded)) {
    // Brokerage matches. The principal broker may still have changed.
    if (brokerCheck.status === "different" && brokerCheck.foundName) {
      return {
        ...base,
        outcome: "changed",
        proposedPrincipalBroker: brokerCheck.foundName,
        evidenceNote: `"${agent.brokerage}" is still their brokerage, but the page lists "${brokerCheck.foundName}" as principal broker instead of "${base.recordedPrincipalBroker ?? "(none on record)"}". Verify before approving.`,
        evidenceUrl: url,
        unverifiedReason: null,
        confidence: "medium",
      };
    }
    const brokerNote =
      brokerCheck.status === "confirmed"
        ? ` Principal broker "${base.recordedPrincipalBroker}" also appears on the page.`
        : base.recordedPrincipalBroker
          ? ` The page does not mention principal broker "${base.recordedPrincipalBroker}", which is common on agent bio pages and is not treated as a change.`
          : "";
    return {
      ...base,
      outcome: "confirmed",
      evidenceNote: `"${agent.brokerage}" still appears on their profile page, so the brokerage on record looks current.${brokerNote}`,
      evidenceUrl: url,
      unverifiedReason: null,
      confidence: brokerCheck.status === "confirmed" ? "high" : "medium",
    };
  }

  // Recorded brokerage absent. Look for a different brokerage we know about.
  const candidates = (options.knownBrokerages ?? []).filter(name => {
    const n = normalizeOrgName(name);
    return isDistinctiveOrgName(n) && n !== recorded && containsOrgPhrase(haystack, n);
  });

  if (candidates.length === 1) {
    return {
      ...base,
      outcome: "changed",
      proposedBrokerage: candidates[0],
      ...(brokerCheck.status === "different" && brokerCheck.foundName
        ? { proposedPrincipalBroker: brokerCheck.foundName }
        : {}),
      evidenceNote:
        `"${agent.brokerage}" no longer appears on their profile page, but "${candidates[0]}" does.` +
        (brokerCheck.status === "different" && brokerCheck.foundName
          ? ` The page also lists "${brokerCheck.foundName}" as principal broker.`
          : "") +
        " Verify before approving — pages sometimes mention other brokerages for unrelated reasons.",
      evidenceUrl: url,
      unverifiedReason: null,
      confidence: "medium",
    };
  }

  return {
    ...base,
    outcome: "unverified",
    evidenceNote: candidates.length > 1
      ? `The page is live but mentions several brokerages (${candidates.slice(0, 3).join(", ")}), so no single change can be proposed automatically. Needs a research pass.`
      : `The page is live but "${agent.brokerage ?? "the recorded brokerage"}" is not visible in its text, and no alternative brokerage was recognised. Needs a research pass.`,
    evidenceUrl: url,
    unverifiedReason: "not_found",
    confidence: null,
  };
}

/**
 * Recompute RealTrends ranks from production figures.
 *
 * Policy (confirmed with Mike): ranks are NOT researched. They stay as the supplied
 * RealTrends 2026 figures and are only recalculated here when a production number
 * itself changes, so the ordering stays consistent with the underlying sides data.
 * Ties share a rank, and the next rank skips accordingly (1,1,3 — competition style).
 */
export function recomputeRanks(
  rows: { id: number; realtrendsTotalSides: number | null }[],
): Map<number, number> {
  const sorted = [...rows].sort(
    (a, b) => (b.realtrendsTotalSides ?? -Infinity) - (a.realtrendsTotalSides ?? -Infinity),
  );
  const result = new Map<number, number>();
  let lastSides: number | null | undefined;
  let lastRank = 0;
  sorted.forEach((row, index) => {
    const sides = row.realtrendsTotalSides;
    if (sides !== null && sides === lastSides) {
      result.set(row.id, lastRank);
      return;
    }
    const rank = index + 1;
    result.set(row.id, rank);
    lastRank = rank;
    lastSides = sides;
  });
  return result;
}

/** Fields on an agent record that an approved finding may write. */
export function buildAgentUpdate(finding: ProposedChanges): Record<string, unknown> {
  const map: [keyof ProposedChanges, string][] = [
    ["proposedBrokerage", "brokerage"],
    ["proposedPrincipalBroker", "principalBrokerName"],
    ["proposedPrincipalBrokerPhone", "principalBrokerPhone"],
    ["proposedPrincipalBrokerEmail", "principalBrokerEmail"],
    ["proposedPrincipalBrokerHeadshotUrl", "principalBrokerHeadshotUrl"],
    ["proposedCityArea", "cityArea"],
    ["proposedPhone", "phone"],
    ["proposedEmail", "email"],
    ["proposedWebsiteBioUrl", "websiteBioUrl"],
    ["proposedZillowUrl", "zillowUrl"],
    ["proposedTotalSides", "realtrendsTotalSides"],
    ["proposedVolumeNum", "realtrendsVolumeNum"],
    ["proposedVolume", "realtrendsVolume"],
  ];
  const update: Record<string, unknown> = {};
  for (const [from, to] of map) {
    const value = finding[from];
    if (value !== null && value !== undefined && value !== "") {
      update[to] = value;
    }
  }
  return update;
}
