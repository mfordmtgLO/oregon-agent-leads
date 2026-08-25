import { readFile, writeFile } from "node:fs/promises";

const checked = JSON.parse(await readFile("/tmp/oregon_source_checks.json", "utf8"));
const findings = checked.map((agent) => {
  const status = agent.sourceStatus;
  const reason = status === "http_403" || status === "blocked" ? "blocked" : status === "http_410" ? "not_found" : status === "fetch_error" || status === "timeout" ? "fetch_error" : "no_source";
  const note = status === "supports_record"
    ? `Low-credit sequential check fetched the roster's existing profile URL and found the agent name or brokerage, but did not independently verify the current principal/managing broker; no field changes proposed. Source title: ${agent.sourceTitle ?? "unavailable"}.`
    : `Low-credit sequential check could not establish a complete current brokerage and principal-broker record from the roster's existing profile URL (status: ${status}); no field changes proposed.`;
  return {
    agentId: agent.id,
    agentName: agent.fullName,
    outcome: "unverified",
    brokerage: null,
    principalBrokerName: null,
    principalBrokerPhone: null,
    principalBrokerEmail: null,
    principalBrokerHeadshotUrl: null,
    cityArea: null,
    phone: null,
    email: null,
    websiteBioUrl: null,
    zillowUrl: null,
    totalSides: null,
    volume: null,
    evidenceNote: note,
    evidenceUrl: agent.finalUrl ?? agent.sourceUrl ?? null,
    confidence: status === "supports_record" ? "low" : null,
    unverifiedReason: reason,
  };
});
await writeFile("/tmp/oregon_low_credit_findings.json", JSON.stringify(findings, null, 2));
const grouped = Object.groupBy(checked, (x) => x.sourceStatus);
console.log(JSON.stringify({ findings: findings.length, sourceStatuses: Object.fromEntries(Object.entries(grouped).map(([k, v]) => [k, v.length])) }));
