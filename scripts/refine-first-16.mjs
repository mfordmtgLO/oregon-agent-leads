import { readFile, writeFile } from "node:fs/promises";
const findings = JSON.parse(await readFile("/tmp/oregon_low_credit_findings.json", "utf8"));
const evidence = new Map([
  [2, ["confirmed", "Official RE/MAX PowerPros site identifies Lea Chitwood and the Scappoose office, and publishes the office phone 503-543-8216."]],
  [3, ["confirmed", "Current Coldwell Banker profile identifies Hannah Katz at Coldwell Banker Professional Group and publishes direct, office, and email contact details."]],
  [4, ["confirmed", "Current Keller Williams profile identifies Stacie Rudolfs with Keller Williams Realty Southern Oregon and Coos Bay/Medford information; the shorter brokerage wording is treated as a naming variant."]],
  [5, ["confirmed", "Current official site identifies Keith Petersen as a Sunriver and Central Oregon real estate broker and publishes his current phone and email."]],
  [7, ["confirmed", "Current HomeSmart profile identifies Ilya Makarenko as a HomeSmart agent at HomeSmart Realty Group Salem and publishes current phone, email, and office address."]],
  [9, ["confirmed", "Current personal site identifies Chaley McVay as a Redfin agent, publishes her Oregon license, phone, email, and current Redfin listings."]],
  [11, ["confirmed", "Current agent profile identifies Tracy Hunter with eXp Realty in Oregon and states Columbia Basin Group is brokered by eXp Realty LLC at the Hermiston office."]],
  [12, ["confirmed", "Current Gellatly Properties site identifies Kimberly Gellatly with Berkshire Hathaway NW Real Estate and Lake Oswego area coverage."]],
  [15, ["confirmed", "Current personal site identifies Molly Edwards Real Estate with HomeSmart Realty Group."]],
  [16, ["confirmed", "Current ERA directory identifies Joseph Robb as a salesperson with Knipe Realty ERA Powered in Eugene and publishes agent and office contact details."]],
]);
for (const finding of findings) {
  const item = evidence.get(finding.agentId);
  if (!item) continue;
  finding.outcome = item[0];
  finding.unverifiedReason = null;
  finding.confidence = "high";
  finding.evidenceNote = item[1];
}
await writeFile("/tmp/oregon_low_credit_findings.json", JSON.stringify(findings, null, 2));
console.log(JSON.stringify({ total: findings.length, confirmed: findings.filter(x => x.outcome === "confirmed").length, unverified: findings.filter(x => x.outcome === "unverified").length }));
