import { useEffect, useState } from "react";
import { Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

export default function PrincipalBrokerNotesEditor({ agentId, initialNotes, compact = false }: { agentId: number; initialNotes: string | null; compact?: boolean }) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [dirty, setDirty] = useState(false);
  const utils = trpc.useUtils();
  useEffect(() => { if (!dirty) setValue(initialNotes ?? ""); }, [initialNotes, dirty]);
  const mutation = trpc.agents.updatePrincipalBrokerNotes.useMutation({
    onSuccess: () => { setDirty(false); utils.agents.list.invalidate(); toast.success("Office notes saved"); },
    onError: error => toast.error(error.message || "Failed to save office notes"),
  });
  return <div className={compact ? "mt-3" : "mt-4"}>
    <div className="flex items-center gap-2 mb-2"><PenLine className="h-3.5 w-3.5 text-accent" /><span className="eyebrow text-muted-foreground">Office Notes</span></div>
    <Textarea value={value} onChange={event => { setValue(event.target.value); setDirty(true); }} rows={compact ? 2 : 4} placeholder="Log an office-level conversation, referral opportunity, or follow-up…" className="rounded-none bg-background/60 font-serif-text text-base" />
    {(dirty || value) && <div className="flex justify-end gap-2 mt-2"><Button type="button" size="sm" variant="outline" className="rounded-none eyebrow" onClick={() => { setValue(initialNotes ?? ""); setDirty(false); }}>Cancel</Button><Button type="button" size="sm" disabled={mutation.isPending || !dirty} className="rounded-none eyebrow bg-foreground text-background" onClick={() => mutation.mutate({ agentId, notes: value })}>{mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Office Note"}</Button></div>}
  </div>;
}
