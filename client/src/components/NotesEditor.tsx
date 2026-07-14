import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function NotesEditor({
  agentId,
  initialNotes,
  compact = false,
}: {
  agentId: number;
  initialNotes: string | null;
  compact?: boolean;
}) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [dirty, setDirty] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!dirty) setValue(initialNotes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNotes]);

  const mutation = trpc.agents.updateNotes.useMutation({
    onSuccess: () => {
      setDirty(false);
      utils.agents.list.invalidate();
      toast.success("Notes saved");
    },
    onError: err => toast.error(err.message || "Failed to save notes"),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <PenLine className="h-3.5 w-3.5 text-accent" />
        <span className="eyebrow text-muted-foreground">Notes</span>
      </div>
      <Textarea
        value={value}
        onChange={e => {
          setValue(e.target.value);
          setDirty(true);
        }}
        placeholder={'e.g. "Called 7/10 - interested in partnership"'}
        rows={compact ? 2 : 3}
        className="rounded-none border-input bg-background/60 font-serif-text text-base resize-y"
      />
      {dirty && (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-none eyebrow h-8"
            onClick={() => {
              setValue(initialNotes ?? "");
              setDirty(false);
            }}
          >
            Discard
          </Button>
          <Button
            size="sm"
            disabled={mutation.isPending}
            className="rounded-none eyebrow h-8 bg-foreground text-background hover:bg-accent hover:text-accent-foreground"
            onClick={() => mutation.mutate({ id: agentId, notes: value })}
          >
            {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Note"}
          </Button>
        </div>
      )}
    </div>
  );
}
