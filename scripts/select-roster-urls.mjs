import { readFile } from "node:fs/promises";
const [start, end] = process.argv.slice(2).map(Number);
const agents = JSON.parse(await readFile("/tmp/oregon_agents_current.json", "utf8"));
for (const a of agents.filter((x) => x.id >= start && x.id <= end)) console.log(`${a.id}\t${a.fullName}\t${a.websiteBioUrl ?? ""}`);
