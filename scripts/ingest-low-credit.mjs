import { readFile } from "node:fs/promises";

const base = process.env.OREGON_LEADS_BASE ?? "https://oregonleads-bqkuz5cc.manus.space";
const findings = JSON.parse(await readFile("/tmp/oregon_low_credit_findings.json", "utf8"));
const loginResponse = await fetch(`${base}/api/trpc/appAuth.login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ json: { username: "mike.ford", password: "OregonMLO2025!" } }),
});
if (!loginResponse.ok) throw new Error(`Login failed: ${loginResponse.status}`);
const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
if (!cookie) throw new Error("Login did not return a session cookie");
const ingestResponse = await fetch(`${base}/api/trpc/verification.ingest`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ json: { state: "Oregon", findings } }),
});
const body = await ingestResponse.text();
console.log(`status=${ingestResponse.status}`);
console.log(body);
if (!ingestResponse.ok) process.exitCode = 1;
