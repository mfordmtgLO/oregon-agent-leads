import { readFile, writeFile } from "node:fs/promises";

const agents = JSON.parse(await readFile("/tmp/oregon_agents_current.json", "utf8"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const normalize = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const results = [];
for (const agent of agents) {
  const url = agent.websiteBioUrl;
  const result = { ...agent, sourceStatus: "no_source", sourceTitle: null, sourceExcerpt: null, sourceUrl: url };
  if (!url) {
    results.push(result);
    continue;
  }
  try {
    const response = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; OregonAgentLeads/1.0)" }, signal: AbortSignal.timeout(15000) });
    const html = await response.text();
    const text = clean(html);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
    const nameOk = normalize(text).includes(normalize(agent.fullName));
    const brokerageOk = normalize(text).includes(normalize(agent.brokerage)) || normalize(text).includes(normalize(agent.brokerage).replace("realtygroup", ""));
    result.sourceStatus = response.ok && text.length > 100 ? (nameOk || brokerageOk ? "supports_record" : "retrieved_no_match") : `http_${response.status}`;
    result.sourceTitle = title;
    result.sourceExcerpt = text.slice(0, 900);
    result.finalUrl = response.url;
    result.httpStatus = response.status;
  } catch (error) {
    result.sourceStatus = error?.name === "TimeoutError" ? "timeout" : "fetch_error";
    result.sourceExcerpt = String(error?.message ?? error);
  }
  results.push(result);
  await sleep(250);
  process.stderr.write(`${agent.id}\t${agent.fullName}\t${result.sourceStatus}\n`);
}
await writeFile("/tmp/oregon_source_checks.json", JSON.stringify(results, null, 2));
const counts = Object.groupBy(results, (x) => x.sourceStatus);
console.log(Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value.length])));
