import AgentAvatar from "@/components/AgentAvatar";
import type { Agent } from "../../../drizzle/schema";
import { Mail, Phone } from "lucide-react";

/**
 * Principal Broker panel used in the agent Full Profile dialog.
 * Shows broker identity, contact info, and office-level buyside stats.
 */
export default function BrokerSection({ agent }: { agent: Agent }) {
  return (
    <div>
      <p className="eyebrow text-accent mb-3">Principal Broker · Office Intelligence</p>
      <div className="grid sm:grid-cols-[88px_1fr] gap-4 items-start">
        <AgentAvatar
          src={agent.principalBrokerHeadshotUrl}
          name={agent.principalBrokerName ?? ""}
          className="w-[88px] aspect-square border border-foreground/15 text-xs"
        />
        <div className="min-w-0">
          <p className="font-display text-2xl font-bold leading-tight">{agent.principalBrokerName}</p>
          {agent.principalBrokerTitle && (
            <p className="font-serif-text text-base italic text-muted-foreground">{agent.principalBrokerTitle}</p>
          )}
          <div className="mt-2 space-y-1 text-sm">
            {agent.principalBrokerPhone && (
              <p className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-accent shrink-0" />
                <a href={`tel:${agent.principalBrokerPhone}`} className="hover:text-accent transition-colors">
                  {agent.principalBrokerPhone}
                </a>
              </p>
            )}
            {agent.principalBrokerEmail && (
              <p className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-accent shrink-0" />
                <a
                  href={`mailto:${agent.principalBrokerEmail}`}
                  className="hover:text-accent transition-colors break-all"
                >
                  {agent.principalBrokerEmail}
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="border border-foreground/15 p-4">
          <p className="font-display text-2xl font-bold leading-tight">
            {agent.officeBuysideTransactions != null ? `~${agent.officeBuysideTransactions}` : "—"}
          </p>
          <p className="eyebrow text-muted-foreground mt-1.5">Office Buyside Transactions / Yr (Est.)</p>
        </div>
        <div className="border border-foreground/15 p-4">
          <p className="font-display text-2xl font-bold leading-tight">
            {agent.officeBuysideRank != null ? `No. ${agent.officeBuysideRank}` : "—"}
          </p>
          <p className="eyebrow text-muted-foreground mt-1.5">Office Buyside Rank (of 60)</p>
        </div>
      </div>
      {agent.officeEstimationNotes && (
        <details className="mt-3">
          <summary className="eyebrow text-muted-foreground cursor-pointer hover:text-accent transition-colors">
            Estimation Methodology{agent.officeDataConfidence ? ` · Confidence: ${agent.officeDataConfidence}` : ""}
          </summary>
          <p className="font-serif-text text-base leading-relaxed mt-2 text-muted-foreground">
            {agent.officeEstimationNotes}
          </p>
        </details>
      )}
    </div>
  );
}
