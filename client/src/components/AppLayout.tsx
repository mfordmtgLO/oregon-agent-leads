import { Button } from "@/components/ui/button";
import { useAppSession } from "@/hooks/useAppSession";
import Login from "@/pages/Login";
import { LayoutGrid, Loader2, LogOut, UserPlus } from "lucide-react";
import { Link, useLocation } from "wouter";

const navItems = [
  { label: "Agent Index", path: "/", icon: LayoutGrid },
  { label: "Add Agent", path: "/add", icon: UserPlus },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading, authenticated, logout } = useAppSession();
  const [location] = useLocation();

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
              Oregon
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
              Oregon Agent Leads — Mike Ford
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
