import AgentAvatar from "@/components/AgentAvatar";
import { useSelectedState } from "@/contexts/StateContext";
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
import { ArrowDown, ArrowUp, ArrowUpDown, Mail, Phone, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

type Office = {
  officeBuysideRank: number;
  brokerage: string | null;
  cityArea: string | null;
  principalBrokerName: string | null;
  principalBrokerTitle: string | null;
  principalBrokerPhone: string | null;
  principalBrokerEmail: string | null;
  principalBrokerHeadshotUrl: string | null;
  officeBuysideTransactions: number | null;
  officeDataConfidence: string | null;
  agents: { id: number; fullName: string; headshotUrl: string | null }[];
};

type SortKey = "rank" | "brokerage" | "city" | "broker" | "transactions";
type SortDir = "asc" | "desc";
type ScopeFilter = "all" | "brokerage" | "city" | "broker";

function compare(a: Office, b: Office, key: SortKey): number {
  switch (key) {
    case "rank":
      return a.officeBuysideRank - b.officeBuysideRank;
    case "brokerage":
      return (a.brokerage ?? "").localeCompare(b.brokerage ?? "");
    case "city":
      return (a.cityArea ?? "").localeCompare(b.cityArea ?? "");
    case "broker":
      return (a.principalBrokerName ?? "").localeCompare(b.principalBrokerName ?? "");
    case "transactions":
      return (b.officeBuysideTransactions ?? -1) - (a.officeBuysideTransactions ?? -1);
  }
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

export default function OfficeRankings() {
  const { state } = useSelectedState();
  const { data: offices, isLoading } = trpc.agents.officeRankings.useQuery({ state });
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    if (!offices) return [];
    const q = query.trim().toLowerCase();
    let list = offices as Office[];
    if (q) {
      list = list.filter(o => {
        const brokerage = (o.brokerage ?? "").toLowerCase();
        const city = (o.cityArea ?? "").toLowerCase();
        const broker = (o.principalBrokerName ?? "").toLowerCase();
        if (scope === "brokerage") return brokerage.includes(q);
        if (scope === "city") return city.includes(q);
        if (scope === "broker") return broker.includes(q);
        return brokerage.includes(q) || city.includes(q) || broker.includes(q);
      });
    }
    const sorted = [...list].sort((a, b) => compare(a, b, sortKey));
    if (sortDir === "desc") sorted.reverse();
    return sorted;
  }, [offices, query, scope, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="max-w-[1500px]">
      {/* Page masthead */}
      <div className="mb-8">
        <p className="eyebrow text-accent mb-2">The League Table</p>
        <h2 className="font-display text-5xl md:text-6xl font-extrabold tracking-tight leading-none">
          Office <span className="italic font-medium">Rankings</span>
        </h2>
        <p className="font-serif-text text-xl italic text-muted-foreground mt-3">
          {offices ? `${offices.length} ${state} offices ranked by production` : "Loading records"}{" "}
          · by estimated annual buyer-side transactions · principal brokers on file
        </p>
      </div>

      {/* Toolbar */}
      <div className="border-y border-foreground/15 py-4 mb-8 flex flex-col md:flex-row gap-4 md:items-center">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by brokerage, city, or principal broker…"
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
        <Select value={scope} onValueChange={v => setScope(v as ScopeFilter)}>
          <SelectTrigger className="rounded-none w-[170px] eyebrow h-9 border-foreground/25">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="all" className="eyebrow">All Fields</SelectItem>
            <SelectItem value="brokerage" className="eyebrow">Brokerage</SelectItem>
            <SelectItem value="city" className="eyebrow">City</SelectItem>
            <SelectItem value="broker" className="eyebrow">Principal Broker</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-none" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-foreground/25 py-20 text-center">
          {offices && offices.length === 0 ? (
            <>
              <p className="font-display text-3xl font-bold mb-2">
                No offices loaded yet for {state}
              </p>
              <p className="font-serif-text text-lg italic text-muted-foreground">
                Office rankings appear once agents with office data are added for this territory.
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-3xl font-bold mb-2">No offices found</p>
              <p className="font-serif-text text-lg italic text-muted-foreground">
                Try a different search term or clear the filter.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="border border-foreground/15 overflow-x-auto bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-foreground/15 hover:bg-transparent">
                <SortHeader label="Rank" k="rank" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-16" />
                <SortHeader label="Brokerage" k="brokerage" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="City" k="city" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Principal Broker" k="broker" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <TableHead className="eyebrow text-muted-foreground">Broker Contact</TableHead>
                <SortHeader label="Buyside / Yr (Est.)" k="transactions" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <TableHead className="eyebrow text-muted-foreground">Our Agents There</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(office => (
                <TableRow
                  key={`${office.officeBuysideRank}-${office.brokerage}-${office.principalBrokerName}`}
                  className="border-foreground/10 hover:bg-secondary/60"
                >
                  <TableCell className="font-display font-bold text-xl">
                    {office.officeBuysideRank}
                  </TableCell>
                  <TableCell className="font-serif-text text-base max-w-[240px]">
                    <span className="line-clamp-2">{office.brokerage || "—"}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{office.cityArea || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <AgentAvatar
                        src={office.principalBrokerHeadshotUrl}
                        name={office.principalBrokerName ?? ""}
                        className="h-11 w-11 shrink-0 border border-foreground/15 text-[0.5rem]"
                      />
                      <div className="min-w-0">
                        <p className="font-display font-bold text-base leading-tight whitespace-nowrap">
                          {office.principalBrokerName || "—"}
                        </p>
                        {office.principalBrokerTitle && (
                          <p className="text-xs text-muted-foreground leading-tight line-clamp-1 max-w-[180px]">
                            {office.principalBrokerTitle}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="space-y-0.5">
                      {office.principalBrokerPhone && (
                        <a
                          href={`tel:${office.principalBrokerPhone}`}
                          className="flex items-center gap-1.5 whitespace-nowrap hover:text-accent"
                        >
                          <Phone className="h-3 w-3 text-accent shrink-0" />
                          {office.principalBrokerPhone}
                        </a>
                      )}
                      {office.principalBrokerEmail && (
                        <a
                          href={`mailto:${office.principalBrokerEmail}`}
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-accent break-all text-xs"
                        >
                          <Mail className="h-3 w-3 text-accent shrink-0" />
                          {office.principalBrokerEmail}
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-display font-bold text-lg">
                    {office.officeBuysideTransactions != null ? `~${office.officeBuysideTransactions}` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap max-w-[220px]">
                      {office.agents.map(a => (
                        <span key={a.id} className="flex items-center gap-1.5" title={a.fullName}>
                          <AgentAvatar
                            src={a.headshotUrl}
                            name={a.fullName}
                            className="h-7 w-7 shrink-0 border border-foreground/15 text-[0.4rem]"
                          />
                          <span className="text-xs whitespace-nowrap">{a.fullName}</span>
                        </span>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
