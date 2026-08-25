import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSelectedState } from "@/contexts/StateContext";
import { trpc } from "@/lib/trpc";
import { Check, ExternalLink, Handshake, Loader2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function Pairings() {
  const { state } = useSelectedState();
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const { data: pairings, isLoading } = trpc.pairings.list.useQuery({
    state,
    status: status === "all" ? undefined : status,
  });
  const approve = trpc.pairings.approve.useMutation({
    onSuccess: () => {
      utils.pairings.list.invalidate();
      toast.success("Pairing approved");
    },
    onError: error => toast.error(error.message),
  });
  const reject = trpc.pairings.reject.useMutation({
    onSuccess: () => {
      utils.pairings.list.invalidate();
      toast.success("Pairing dismissed");
    },
    onError: error => toast.error(error.message),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (pairings ?? []).filter(pairing => {
      if (!q) return true;
      return [pairing.agentName, pairing.agentBrokerage, pairing.loanOfficerName, pairing.loanOfficerCompany, pairing.transactionAddress]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q));
    });
  }, [pairings, query]);

  return (
    <div className="max-w-[1600px]">
      <div className="mb-8">
        <p className="eyebrow text-accent mb-3">Mortgage Relationship Intelligence</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-5xl md:text-6xl font-extrabold leading-[0.95] tracking-tight">
              Loan Officer <span className="italic font-medium">×</span>
              <br />
              Agent Pairings
            </h2>
            <p className="font-serif-text text-lg text-muted-foreground mt-4 max-w-2xl leading-relaxed">
              Closed-transaction relationships found from the loan-officer side. Every pairing requires a public source that names both the loan officer and the buyer&apos;s agent; nothing is inferred from rankings or brokerage affiliation.
            </p>
          </div>
          <div className="border border-foreground/15 bg-secondary/30 px-4 py-3 max-w-xs">
            <p className="eyebrow text-muted-foreground">Evidence standard</p>
            <p className="font-serif-text text-sm mt-1 leading-relaxed">Source URL + named closed transaction + direct agent match.</p>
          </div>
        </div>
        <div className="rule-h mt-6" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-foreground/15 border border-foreground/15 mb-8">
        <div className="bg-card px-5 py-4"><p className="font-display text-3xl font-bold">{pairings?.length ?? 0}</p><p className="eyebrow text-muted-foreground mt-2">Showing</p></div>
        <div className="bg-card px-5 py-4"><p className="font-display text-3xl font-bold">{filtered.filter(row => row.status === "pending").length}</p><p className="eyebrow text-muted-foreground mt-2">Needs approval</p></div>
        <div className="bg-card px-5 py-4"><p className="font-display text-3xl font-bold">{new Set(filtered.map(row => row.loanOfficerName)).size}</p><p className="eyebrow text-muted-foreground mt-2">Loan officers</p></div>
        <div className="bg-card px-5 py-4"><p className="font-display text-3xl font-bold">{new Set(filtered.map(row => row.agentId)).size}</p><p className="eyebrow text-muted-foreground mt-2">Agents</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[240px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search loan officer, agent, company, or address…" className="rounded-none border-foreground/25 bg-card pl-9 h-10 font-serif-text" /></div>
        <Select value={status} onValueChange={value => setStatus(value as typeof status)}><SelectTrigger className="rounded-none border-foreground/25 bg-card eyebrow h-10 w-[180px]"><SelectValue /></SelectTrigger><SelectContent className="rounded-none"><SelectItem value="pending" className="rounded-none">Needs approval</SelectItem><SelectItem value="approved" className="rounded-none">Approved</SelectItem><SelectItem value="rejected" className="rounded-none">Dismissed</SelectItem><SelectItem value="all" className="rounded-none">All pairings</SelectItem></SelectContent></Select>
      </div>

      {isLoading ? <div className="py-24 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-accent" /><p className="eyebrow text-muted-foreground mt-4">Loading pairings</p></div> : filtered.length === 0 ? <div className="border border-foreground/15 bg-card py-20 text-center px-6"><Handshake className="h-8 w-8 mx-auto text-muted-foreground/40" strokeWidth={1.25} /><h3 className="font-display text-3xl font-bold mt-5">No evidenced pairings yet</h3><p className="font-serif-text text-muted-foreground mt-3 max-w-xl mx-auto leading-relaxed">This view stays empty until a public loan-officer-side resource names the loan officer, the closed transaction, and one of the agents in your Oregon roster. Use the protected ingest procedure to add a sourced finding for review.</p></div> : <div className="border border-foreground/15 divide-y divide-foreground/10 bg-card">{filtered.map(pairing => <div key={pairing.id} className="px-5 py-5 flex flex-col lg:flex-row lg:items-start gap-5"><div className="lg:w-60 shrink-0"><p className="eyebrow text-accent flex items-center gap-1.5"><Handshake className="h-3 w-3" /> {pairing.status === "pending" ? "Needs approval" : pairing.status}</p><p className="font-display text-xl font-bold mt-1.5">{pairing.loanOfficerName}</p><p className="font-serif-text text-sm text-muted-foreground mt-1">{pairing.loanOfficerCompany ?? "Company not recorded"}</p></div><div className="flex-1 min-w-0"><p className="font-serif-text text-base"><span className="font-medium">{pairing.agentName ?? `Agent #${pairing.agentId}`}</span><span className="text-muted-foreground"> · {pairing.agentBrokerage ?? "Brokerage not recorded"}</span></p>{pairing.transactionAddress && <p className="font-serif-text text-sm text-muted-foreground mt-1">Closed transaction: {pairing.transactionAddress}{pairing.transactionClosedAt ? ` · ${new Date(pairing.transactionClosedAt).toLocaleDateString()}` : ""}</p>}<p className="font-serif-text text-sm text-muted-foreground mt-2 leading-relaxed">{pairing.evidenceNote}</p><a href={pairing.sourceUrl} target="_blank" rel="noreferrer" className="eyebrow text-accent hover:underline inline-flex items-center gap-1 mt-2"><ExternalLink className="h-3 w-3" /> View source</a></div>{pairing.status === "pending" && <div className="flex lg:flex-col gap-2 shrink-0"><Button size="sm" onClick={() => approve.mutate({ id: pairing.id })} className="rounded-none eyebrow bg-foreground text-background hover:bg-foreground/90"><Check className="h-3.5 w-3.5 mr-1.5" /> Approve</Button><Button size="sm" variant="outline" onClick={() => reject.mutate({ id: pairing.id })} className="rounded-none eyebrow border-foreground/25"><X className="h-3.5 w-3.5 mr-1.5" /> Dismiss</Button></div>}</div>)}</div>}
    </div>
  );
}
