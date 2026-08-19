import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSelectedState } from "@/contexts/StateContext";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  HelpCircle,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Finding = {
  id: number;
  agentId: number;
  agentName: string;
  outcome: "confirmed" | "changed" | "unverified";
  recordedBrokerage: string | null;
  recordedPrincipalBroker: string | null;
  recordedCityArea: string | null;
  proposedBrokerage: string | null;
  proposedPrincipalBroker: string | null;
  proposedPrincipalBrokerPhone: string | null;
  proposedPrincipalBrokerEmail: string | null;
  proposedCityArea: string | null;
  proposedPhone: string | null;
  proposedEmail: string | null;
  proposedWebsiteBioUrl: string | null;
  proposedZillowUrl: string | null;
  proposedTotalSides: number | null;
  proposedVolume: string | null;
  evidenceNote: string | null;
  evidenceUrl: string | null;
  unverifiedReason: string | null;
  confidence: string | null;
};

const REASON_LABEL: Record<string, string> = {
  blocked: "Site blocked the check",
  not_found: "Page gone or brokerage absent",
  no_source: "No URL on record",
  fetch_error: "Could not reach page",
};

/** Human-readable list of what an approval would write. */
function proposalRows(f: Finding): { label: string; from: string | null; to: string }[] {
  const rows: { label: string; from: string | null; to: string }[] = [];
  const add = (label: string, from: string | null, to: string | null | number) => {
    if (to === null || to === undefined || to === "") return;
    rows.push({ label, from, to: String(to) });
  };
  add("Brokerage", f.recordedBrokerage, f.proposedBrokerage);
  add("Principal broker", f.recordedPrincipalBroker, f.proposedPrincipalBroker);
  add("Broker phone", null, f.proposedPrincipalBrokerPhone);
  add("Broker email", null, f.proposedPrincipalBrokerEmail);
  add("City / area", f.recordedCityArea, f.proposedCityArea);
  add("Agent phone", null, f.proposedPhone);
  add("Agent email", null, f.proposedEmail);
  add("Website", null, f.proposedWebsiteBioUrl);
  add("Zillow", null, f.proposedZillowUrl);
  add("Total sides", null, f.proposedTotalSides);
  add("Volume", null, f.proposedVolume);
  return rows;
}

