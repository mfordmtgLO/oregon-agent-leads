import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppSession } from "@/hooks/useAppSession";
import { Loader2, Lock } from "lucide-react";
import { useState } from "react";

export default function Login() {
  const { login } = useAppSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    login.mutate(
      { username, password },
      {
        onError: err => setError(err.message || "Invalid username or password"),
      },
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top rule band */}
      <div className="px-6 md:px-12 pt-8">
        <div className="flex items-end justify-between pb-4">
          <span className="eyebrow text-muted-foreground">Private Dossier</span>
          <span className="eyebrow text-muted-foreground">Est. 2026 · Oregon</span>
        </div>
        <div className="rule-thick" />
      </div>

      <div className="flex-1 grid lg:grid-cols-12 gap-8 px-6 md:px-12 py-10 lg:py-0 items-center max-w-[1400px] w-full mx-auto">
        {/* Editorial masthead — asymmetric left block */}
        <div className="lg:col-span-7 lg:pr-8">
          <p className="eyebrow text-accent mb-6">Mortgage Partnership Intelligence</p>
          <h1 className="font-display text-[clamp(3rem,9vw,7.5rem)] leading-[0.95] font-extrabold tracking-tight text-foreground">
            Oregon
            <br />
            Agent
            <br />
            <span className="italic font-medium">Leads</span>
          </h1>
          <div className="mt-8 flex items-center gap-6">
            <div className="rule-h w-24 bg-foreground/40" />
            <p className="font-serif-text text-2xl md:text-3xl text-muted-foreground italic">
              The sixty most productive buyer&rsquo;s agents in the state
            </p>
          </div>
          <div className="mt-10 hidden lg:flex items-center gap-10 text-muted-foreground">
            <div>
              <p className="font-display text-4xl font-bold text-foreground">60</p>
              <p className="eyebrow mt-1">Ranked Agents</p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div>
              <p className="font-display text-4xl font-bold text-foreground">25</p>
              <p className="eyebrow mt-1">Markets Covered</p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div>
              <p className="font-display text-4xl font-bold text-foreground">2026</p>
              <p className="eyebrow mt-1">RealTrends Verified</p>
            </div>
          </div>
        </div>

        {/* Login card — right block */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto lg:mx-0 lg:justify-self-end">
          <div className="border border-foreground/20 bg-card p-8 md:p-10">
            <div className="flex items-center gap-3 mb-2">
              <Lock className="h-4 w-4 text-accent" />
              <span className="eyebrow text-foreground">Members Only</span>
            </div>
            <h2 className="font-display text-3xl font-bold mb-1">Sign In</h2>
            <p className="font-serif-text text-lg text-muted-foreground italic mb-8">
              Prepared exclusively for Mike Ford
            </p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="eyebrow text-muted-foreground">
                  Username
                </Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="mike.ford"
                  className="rounded-none border-0 border-b border-input bg-transparent px-0 focus-visible:ring-0 focus-visible:border-accent"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="eyebrow text-muted-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="rounded-none border-0 border-b border-input bg-transparent px-0 focus-visible:ring-0 focus-visible:border-accent"
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-destructive border-l-2 border-destructive pl-3">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={login.isPending}
                className="w-full rounded-none h-12 eyebrow bg-foreground text-background hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {login.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Enter the Dashboard"
                )}
              </Button>
            </form>
          </div>
          <p className="eyebrow text-muted-foreground/60 text-center mt-6">
            Confidential — Authorized Access Only
          </p>
        </div>
      </div>

      {/* Bottom rule */}
      <div className="px-6 md:px-12 pb-8">
        <div className="rule-h mb-4" />
        <div className="flex justify-between">
          <span className="eyebrow text-muted-foreground/60">Oregon Agent Leads — Mike Ford</span>
          <span className="eyebrow text-muted-foreground/60">Vol. I</span>
        </div>
      </div>
    </div>
  );
}
