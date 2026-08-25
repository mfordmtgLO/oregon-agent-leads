import { readFile, writeFile } from "node:fs/promises";

const agents = JSON.parse(await readFile("/tmp/oregon_agents_current.json", "utf8"));
const inputs = agents.map((agent) => ({
  id: agent.id,
  name: agent.fullName,
  brokerage: agent.brokerage,
  city: agent.cityArea,
  phone: agent.phone,
  email: agent.email,
  website: agent.websiteBioUrl,
  zillow: agent.zillowUrl,
  principalBroker: agent.principalBrokerName,
  principalBrokerPhone: agent.principalBrokerPhone,
  principalBrokerEmail: agent.principalBrokerEmail,
  rank: agent.realtrendsRank,
  totalSides: agent.realtrendsTotalSides,
}));
await writeFile("/tmp/oregon_research_inputs.json", JSON.stringify(inputs, null, 2));
console.log(`wrote ${inputs.length} inputs`);
for (const agent of inputs) console.log(`${agent.id}\t${agent.name}\t${agent.brokerage}\t${agent.city}`);
