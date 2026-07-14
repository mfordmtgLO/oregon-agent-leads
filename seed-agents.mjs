import "dotenv/config";
import fs from "node:fs";
import mysql from "mysql2/promise";

const DATA_PATH = "/home/ubuntu/upload/oregon_agents_data.json";

function clean(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || /^not found$/i.test(s) || /^not applicable$/i.test(s) || /^none$/i.test(s)) return null;
  return s;
}

function parseVolumeNum(volume) {
  if (!volume) return null;
  const m = volume.replace(/[$,\s]/g, "").match(/^([\d.]+)([MKB])?/i);
  if (!m) return null;
  const base = parseFloat(m[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = (m[2] || "").toUpperCase();
  const mult = suffix === "B" ? 1e9 : suffix === "M" ? 1e6 : suffix === "K" ? 1e3 : 1;
  return base * mult;
}

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const agents = data.agents;
console.log(`Loaded ${agents.length} agents from JSON`);

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [existing] = await conn.query("SELECT COUNT(*) AS c FROM agents WHERE isCustom = 0");
if (existing[0].c > 0) {
  console.log(`Already seeded (${existing[0].c} pre-loaded agents). Skipping.`);
  await conn.end();
  process.exit(0);
}

const sql = `INSERT INTO agents
  (fullName, brokerage, cityArea, phone, email, websiteBioUrl, zillowUrl, headshotUrl,
   buyerSideTransactions, salesLast12Months, otherProductionStats,
   realtrendsRank, realtrendsTotalSides, realtrendsVolume, realtrendsVolumeNum,
   dataSources, notes, isCustom)
  VALUES ?`;

const rows = agents.map(a => {
  const headshot = clean(a.headshot_url) || clean(a.alternate_headshot_url);
  const volume = clean(a.realtrends_volume_2025);
  return [
    clean(a.full_name),
    clean(a.brokerage),
    clean(a.city_area),
    clean(a.phone),
    clean(a.email),
    clean(a.website_bio_url),
    clean(a.zillow_url),
    headshot,
    clean(a.buyer_side_transactions_2023_present),
    clean(a.sales_last_12_months),
    clean(a.other_production_stats),
    a.realtrends_rank_2026 ?? null,
    a.realtrends_total_sides_2025 ?? null,
    volume,
    parseVolumeNum(volume),
    clean(a.data_sources),
    null,
    0,
  ];
});

await conn.query(sql, [rows]);
const [after] = await conn.query("SELECT COUNT(*) AS c FROM agents");
console.log(`Seeded. Total agents in DB: ${after[0].c}`);
await conn.end();
