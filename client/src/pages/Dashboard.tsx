import AgentAvatar from "@/components/AgentAvatar";
import BrokerSection from "@/components/BrokerSection";
import NotesEditor from "@/components/NotesEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { useSelectedState } from "@/contexts/StateContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Agent } from "../../../drizzle/schema";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Download,
  ExternalLink,
  Globe,
  LayoutGrid,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Rows3,
  Search,
  StickyNote,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type SortKey = "rank" | "name" | "city" | "brokerage" | "sides" | "volume";
type SortDir = "asc" | "desc";
type ViewMode = "cards" | "table";
type ScopeFilter = "all" | "name" | "city" | "brokerage";

const sortLabels: Record<SortKey, string> = {
  rank: "RealTrends Rank",
  name: "Name",
  city: "City",
  brokerage: "Brokerage",
  sides: "Total Sides",
  volume: "Volume",
};

function compare(a: Agent, b: Agent, key: SortKey): number {
  switch (key) {
    case "rank": {
      const ra = a.realtrendsRank ?? Number.MAX_SAFE_INTEGER;
      const rb = b.realtrendsRank ?? Number.MAX_SAFE_INTEGER;
      return ra - rb;
    }
    case "name":
      return a.fullName.localeCompare(b.fullName);
    case "city":
      return (a.cityArea ?? "").localeCompare(b.cityArea ?? "");
    case "brokerage":
      return (a.brokerage ?? "").localeCompare(b.brokerage ?? "");
    case "sides":
      return (b.realtrendsTotalSides ?? -1) - (a.realtrendsTotalSides ?? -1);
    case "volume":
      return (b.realtrendsVolumeNum ?? -1) - (a.realtrendsVolumeNum ?? -1);
  }
}

