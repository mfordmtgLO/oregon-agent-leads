import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, ExternalLink, LockKeyhole, Save } from "lucide-react";
import { toast } from "sonner";

const modes = [
  ["not_configured", "Not configured"],
  ["api", "Official API"],
  ["oauth", "OAuth / SSO"],
  ["webhook", "Webhook / event hook"],
  ["licensed_export", "Licensed CSV / JSON export"],
] as const;

const defaultMapping = JSON.stringify({
  transactionId: "provider_transaction_id",
  closedAt: "closed_at",
  propertyAddress: "property_address",
  buyerAgent: "buyer_agent_name",
  buyerAgentLicense: "buyer_agent_license",
  loanOfficer: "loan_officer_name",
  loanOfficerNmls: "loan_officer_nmls",
  lender: "lender_name",
  branch: "branch_name",
  loanAmount: "loan_amount",
  purchasePrice: "purchase_price",
  sourceUrl: "source_url",
}, null, 2);

export default function BigPurpleDotSetup() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.bigPurpleDot.status.useQuery();
  const save = trpc.bigPurpleDot.save.useMutation({
    onSuccess: () => { utils.bigPurpleDot.status.invalidate(); toast.success("Big Purple Dot setup saved"); },
    onError: error => toast.error(error.message),
  });
  const [product, setProduct] = useState("BPD Recruit");
  const [mode, setMode] = useState<typeof modes[number][0]>("not_configured");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKeyEnvVar, setApiKeyEnvVar] = useState("BPD_API_KEY");
  const [oauthClientIdEnvVar, setOauthClientIdEnvVar] = useState("BPD_OAUTH_CLIENT_ID");
  const [webhookSecretEnvVar, setWebhookSecretEnvVar] = useState("BPD_WEBHOOK_SECRET");
  const [webhookPath, setWebhookPath] = useState("");
  const [scope, setScope] = useState("Oregon");
  const [history, setHistory] = useState("Historical depth to be confirmed");
  const [threshold, setThreshold] = useState("3");
  const [lookback, setLookback] = useState("365");
  const [mapping, setMapping] = useState(defaultMapping);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!data) return;
    setProduct(data.product ?? "BPD Recruit");
    setMode((data.connectionMode as typeof modes[number][0]) ?? "not_configured");
    setBaseUrl(data.baseUrl ?? "");
    setApiKeyEnvVar(data.apiKeyEnvVar ?? "BPD_API_KEY");
    setOauthClientIdEnvVar(data.oauthClientIdEnvVar ?? "BPD_OAUTH_CLIENT_ID");
    setWebhookSecretEnvVar(data.webhookSecretEnvVar ?? "BPD_WEBHOOK_SECRET");
    setWebhookPath(data.webhookPath ?? "");
    setScope(data.territoryScope ?? "Oregon");
    setHistory(data.historicalDepth ?? "Historical depth to be confirmed");
    setThreshold(String(data.pairingThreshold ?? 3));
    setLookback(String(data.pairingLookbackDays ?? 365));
    setMapping(data.fieldMappingJson ?? defaultMapping);
    setEnabled(Boolean(data.enabled));
  }, [data]);

  function saveSetup() {
    try { JSON.parse(mapping); } catch { toast.error("Field mapping must be valid JSON"); return; }
    save.mutate({ product, connectionMode: mode, baseUrl, apiKeyEnvVar: apiKeyEnvVar || null, oauthClientIdEnvVar: oauthClientIdEnvVar || null, webhookSecretEnvVar: webhookSecretEnvVar || null, webhookPath: webhookPath || null, territoryScope: scope, historicalDepth: history, fieldMappingJson: mapping, pairingThreshold: Number(threshold), pairingLookbackDays: Number(lookback), enabled });
  }

  const readiness = data?.readinessStatus ?? "needs_credentials";
  return <div className="max-w-[1280px]">
    <div className="mb-8"><p className="eyebrow text-accent mb-3">Provider connection studio</p><div className="flex flex-wrap items-end justify-between gap-5"><div><h2 className="font-display text-5xl md:text-6xl font-extrabold leading-[0.95] tracking-tight">Big Purple <span className="italic font-medium">Dot</span></h2><p className="font-serif-text text-lg text-muted-foreground mt-4 max-w-2xl leading-relaxed">Prepare a secure recruiting-intelligence connection for LO, branch, agent, office, and transaction data. This workspace stays inactive until the provider method is confirmed.</p></div><a href="https://www.bigpurpledot.com/" target="_blank" rel="noreferrer" className="eyebrow text-accent inline-flex items-center gap-2">Official site <ExternalLink className="h-3.5 w-3.5" /></a></div><div className="rule-h mt-6" /></div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-foreground/15 border border-foreground/15 mb-8"><div className="bg-card p-5 lg:col-span-2"><div className="flex items-center gap-3"><LockKeyhole className="h-5 w-5 text-accent" /><div><p className="eyebrow text-accent">Secure setup</p><p className="font-serif-text text-sm text-muted-foreground mt-1">No raw password is stored here. Add API/OAuth/webhook secrets later through approved secure configuration.</p></div></div></div><div className="bg-card p-5"><p className="eyebrow text-muted-foreground">Readiness</p><div className="flex items-center gap-2 mt-2">{readiness === "needs_credentials" ? <CircleAlert className="h-4 w-4 text-accent" /> : <CheckCircle2 className="h-4 w-4 text-accent" />}<span className="font-display text-xl font-bold">{readiness.replaceAll("_", " ")}</span></div></div></div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6"><section className="border border-foreground/15 bg-card p-5"><p className="eyebrow text-accent">Connection profile</p><div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4"><Input value={product} onChange={e => setProduct(e.target.value)} placeholder="Product / account" className="rounded-none" /><Select value={mode} onValueChange={v => setMode(v as typeof mode)}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none">{modes.map(([value, label]) => <SelectItem key={value} value={value} className="rounded-none">{label}</SelectItem>)}</SelectContent></Select><Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="Official API base URL (when confirmed)" className="rounded-none" /><Input value={apiKeyEnvVar} onChange={e => setApiKeyEnvVar(e.target.value)} placeholder="API key secret variable name" className="rounded-none" /><Input value={oauthClientIdEnvVar} onChange={e => setOauthClientIdEnvVar(e.target.value)} placeholder="OAuth client ID variable name" className="rounded-none" /><Input value={webhookSecretEnvVar} onChange={e => setWebhookSecretEnvVar(e.target.value)} placeholder="Webhook secret variable name" className="rounded-none" /><Input value={webhookPath} onChange={e => setWebhookPath(e.target.value)} placeholder="Webhook/event path (when confirmed)" className="rounded-none" /><Input value={scope} onChange={e => setScope(e.target.value)} placeholder="Territory scope, e.g. Oregon" className="rounded-none" /><Input value={history} onChange={e => setHistory(e.target.value)} placeholder="Historical depth" className="rounded-none" /></div><label className="flex items-center gap-3 eyebrow mt-5"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Mark connection enabled after provider validation</label><p className="font-serif-text text-xs text-muted-foreground mt-3">These are variable names only, not secrets. Activation is intentionally separate from saving setup. The sync adapter will remain blocked until official endpoint, auth, permissions, and licensed-use terms are confirmed.</p></section>

    <section className="border border-foreground/15 bg-card p-5"><p className="eyebrow text-accent">Pairing intelligence defaults</p><p className="font-serif-text text-sm text-muted-foreground mt-1">These settings control review candidates, not automatic relationship approval.</p><div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4"><Input type="number" min="1" max="50" value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="Shared closing threshold" className="rounded-none" /><Input type="number" min="30" max="730" value={lookback} onChange={e => setLookback(e.target.value)} placeholder="Lookback days" className="rounded-none" /></div><p className="eyebrow text-muted-foreground mt-5 mb-2">Field mapping JSON</p><Textarea value={mapping} onChange={e => setMapping(e.target.value)} className="rounded-none min-h-[270px] font-mono text-xs" /><p className="font-serif-text text-xs text-muted-foreground mt-3">Map provider fields to stable transaction IDs, closing dates, property, LO/NMLS, agent/license, branch, lender, and source URL fields. Raw payloads remain separate from curated records.</p></section></div>

    <div className="flex justify-end mt-6"><Button onClick={saveSetup} disabled={save.isPending || isLoading} className="rounded-none eyebrow"><Save className="h-4 w-4 mr-2" />{save.isPending ? "Saving…" : "Save Big Purple Dot setup"}</Button></div>
  </div>;
}