export default function ReviewQueue() {
  const { state } = useSelectedState();
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "changed" | "unverified">("all");
  const [detail, setDetail] = useState<Finding | null>(null);

  const { data: queue, isLoading } = trpc.verification.queue.useQuery({ state });
  const { data: runs } = trpc.verification.runs.useQuery({ state });

  const runCheck = trpc.verification.run.useMutation({
    onSuccess: result => {
      utils.verification.queue.invalidate();
      utils.verification.runs.invalidate();
      toast.success(
        `Checked ${result.agentsChecked} agents — ${result.confirmedCount} confirmed, ${result.changedCount} changed, ${result.unverifiedCount} need a research pass`,
      );
    },
    onError: e => toast.error(e.message),
  });

  const approve = trpc.verification.approve.useMutation({
    onSuccess: result => {
      utils.verification.queue.invalidate();
      utils.agents.list.invalidate();
      setDetail(null);
      toast.success(
        result.fieldsUpdated > 0
          ? `Record updated (${result.fieldsUpdated} field${result.fieldsUpdated === 1 ? "" : "s"})${result.ranksRecomputed ? " · ranks recomputed" : ""}`
          : "Marked as reviewed",
      );
    },
    onError: e => toast.error(e.message),
  });

  const reject = trpc.verification.reject.useMutation({
    onSuccess: () => {
      utils.verification.queue.invalidate();
      setDetail(null);
      toast.success("Finding dismissed");
    },
    onError: e => toast.error(e.message),
  });

  const lastRun = runs?.[0];

  const filtered = useMemo(() => {
    const rows = (queue ?? []) as Finding[];
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (filter !== "all" && r.outcome !== filter) return false;
      if (!q) return true;
      return [r.agentName, r.recordedBrokerage, r.proposedBrokerage, r.recordedPrincipalBroker]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));
    });
  }, [queue, query, filter]);

  const changedCount = ((queue ?? []) as Finding[]).filter(r => r.outcome === "changed").length;
  const unverifiedCount = ((queue ?? []) as Finding[]).filter(r => r.outcome === "unverified").length;

  return (
    <div className="max-w-[1600px]">
      {/* Masthead */}
      <div className="mb-8">
        <p className="eyebrow text-accent mb-3">Roster Maintenance</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-5xl md:text-6xl font-extrabold leading-[0.95] tracking-tight">
              Update <span className="italic font-medium">Current</span>
              <br />
              Top Agents
            </h2>
            <p className="font-serif-text text-lg text-muted-foreground mt-4 max-w-2xl leading-relaxed">
              Re-checks every {state} agent against their own profile page to see whether they still
              work at the brokerage and office on record. Nothing is changed until you approve it.
            </p>
          </div>
          <Button
            onClick={() => runCheck.mutate({ state })}
            disabled={runCheck.isPending}
            className="rounded-none eyebrow bg-foreground text-background hover:bg-foreground/90 h-11 px-6"
          >
            {runCheck.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking agents…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" /> Update Current Top Agents
              </>
            )}
          </Button>
        </div>
        <div className="rule-h mt-6" />
      </div>

      {/* Run summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-foreground/15 border border-foreground/15 mb-8">
        {[
          { label: "Awaiting review", value: changedCount + unverifiedCount },
          { label: "Proposed changes", value: changedCount },
          { label: "Need research", value: unverifiedCount },
          {
            label: "Last checked",
            value: lastRun ? new Date(lastRun.startedAt).toLocaleDateString() : "Never",
          },
        ].map(stat => (
          <div key={stat.label} className="bg-card px-5 py-4">
            <p className="font-display text-3xl font-bold leading-none">{stat.value}</p>
            <p className="eyebrow text-muted-foreground mt-2">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* How this works — set expectations honestly */}
      <div className="border border-foreground/15 bg-secondary/30 px-5 py-4 mb-8">
        <p className="eyebrow text-muted-foreground mb-2 flex items-center gap-1.5">
          <HelpCircle className="h-3 w-3" /> How the check works
        </p>
        <p className="font-serif-text text-[15px] text-muted-foreground leading-relaxed">
          The automated sweep fetches each agent's website or Zillow page and looks for the brokerage
          and principal broker on record. Zillow, Redfin and some brokerage sites block automated
          requests — those come back as <span className="italic">Needs research</span> rather than a
          false confirmation. Items marked that way are candidates for a deeper research pass, which
          can find where an agent actually moved. Ranks stay as your RealTrends 2026 figures and are
          only recalculated if a production number itself changes.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search findings by agent or brokerage…"
            className="rounded-none border-foreground/25 bg-card pl-9 h-10 font-serif-text"
          />
        </div>
        <Select value={filter} onValueChange={v => setFilter(v as typeof filter)}>
          <SelectTrigger className="rounded-none border-foreground/25 bg-card eyebrow h-10 w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="all" className="rounded-none">All findings</SelectItem>
            <SelectItem value="changed" className="rounded-none">Proposed changes</SelectItem>
            <SelectItem value="unverified" className="rounded-none">Needs research</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Queue */}
      {isLoading ? (
        <div className="py-24 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-accent" />
          <p className="eyebrow text-muted-foreground mt-4">Loading the queue</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-foreground/15 bg-card py-20 text-center px-6">
          <ShieldCheck className="h-8 w-8 mx-auto text-muted-foreground/40" strokeWidth={1.25} />
          <h3 className="font-display text-3xl font-bold mt-5">
            {queue && queue.length > 0 ? "Nothing matches that filter" : "Queue is clear"}
          </h3>
          <p className="font-serif-text text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
            {queue && queue.length > 0
              ? "Try a different filter or clear the search."
              : lastRun
                ? `No findings are awaiting your decision for ${state}. Run the check again any time to re-verify the roster.`
                : `No check has run yet for ${state}. Use "Update Current Top Agents" to verify the roster against live profile pages.`}
          </p>
        </div>
      ) : (
        <div className="border border-foreground/15 divide-y divide-foreground/10 bg-card">
          {filtered.map(f => {
            const rows = proposalRows(f);
            const isChange = f.outcome === "changed";
            return (
              <div key={f.id} className="px-5 py-4 flex flex-col md:flex-row md:items-start gap-4">
                <div className="md:w-44 shrink-0">
                  <p
                    className={`eyebrow flex items-center gap-1.5 ${isChange ? "text-accent" : "text-muted-foreground"}`}
                  >
                    {isChange ? (
                      <AlertTriangle className="h-3 w-3" />
                    ) : (
                      <HelpCircle className="h-3 w-3" />
                    )}
                    {isChange ? "Proposed change" : "Needs research"}
                  </p>
                  <p className="font-display text-xl font-bold mt-1.5 leading-tight">{f.agentName}</p>
                  {f.unverifiedReason && (
                    <p className="text-xs text-muted-foreground mt-1 font-sans">
                      {REASON_LABEL[f.unverifiedReason] ?? f.unverifiedReason}
                    </p>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {rows.length > 0 ? (
                    <div className="space-y-1.5">
                      {rows.map(r => (
                        <div key={r.label} className="flex flex-wrap items-center gap-2 text-sm font-serif-text">
                          <span className="eyebrow text-muted-foreground w-32 shrink-0">{r.label}</span>
                          {r.from && (
                            <>
                              <span className="line-through text-muted-foreground/70">{r.from}</span>
                              <ArrowRight className="h-3 w-3 text-accent shrink-0" />
                            </>
                          )}
                          <span className="font-medium break-all">{r.to}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-serif-text text-muted-foreground italic">
                      No specific change to apply — this item is flagged for a research pass.
                    </p>
                  )}
                  {f.evidenceNote && (
                    <p className="text-[13px] font-serif-text text-muted-foreground mt-2.5 leading-relaxed">
                      {f.evidenceNote}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    {f.evidenceUrl && (
                      <a
                        href={f.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="eyebrow text-accent hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" /> Source checked
                      </a>
                    )}
                    {f.confidence && (
                      <span className="eyebrow text-muted-foreground">{f.confidence} confidence</span>
                    )}
                    <button onClick={() => setDetail(f)} className="eyebrow text-muted-foreground hover:text-foreground">
                      Details
                    </button>
                  </div>
                </div>

                <div className="flex md:flex-col gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => approve.mutate({ id: f.id })}
                    disabled={approve.isPending || reject.isPending}
                    className="rounded-none eyebrow bg-foreground text-background hover:bg-foreground/90"
                  >
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    {rows.length > 0 ? "Approve" : "Acknowledge"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reject.mutate({ id: f.id })}
                    disabled={approve.isPending || reject.isPending}
                    className="rounded-none eyebrow border-foreground/25"
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" /> Dismiss
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={open => !open && setDetail(null)}>
        <DialogContent className="rounded-none border-foreground/20 bg-card max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <p className="eyebrow text-accent">
                  {detail.outcome === "changed" ? "Proposed change" : "Needs research"}
                </p>
                <DialogTitle className="font-display text-3xl font-bold">{detail.agentName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="eyebrow text-muted-foreground mb-1.5">On record</p>
                  <p className="font-serif-text">
                    {detail.recordedBrokerage ?? "—"}
                    {detail.recordedCityArea ? ` · ${detail.recordedCityArea}` : ""}
                  </p>
                  <p className="font-serif-text text-sm text-muted-foreground">
                    Principal broker: {detail.recordedPrincipalBroker ?? "—"}
                  </p>
                </div>
                {proposalRows(detail).length > 0 && (
                  <div>
                    <p className="eyebrow text-muted-foreground mb-1.5">Would become</p>
                    {proposalRows(detail).map(r => (
                      <p key={r.label} className="font-serif-text text-sm">
                        <span className="text-muted-foreground">{r.label}: </span>
                        {r.to}
                      </p>
                    ))}
                  </div>
                )}
                {detail.evidenceNote && (
                  <div>
                    <p className="eyebrow text-muted-foreground mb-1.5">Evidence</p>
                    <p className="font-serif-text text-sm leading-relaxed">{detail.evidenceNote}</p>
                  </div>
                )}
                {detail.evidenceUrl && (
                  <a
                    href={detail.evidenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="eyebrow text-accent hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" /> {detail.evidenceUrl}
                  </a>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
