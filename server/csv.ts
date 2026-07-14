import type { Agent } from "../drizzle/schema";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export const CSV_HEADERS = [
  "Full Name",
  "Brokerage",
  "City / Area",
  "Phone",
  "Email",
  "Website / Bio URL",
  "Zillow URL",
  "Headshot URL",
  "Buyer-Side Transactions (2023-Present)",
  "Sales Last 12 Months",
  "Other Production Stats",
  "RealTrends Rank 2026",
  "RealTrends Total Sides 2025",
  "RealTrends Volume 2025",
  "Principal Broker Name",
  "Principal Broker Title",
  "Principal Broker Phone",
  "Principal Broker Email",
  "Principal Broker Headshot URL",
  "Office Annual Buyside Transactions (Est.)",
  "Office Buyside Rank (1-60)",
  "Manually Added",
  "Notes",
];

export function agentsToCsv(agents: Agent[]): string {
  const rows = agents.map(a =>
    [
      a.fullName,
      a.brokerage,
      a.cityArea,
      a.phone,
      a.email,
      a.websiteBioUrl,
      a.zillowUrl,
      a.headshotUrl,
      a.buyerSideTransactions,
      a.salesLast12Months,
      a.otherProductionStats,
      a.realtrendsRank,
      a.realtrendsTotalSides,
      a.realtrendsVolume,
      a.principalBrokerName,
      a.principalBrokerTitle,
      a.principalBrokerPhone,
      a.principalBrokerEmail,
      a.principalBrokerHeadshotUrl,
      a.officeBuysideTransactions,
      a.officeBuysideRank,
      a.isCustom ? "Yes" : "No",
      a.notes,
    ]
      .map(csvEscape)
      .join(","),
  );
  return [CSV_HEADERS.join(","), ...rows].join("\r\n");
}