function downloadCsv(csv: string, label: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${label}-agent-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const { state } = useSelectedState();
  const { data: agents, isLoading } = trpc.agents.list.useQuery({ state });
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [view, setView] = useState<ViewMode>("cards");
  const [detailAgent, setDetailAgent] = useState<Agent | null>(null);
  const utils = trpc.useUtils();

  const exportMutation = trpc.agents.exportCsv.useMutation({
    onSuccess: (data, variables) => {
      downloadCsv(
        data.csv,
        variables?.state ? variables.state.toLowerCase().replace(/\s+/g, "-") : "all-states",
      );
      toast.success(`Exported ${data.count} agents to CSV`);
    },
    onError: err => toast.error(err.message || "Export failed"),
  });

  const deleteMutation = trpc.agents.delete.useMutation({
    onSuccess: () => {
      utils.agents.invalidate();
      setDetailAgent(null);
      toast.success("Agent removed");
    },
    onError: err => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    if (!agents) return [];
    const q = query.trim().toLowerCase();
    let list = agents;
    if (q) {
      list = agents.filter(a => {
        const name = a.fullName.toLowerCase();
        const city = (a.cityArea ?? "").toLowerCase();
        const brokerage = (a.brokerage ?? "").toLowerCase();
        if (scope === "name") return name.includes(q);
        if (scope === "city") return city.includes(q);
        if (scope === "brokerage") return brokerage.includes(q);
        return name.includes(q) || city.includes(q) || brokerage.includes(q);
      });
    }
    const sorted = [...list].sort((a, b) => compare(a, b, sortKey));
    if (sortDir === "desc") sorted.reverse();
    return sorted;
  }, [agents, query, scope, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const detailFresh = useMemo(
    () => (detailAgent ? (agents?.find(a => a.id === detailAgent.id) ?? detailAgent) : null),
    [detailAgent, agents],
  );

  return (
    <div className="max-w-[1500px]">
      {/* Page masthead */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
        <div>
          <p className="eyebrow text-accent mb-2">The Index</p>
          <h2 className="font-display text-5xl md:text-6xl font-extrabold tracking-tight leading-none">
            Agent <span className="italic font-medium">Directory</span>
          </h2>
          <p className="font-serif-text text-xl italic text-muted-foreground mt-3">
            {agents ? `${agents.length} agents on record in ${state}` : "Loading records"} ·
            RealTrends Verified 2026 · Buyer-side production 2023–present
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={exportMutation.isPending}
                className="rounded-none eyebrow border-foreground/30 hover:bg-foreground hover:text-background h-10"
              >
                {exportMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export CSV
                <ChevronDown className="h-3.5 w-3.5 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-none">
              <DropdownMenuItem
                className="eyebrow rounded-none cursor-pointer"
                onClick={() => exportMutation.mutate({ state })}
              >
                {state} only
              </DropdownMenuItem>
              <DropdownMenuItem
                className="eyebrow rounded-none cursor-pointer"
                onClick={() => exportMutation.mutate({})}
              >
                All states
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/add">
            <Button className="rounded-none eyebrow bg-foreground text-background hover:bg-accent hover:text-accent-foreground h-10">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Agent
            </Button>
          </Link>
        </div>
      </div>

      {/* Toolbar: search, scope, sort, view toggle */}
      <div className="border-y border-foreground/15 py-4 mb-8 flex flex-col md:flex-row gap-4 md:items-center">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, city, or brokerage…"
            className="rounded-none border-0 border-b border-input bg-transparent pl-7 pr-8 focus-visible:ring-0 focus-visible:border-accent font-serif-text text-lg"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={scope} onValueChange={v => setScope(v as ScopeFilter)}>
            <SelectTrigger className="rounded-none w-[130px] eyebrow h-9 border-foreground/25">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="all" className="eyebrow">All Fields</SelectItem>
              <SelectItem value="name" className="eyebrow">Name</SelectItem>
              <SelectItem value="city" className="eyebrow">City</SelectItem>
              <SelectItem value="brokerage" className="eyebrow">Brokerage</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortKey} onValueChange={v => toggleSort(v as SortKey)}>
            <SelectTrigger className="rounded-none w-[180px] eyebrow h-9 border-foreground/25">
              <span className="flex items-center gap-2">
                {sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {sortLabels[sortKey]}
              </span>
            </SelectTrigger>
            <SelectContent className="rounded-none">
              {(Object.keys(sortLabels) as SortKey[]).map(k => (
                <SelectItem key={k} value={k} className="eyebrow">
                  {sortLabels[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex border border-foreground/25">
            <button
              onClick={() => setView("cards")}
              aria-label="Card view"
              className={`h-9 w-10 flex items-center justify-center transition-colors ${
                view === "cards" ? "bg-foreground text-background" : "text-foreground/60 hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("table")}
              aria-label="Table view"
              className={`h-9 w-10 flex items-center justify-center transition-colors ${
                view === "table" ? "bg-foreground text-background" : "text-foreground/60 hover:text-foreground"
              }`}
            >
              <Rows3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-96 rounded-none" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-foreground/25 py-20 text-center">
          {agents && agents.length === 0 ? (
            <>
              <p className="font-display text-3xl font-bold mb-2">
                No agents loaded yet for {state}
              </p>
              <p className="font-serif-text text-lg italic text-muted-foreground mb-6">
                This territory is ready for data. Add agents manually or switch back to Oregon.
              </p>
              <Link href="/add">
                <Button className="rounded-none eyebrow bg-foreground text-background hover:bg-accent hover:text-accent-foreground">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add First {state} Agent
                </Button>
              </Link>
            </>
          ) : (
            <>
              <p className="font-display text-3xl font-bold mb-2">No agents found</p>
              <p className="font-serif-text text-lg italic text-muted-foreground">
                Try a different search term or clear the filter.
              </p>
            </>
          )}
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((agent, i) => (
            <AgentCard key={agent.id} agent={agent} index={i} onOpen={() => setDetailAgent(agent)} />
          ))}
        </div>
      ) : (
        <AgentTableView
          agents={filtered}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          onOpen={setDetailAgent}
        />
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailFresh} onOpenChange={open => !open && setDetailAgent(null)}>
        <DialogContent className="rounded-none max-w-3xl max-h-[90vh] overflow-y-auto bg-card">
          {detailFresh && (
            <>
              <DialogHeader>
                <p className="eyebrow text-accent text-left">
                  {detailFresh.isCustom
                    ? "Manually Added"
                    : `RealTrends No. ${detailFresh.realtrendsRank ?? "—"}`}
                </p>
                <DialogTitle className="font-display text-4xl font-extrabold text-left">
                  {detailFresh.fullName}
                </DialogTitle>
                <DialogDescription className="font-serif-text text-xl italic text-left">
                  {detailFresh.brokerage || "Independent"} · {detailFresh.cityArea || "Oregon"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid md:grid-cols-[200px_1fr] gap-6">
                <AgentAvatar
                  src={detailFresh.headshotUrl}
                  name={detailFresh.fullName}
                  className="w-full aspect-square border border-foreground/15"
                />
                <div className="space-y-3 text-sm">
                  <ContactRows agent={detailFresh} />
                </div>
              </div>
              <div className="rule-h" />
              <div className="grid sm:grid-cols-3 gap-4">
                <StatBlock label="Total Sides 2025" value={detailFresh.realtrendsTotalSides != null ? String(detailFresh.realtrendsTotalSides) : "—"} />
                <StatBlock label="Volume 2025" value={detailFresh.realtrendsVolume || "—"} />
                <StatBlock label="Sales Last 12 Mo." value={detailFresh.salesLast12Months || "—"} />
              </div>
              {detailFresh.buyerSideTransactions && (
                <div>
                  <p className="eyebrow text-muted-foreground mb-1.5">Buyer-Side Transactions · 2023–Present</p>
                  <p className="font-serif-text text-lg leading-relaxed">{detailFresh.buyerSideTransactions}</p>
                </div>
              )}
              {detailFresh.otherProductionStats && (
                <div>
                  <p className="eyebrow text-muted-foreground mb-1.5">Production Record</p>
                  <p className="font-serif-text text-lg leading-relaxed">{detailFresh.otherProductionStats}</p>
                </div>
              )}
              {detailFresh.principalBrokerName && (
                <>
                  <div className="rule-h" />
                  <BrokerSection agent={detailFresh} />
                </>
              )}
              <div className="rule-h" />
              <NotesEditor agentId={detailFresh.id} initialNotes={detailFresh.notes} />
              {detailFresh.isCustom && (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-none eyebrow text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm(`Remove ${detailFresh.fullName} from the index?`)) {
                        deleteMutation.mutate({ id: detailFresh.id });
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Remove Agent
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactRows({ agent }: { agent: Agent }) {
  return (
    <>
      {agent.phone && (
        <p className="flex items-center gap-2.5">
          <Phone className="h-4 w-4 text-accent shrink-0" />
          <a href={`tel:${agent.phone}`} className="hover:text-accent transition-colors">{agent.phone}</a>
        </p>
      )}
      {agent.email && (
        <p className="flex items-center gap-2.5">
          <Mail className="h-4 w-4 text-accent shrink-0" />
          <a href={`mailto:${agent.email}`} className="hover:text-accent transition-colors break-all">{agent.email}</a>
        </p>
      )}
      {agent.cityArea && (
        <p className="flex items-center gap-2.5">
          <MapPin className="h-4 w-4 text-accent shrink-0" />
          {agent.cityArea}
        </p>
      )}
      {agent.websiteBioUrl && (
        <p className="flex items-center gap-2.5">
          <Globe className="h-4 w-4 text-accent shrink-0" />
          <a
            href={agent.websiteBioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 decoration-foreground/30 hover:text-accent transition-colors break-all"
          >
            Website / Bio
          </a>
        </p>
      )}
      {agent.zillowUrl && (
        <p className="flex items-center gap-2.5">
          <ExternalLink className="h-4 w-4 text-accent shrink-0" />
          <a
            href={agent.zillowUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 decoration-foreground/30 hover:text-accent transition-colors break-all"
          >
            Zillow Profile
          </a>
        </p>
      )}
    </>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-foreground/15 p-4">
      <p className="font-display text-2xl font-bold leading-tight break-words">{value}</p>
      <p className="eyebrow text-muted-foreground mt-1.5">{label}</p>
    </div>
  );
}

function AgentCard({
  agent,
  index,
  onOpen,
}: {
  agent: Agent;
  index: number;
  onOpen: () => void;
}) {
  return (
    <article
      className="border border-foreground/15 bg-card flex flex-col group hover:border-foreground/40 transition-colors"
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
    >
      <div className="relative">
        <AgentAvatar
          src={agent.headshotUrl}
          name={agent.fullName}
          className="w-full aspect-[4/3] border-b border-foreground/15"
        />
        <div className="absolute top-3 left-3">
          {agent.isCustom ? (
            <Badge className="rounded-none bg-accent text-accent-foreground eyebrow border-0">Added</Badge>
          ) : (
            agent.realtrendsRank != null && (
              <Badge className="rounded-none bg-foreground text-background eyebrow border-0">
                No. {agent.realtrendsRank}
              </Badge>
            )
          )}
        </div>
        {agent.notes && (
          <div className="absolute top-3 right-3">
            <span title="Has notes" className="h-7 w-7 bg-card border border-foreground/20 flex items-center justify-center">
              <StickyNote className="h-3.5 w-3.5 text-accent" />
            </span>
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col gap-4 flex-1">
        <div>
          <button onClick={onOpen} className="text-left">
            <h3 className="font-display text-2xl font-bold leading-tight group-hover:text-accent transition-colors">
              {agent.fullName}
            </h3>
          </button>
          <p className="font-serif-text text-lg italic text-muted-foreground leading-snug mt-1">
            {agent.brokerage || "Independent"}
          </p>
          <p className="eyebrow text-muted-foreground mt-2 flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            {agent.cityArea || "Oregon"}
          </p>
        </div>
        <div className="rule-h" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-display text-xl font-bold">
              {agent.realtrendsTotalSides != null ? agent.realtrendsTotalSides : "—"}
            </p>
            <p className="eyebrow text-muted-foreground">Sides '25</p>
          </div>
          <div>
            <p className="font-display text-xl font-bold">{agent.realtrendsVolume || "—"}</p>
            <p className="eyebrow text-muted-foreground">Volume '25</p>
          </div>
        </div>
        <div className="space-y-1.5 text-sm">
          <ContactRows agent={agent} />
        </div>
        {agent.principalBrokerName && (
          <div className="border border-foreground/10 bg-secondary/40 px-3 py-2.5">
            <p className="eyebrow text-muted-foreground mb-1">Principal Broker</p>
            <div className="flex items-center gap-2.5">
              <AgentAvatar
                src={agent.principalBrokerHeadshotUrl}
                name={agent.principalBrokerName}
                className="h-8 w-8 shrink-0 border border-foreground/15 text-[0.45rem]"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight truncate">{agent.principalBrokerName}</p>
                <p className="text-xs text-muted-foreground leading-tight">
                  Office No. {agent.officeBuysideRank ?? "—"} · ~{agent.officeBuysideTransactions ?? "—"} buyside/yr
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="mt-auto pt-2">
          <NotesEditor agentId={agent.id} initialNotes={agent.notes} compact />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpen}
          className="rounded-none eyebrow border-foreground/25 hover:bg-foreground hover:text-background w-full"
        >
          Full Profile
        </Button>
      </div>
    </article>
  );
}

function SortHeader({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  className = "",
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === k;
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(k)}
        className={`eyebrow flex items-center gap-1.5 hover:text-accent transition-colors ${active ? "text-accent" : "text-muted-foreground"}`}
      >
        {label}
        {active ? (
          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

function AgentTableView({
  agents,
  sortKey,
  sortDir,
  onSort,
  onOpen,
}: {
  agents: Agent[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  onOpen: (a: Agent) => void;
}) {
  return (
    <div className="border border-foreground/15 overflow-x-auto bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-foreground/15 hover:bg-transparent">
            <SortHeader label="Rank" k="rank" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="w-16" />
            <SortHeader label="Agent" k="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Brokerage" k="brokerage" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="City" k="city" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <TableHead className="eyebrow text-muted-foreground">Contact</TableHead>
            <SortHeader label="Sides '25" k="sides" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Volume '25" k="volume" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <TableHead className="eyebrow text-muted-foreground">Principal Broker</TableHead>
            <TableHead className="eyebrow text-muted-foreground">Links</TableHead>
            <TableHead className="eyebrow text-muted-foreground">Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map(agent => (
            <TableRow key={agent.id} className="border-foreground/10 hover:bg-secondary/60">
              <TableCell className="font-display font-bold text-lg">
                {agent.isCustom ? (
                  <Badge className="rounded-none bg-accent text-accent-foreground eyebrow border-0">Added</Badge>
                ) : (
                  (agent.realtrendsRank ?? "—")
                )}
              </TableCell>
              <TableCell>
                <button onClick={() => onOpen(agent)} className="flex items-center gap-3 text-left group">
                  <AgentAvatar
                    src={agent.headshotUrl}
                    name={agent.fullName}
                    className="h-11 w-11 shrink-0 border border-foreground/15 text-[0.5rem]"
                  />
                  <span className="font-display font-bold text-base group-hover:text-accent transition-colors whitespace-nowrap">
                    {agent.fullName}
                  </span>
                </button>
              </TableCell>
              <TableCell className="font-serif-text text-base max-w-[220px]">
                <span className="line-clamp-2">{agent.brokerage || "—"}</span>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">{agent.cityArea || "—"}</TableCell>
              <TableCell className="text-sm">
                <div className="space-y-0.5">
                  {agent.phone && (
                    <a href={`tel:${agent.phone}`} className="block whitespace-nowrap hover:text-accent">{agent.phone}</a>
                  )}
                  {agent.email && (
                    <a href={`mailto:${agent.email}`} className="block text-muted-foreground hover:text-accent break-all text-xs">{agent.email}</a>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-display font-bold">
                {agent.realtrendsTotalSides ?? "—"}
              </TableCell>
              <TableCell className="font-display font-bold whitespace-nowrap">
                {agent.realtrendsVolume || "—"}
              </TableCell>
              <TableCell>
                {agent.principalBrokerName ? (
                  <div className="flex items-center gap-2.5">
                    <AgentAvatar
                      src={agent.principalBrokerHeadshotUrl}
                      name={agent.principalBrokerName}
                      className="h-9 w-9 shrink-0 border border-foreground/15 text-[0.45rem]"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight whitespace-nowrap">
                        {agent.principalBrokerName}
                      </p>
                      <p className="text-xs text-muted-foreground leading-tight whitespace-nowrap">
                        Office No. {agent.officeBuysideRank ?? "—"} · ~{agent.officeBuysideTransactions ?? "—"}/yr
                      </p>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {agent.websiteBioUrl && (
                    <a
                      href={agent.websiteBioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Website / Bio"
                      className="text-muted-foreground hover:text-accent"
                    >
                      <Globe className="h-4 w-4" />
                    </a>
                  )}
                  {agent.zillowUrl && (
                    <a
                      href={agent.zillowUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Zillow Profile"
                      className="text-muted-foreground hover:text-accent"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </TableCell>
              <TableCell className="max-w-[200px]">
                <button
                  onClick={() => onOpen(agent)}
                  className="text-left w-full group"
                  title="Open profile to edit notes"
                >
                  {agent.notes ? (
                    <span className="font-serif-text text-sm italic line-clamp-2 group-hover:text-accent transition-colors">
                      {agent.notes}
                    </span>
                  ) : (
                    <span className="eyebrow text-muted-foreground/50 group-hover:text-accent transition-colors">
                      + Add note
                    </span>
                  )}
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
