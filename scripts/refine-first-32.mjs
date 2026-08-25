import { readFile, writeFile } from "node:fs/promises";
const findings = JSON.parse(await readFile("/tmp/oregon_low_credit_findings.json", "utf8"));
const evidence = new Map([
  [17, "Current Coldwell Banker profile lists Tim Kaelin as a Real Estate Broker at Coldwell Banker Professional Group, Newberg, and explicitly names Lucinda Hage as Principal Broker."],
  [18, "Current site lists Marie Boatsman as a Real Estate Broker with Berkshire Hathaway HomeServices Northwest Real Estate at the Lake Oswego office."],
  [20, "Current Redfin agent page lists Barb Norris as a Redfin Agent in Salem, license 201204698, with current Redfin activity."],
  [21, "RE/MAX Ultimate Coastal Properties profile labels Karen Kennedy Broker Owner and describes Gold Beach/Brookings service."],
  [22, "Current team page identifies Brittani Albrecht as a licensed Realtor with HomeSmart Realty Group and names Wendi Melcher as Principal Broker at the Sweet Home office."],
  [23, "Current Parsagian Group site identifies Mary Parsagian as a Real Estate Broker in Grants Pass and publishes current office contact details."],
  [24, "Current RE/MAX profile lists Darlene Van Auken as an associate with RE/MAX Coastal Advantage at 219 North Hemlock, Cannon Beach."],
  [25, "Current official site lists Mike Wiltshire as a Real Estate Broker with Berkshire Hathaway HomeServices Northwest Real Estate at the Newberg office."],
  [26, "Current Redfin page lists Gus Sanchez as a Redfin Agent in Portland, license 201218632, with current Redfin activity."],
  [28, "Current RE/MAX Integrity profile identifies a licensed real-estate broker in Roseburg and displays current Roseburg listings."],
  [32, "Current KamaHomes page identifies Mathew Wray as Principal / Designated Broker and identifies KamaHomes with Keller Williams Realty Portland Premier."],
]);
for (const finding of findings) {
  const note = evidence.get(finding.agentId);
  if (!note) continue;
  finding.outcome = "confirmed";
  finding.unverifiedReason = null;
  finding.confidence = "high";
  finding.evidenceNote = note;
}
await writeFile("/tmp/oregon_low_credit_findings.json", JSON.stringify(findings, null, 2));
console.log(JSON.stringify({ total: findings.length, confirmed: findings.filter(x => x.outcome === "confirmed").length, unverified: findings.filter(x => x.outcome === "unverified").length }));
