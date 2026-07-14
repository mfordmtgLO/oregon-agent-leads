import AgentAvatar from "@/components/AgentAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const emptyForm = {
  fullName: "",
  brokerage: "",
  cityArea: "",
  phone: "",
  email: "",
  websiteBioUrl: "",
  zillowUrl: "",
  headshotUrl: "",
  notes: "",
};

export default function AddAgent() {
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const uploadMutation = trpc.agents.uploadHeadshot.useMutation();
  const createMutation = trpc.agents.create.useMutation({
    onSuccess: () => {
      utils.agents.list.invalidate();
      toast.success(`${form.fullName} added to the index`);
      setLocation("/");
    },
    onError: err => toast.error(err.message || "Failed to add agent"),
  });

  const set = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8MB");
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { url } = await uploadMutation.mutateAsync({
        base64,
        fileName: file.name,
        mimeType: file.type,
      });
      setForm(f => ({ ...f, headshotUrl: url }));
      toast.success("Headshot uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      toast.error("Agent name is required");
      return;
    }
    createMutation.mutate(form);
  };

  const fieldClass =
    "rounded-none border-0 border-b border-input bg-transparent px-0 focus-visible:ring-0 focus-visible:border-accent";

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <p className="eyebrow text-accent mb-2">New Entry</p>
        <h2 className="font-display text-5xl md:text-6xl font-extrabold tracking-tight leading-none">
          Add an <span className="italic font-medium">Agent</span>
        </h2>
        <p className="font-serif-text text-xl italic text-muted-foreground mt-3">
          Record a new relationship in the index. Only the name is required.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="border border-foreground/15 bg-card p-8 md:p-10 space-y-8">
        {/* Headshot */}
        <div className="flex flex-col sm:flex-row gap-6 sm:items-start">
          <AgentAvatar
            src={form.headshotUrl || null}
            name={form.fullName || "New Agent"}
            className="h-32 w-32 shrink-0 border border-foreground/15"
          />
          <div className="flex-1 space-y-3">
            <Label className="eyebrow text-muted-foreground">Headshot</Label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-none eyebrow border-foreground/25 hover:bg-foreground hover:text-background"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Image
              </Button>
              <span className="eyebrow text-muted-foreground/60">or paste a URL below</span>
            </div>
            <Input
              value={form.headshotUrl}
              onChange={set("headshotUrl")}
              placeholder="https://example.com/headshot.jpg"
              className={fieldClass}
            />
          </div>
        </div>

        <div className="rule-h" />

        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="fullName" className="eyebrow text-muted-foreground">
              Full Name <span className="text-accent">*</span>
            </Label>
            <Input id="fullName" value={form.fullName} onChange={set("fullName")} placeholder="Jane Doe" required className={`${fieldClass} font-display text-2xl font-bold`} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brokerage" className="eyebrow text-muted-foreground">Brokerage</Label>
            <Input id="brokerage" value={form.brokerage} onChange={set("brokerage")} placeholder="Keller Williams Realty" className={fieldClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cityArea" className="eyebrow text-muted-foreground">City / Area</Label>
            <Input id="cityArea" value={form.cityArea} onChange={set("cityArea")} placeholder="Portland, OR" className={fieldClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="eyebrow text-muted-foreground">Phone</Label>
            <Input id="phone" value={form.phone} onChange={set("phone")} placeholder="(503) 555-0100" className={fieldClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="eyebrow text-muted-foreground">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={set("email")} placeholder="jane@brokerage.com" className={fieldClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="websiteBioUrl" className="eyebrow text-muted-foreground">Website / Bio URL</Label>
            <Input id="websiteBioUrl" value={form.websiteBioUrl} onChange={set("websiteBioUrl")} placeholder="https://janedoe.com" className={fieldClass} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zillowUrl" className="eyebrow text-muted-foreground">Zillow URL</Label>
            <Input id="zillowUrl" value={form.zillowUrl} onChange={set("zillowUrl")} placeholder="https://www.zillow.com/profile/janedoe" className={fieldClass} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes" className="eyebrow text-muted-foreground">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={set("notes")}
            placeholder={'e.g. "Met at conference — wants to co-market open houses"'}
            rows={4}
            className="rounded-none border-input bg-background/60 font-serif-text text-base"
          />
        </div>

        <div className="rule-h" />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setLocation("/")}
            className="rounded-none eyebrow"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || uploading}
            className="rounded-none eyebrow bg-foreground text-background hover:bg-accent hover:text-accent-foreground h-11 px-8"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Add to Index"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
