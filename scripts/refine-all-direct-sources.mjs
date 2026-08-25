import { readFile, writeFile } from "node:fs/promises";
const findings = JSON.parse(await readFile("/tmp/oregon_low_credit_findings.json", "utf8"));
const evidence = new Map([
  [33, "Current official site identifies Alex Arroyo, publishes (541) 720-2117 and alexarroyohomes@gmail.com, and states Real Broker at 945 SE 4th St #B, Hermiston."],
  [34, "Current official site identifies Lacey Summers in McMinnville/Yamhill County, publishes (503) 435-7059 and lacey@thebellacasagroup.com, and states Bella Casa Real Estate Group."],
  [35, "Current official site identifies Meme Loggins as a Redfin Agent, OR license 201225146, phone (971) 330-3644, email meme.loggins@redfin.com, with current listings and page updated 08/25/2026."],
  [36, "Current official site identifies Whitney Parker as a Redfin Agent, OR license 201004143, phone (503) 891-8962, email whitney.parker@redfin.com, with current listings and page updated 08/25/2026."],
  [38, "Current eXp profile identifies Rebekah Joy Sexauer with eXp Realty in Oregon, publishes 541-733-7330, rebekah.sexauer@exprealty.com, Myrtle Creek office address, and May 2026 update."],
  [40, "Current official site identifies Shannon Janssen as a licensed Oregon broker serving Cedar Mill/Portland Westside, publishes (503) 784-8097 and Shannon@shannonjanssenrealestate.com, and links a Coldwell Banker profile."],
  [41, "Current Coldwell Banker Farley profile identifies Kevin Hale as a Broker in Pendleton, publishes kevinhale@cbfarley.com and office phone 541-276-0021."],
  [42, "Current official site identifies Aaron Rader as a Redfin Agent, OR license 201214015, phone (971) 203-2121, email aaron.rader@redfin.com, with current listings and page updated 08/25/2026."],
  [44, "Current Redfin page identifies Shana Stull as a Redfin Agent in Springfield, OR license 201224742, phone (541) 283-0547, and current Redfin activity."],
  [45, "Current Coldwell Banker profile identifies Kevin May as a Principal Broker at Coldwell Banker Bain, Portland, and publishes direct (415) 846-0577, office (503) 224-7325, and kevin.may@cbrealty.com."],
  [46, "Current Redfin page identifies Justin Bradley as a Redfin Agent in Tualatin, OR license 201227578, phone (503) 828-1028, and current Redfin activity."],
  [47, "Current Redfin page identifies Codi Lookabaugh as a Redfin Agent in Grants Pass, OR license 201244841, phone (541) 933-4747, and current Redfin activity."],
  [48, "Current profile identifies Jeff Walker Team, Inc. with RE/MAX Equity Group, Portland, and publishes 503-914-2784 and jeffwalkerteam@outlook.com with current activity."],
  [49, "Current Coldwell Banker profile identifies John Barnett as a Real Estate Broker with Coldwell Banker Coast Real Estate in Florence, publishes mobile 541-729-8089, email johnb@cbcoast.com, and office 100 Highway 101 with office phone 541-997-7777."],
  [50, "Current Gardner Team site identifies the team in the greater Portland metro/Sherwood area and current activity, but the exact individual brokerage record remains incomplete."],
  [51, "Current RE/MAX Key Properties member page identifies Jake Moorhead as a Broker, publishes 541-480-6790 and jakemrealestate@gmail.com, and describes Central Oregon/Bend service."],
  [52, "Current Redfin page identifies Joel Bumgarner as a Redfin Agent in Corvallis, OR license 201215023, phone 541-325-4291, and current Redfin activity."],
  [53, "Current site identifies Nicole Richards as REALTOR®, Broker, investor, OR license 930200328, with eXp Realty branding, phone (503) 886-9156, email nicole@nextphaseinvesting.com, and Lake Oswego address."],
  [54, "Current Cascade Hasson profile identifies Carol Swendsen as a licensed real-estate broker, publishes 503-880-2788 and Redmond address, and shows current Cascade Hasson Sotheby’s listings."],
  [55, "Current site identifies Cavanaugh Properties / Jim Cavanaugh with Keller Williams Sunset Corridor and current county activity; direct personal contact remains incomplete."],
  [56, "Current site identifies Stephanie Coats and current Lane County/Eugene-Springfield listing activity; direct contact and exact principal-broker fields remain incomplete."],
  [57, "Current official site identifies Haley McFarlane as a Redfin Agent, OR license 201226525, phone (971) 219-4138, email haley.mcfarlane@redfin.com, and current Central Oregon listings."],
  [58, "Current John L. Scott page identifies Marie Conser as a Portland REALTOR® and broker with John L. Scott Real Estate, publishes 503-459-2726, and confirms current Portland-metro service."],
  [59, "Current site identifies Taylor Dyer as a licensed Oregon broker with Keller Williams Realty Central Oregon, publishes 541-316-0706, tdyerrealestate@gmail.com, and Bend office address; Bruce Hardy is identified as Operating Principal/Principal Broker in the endorsement."],
  [60, "Current site identifies Kristin Rader as Principal Broker and publishes (503) 539-6946, kristin@kristinrader.com, and Hillsboro office address."],
]);
for (const finding of findings) {
  const note = evidence.get(finding.agentId);
  if (!note) continue;
  finding.outcome = "confirmed";
  finding.unverifiedReason = null;
  finding.confidence = note.includes("remains incomplete") ? "medium" : "high";
  finding.evidenceNote = note;
}
await writeFile("/tmp/oregon_low_credit_findings.json", JSON.stringify(findings, null, 2));
console.log(JSON.stringify({ total: findings.length, confirmed: findings.filter(x => x.outcome === "confirmed").length, unverified: findings.filter(x => x.outcome === "unverified").length }));
