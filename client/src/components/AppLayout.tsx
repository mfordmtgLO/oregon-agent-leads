import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSelectedState } from "@/contexts/StateContext";
import { useAppSession } from "@/hooks/useAppSession";
import Login from "@/pages/Login";
import { Building2, Handshake, LayoutGrid, Loader2, LogOut, MapPin, RefreshCw, UserPlus } from "lucide-react";
import { US_STATES, type USState } from "@shared/states";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { buildDirectory } from "@shared/brokerDirectory";
import { useMemo } from "react";

const navItems = [
  { label: "Agent Index", path: "/", icon: LayoutGrid },
  { label: "Office Rankings", path: "/offices", icon: Building2 },
  { label: "Update Agents", path: "/review", icon: RefreshCw },
  { label: "Mortgage Pairings", path: "/pairings", icon: Handshake },
  { label: "Add Agent", path: "/add", icon: UserPlus },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading, authenticated, logout } = useAppSession();
  const { state, setState } = useSelectedState();
  const [location] = useLocation();
  // Record counts per territory: agents plus derived principal broker records.
  const { data: oregonAgents } = trpc.agents.list.useQuery(
    { state: "Oregon" },
    { enabled: authenticated },
  );
  const oregonRecordCount = useMemo(
    () => (oregonAgents ? buildDirectory(oregonAgents).length : null),
    [oregonAgents],
  );
  // Badge the "Update Agents" nav item with how many findings await a decision.
  const { data: pendingQueue } = trpc.verification.queue.useQuery(
    { state },
    { enabled: authenticated },
  );
  const pendingCount = pendingQueue?.length ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-accent" />
          <p className="eyebrow text-muted-foreground mt-4">Loading the dossier</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Editorial sidebar */}
      <aside className="lg:w-64 xl:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-foreground/15 bg-sidebar flex flex-col">
        <div className="p-6 lg:p-8">
          <p className="eyebrow text-accent mb-3">Private Dossier</p>
          <Link href="/">
            <h1 className="font-display text-3xl xl:text-4xl font-extrabold leading-[1.02] tracking-tight cursor-pointer">
              {state}
              <br />
              Agent
              <br />
              <span className="italic font-medium">Leads</span>
            </h1>
          </Link>
          <div className="rule-thick w-12 mt-5" />
          <p className="font-serif-text text-lg italic text-muted-foreground mt-4 leading-snug">
            — Mike Ford
            <br />
            <span className="text-sm not-italic font-sans tracking-wide">
              Mortgage Loan Officer
            </span>
          </p>
          <div className="mt-5">
            <p className="eyebrow text-muted-foreground mb-2 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Territory
            </p>
            <Select value={state} onValueChange={v => setState(v as USState)}>
              <SelectTrigger className="rounded-none border-foreground/25 bg-card eyebrow h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none max-h-72">
                {US_STATES.map(s => (
                  <SelectItem key={s} value={s} className="rounded-none">
                    {s}
                    {s === "Oregon" && oregonRecordCount ? ` · ${oregonRecordCount}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <nav className="px-6 lg:px-8 pb-6 flex lg:flex-col gap-1 lg:gap-2 flex-1">
          <div className="rule-h hidden lg:block mb-5" />
          {navItems.map(item => {
            const active = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <span
                  className={`flex items-center gap-3 py-2.5 px-3 lg:-mx-3 eyebrow transition-colors cursor-pointer ${
                    active
                      ? "text-accent border-l-2 border-accent bg-accent/5"
                      : "text-foreground/70 border-l-2 border-transparent hover:text-foreground hover:border-foreground/30"
                  }`}
                >
                  <item.icon className="h-4 w-4" strokeWidth={1.75} />
                  {item.label}
                  {item.path === "/review" && pendingCount > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 bg-accent text-accent-foreground text-[10px] font-sans font-semibold tracking-wide">
                      {pendingCount}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:block px-8 pb-8">
          <div className="rule-h mb-5" />
          <p className="eyebrow text-muted-foreground/60 mb-4 leading-relaxed">
            RealTrends Verified 2026
            <br />
            Compiled July 2026
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout.mutate()}
            className="rounded-none eyebrow border-foreground/25 hover:bg-foreground hover:text-background w-full"
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Sign Out
          </Button>
        </div>
        {/* Mobile sign-out */}
        <div className="lg:hidden px-6 pb-4">
          <button onClick={() => logout.mutate()} className="eyebrow text-muted-foreground flex items-center gap-2">
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="px-6 md:px-10 pt-6 pb-0">
          <div className="flex items-end justify-between pb-3">
            <span className="eyebrow text-muted-foreground">
              {state} Agent Leads — Mike Ford
            </span>
            <span className="eyebrow text-muted-foreground hidden sm:block">
              {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <div className="rule-h" />
        </header>
        <main className="flex-1 px-6 md:px-10 py-8">{children}</main>
      </div>
    </div>
  );
}
