// Seed principal broker & office buyside data from office_broker_data.json, matching by agent_name
import "dotenv/config";
import fs from "node:fs";
import mysql from "mysql2/promise";

const data = JSON.parse(fs.readFileSync("/home/ubuntu/upload/office_broker_data.json", "utf8"));
const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Treat placeholder strings like "Not found" as missing values
const clean = v => (v && !/^not\s+found$/i.test(String(v).trim()) ? v : null);

let updated = 0;
const misses = [];
for (const o of data.agents) {
  const [res] = await conn.execute(
    `UPDATE agents SET
       principalBrokerName = ?,
       principalBrokerTitle = ?,
       principalBrokerPhone = ?,
       principalBrokerEmail = ?,
       principalBrokerHeadshotUrl = ?,
       officeBuysideTransactions = ?,
       officeBuysideRank = ?,
       officeEstimationNotes = ?,
       officeDataConfidence = ?,
       officeDataSources = ?
     WHERE fullName = ? AND isCustom = 0`,
    [
      clean(o.principal_broker_name),
      clean(o.principal_broker_title),
      clean(o.principal_broker_phone),
      clean(o.principal_broker_email),
      clean(o.principal_broker_headshot_url),
      o.office_annual_buyside_transactions ?? null,
      o.office_buyside_rank ?? null,
      o.estimation_notes ?? null,
      o.confidence ?? null,
      clean(o.sources),
      o.agent_name,
    ],
  );
  if (res.affectedRows === 0) misses.push(o.agent_name);
  else updated += res.affectedRows;
}

const [[counts]] = await conn.query(
  "SELECT COUNT(*) AS withBroker, COUNT(DISTINCT officeBuysideRank) AS uniqueRanks FROM agents WHERE principalBrokerName IS NOT NULL",
);
console.log("rows updated:", updated);
console.log("unmatched agent_names:", misses.length ? misses : "none");
console.log("agents with broker data:", counts.withBroker, "| unique ranks:", counts.uniqueRanks);
await conn.end();
