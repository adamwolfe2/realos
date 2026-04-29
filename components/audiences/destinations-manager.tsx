"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  FileDown,
  Webhook as WebhookIcon,
  Send,
  Download,
  Check,
} from "lucide-react";
import {
  MetaMark,
  GoogleMark,
} from "@/components/platform/artifacts/brand-logos";
import {
  createAudienceDestination,
  deleteAudienceDestination,
  pushSegmentToDestination,
} from "@/lib/actions/audiences";

type DestRow = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  webhookUrl: string | null;
  adAccountLabel: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

type AdAccountOpt = { id: string; label: string };

type SegmentOpt = { id: string; name: string; memberCount: number };

type DestinationKind = {
  id: "CSV_DOWNLOAD" | "WEBHOOK" | "META_CUSTOM_AUDIENCE" | "GOOGLE_CUSTOMER_MATCH";
  label: string;
  description: string;
  badge: "Live" | "Preview";
  logo: React.ReactNode;
  accent: string;
};

const DESTINATION_KINDS: DestinationKind[] = [
  {
    id: "CSV_DOWNLOAD",
    label: "CSV download",
    description: "Stream the segment as a CSV right back to your browser.",
    badge: "Live",
    logo: <FileDown className="h-5 w-5 text-foreground" />,
    accent: "bg-blue-50",
  },
  {
    id: "WEBHOOK",
    label: "Webhook",
    description: "Signed JSON POST to any HTTPS endpoint. HMAC SHA-256.",
    badge: "Live",
    logo: <WebhookIcon className="h-5 w-5 text-foreground" />,
    accent: "bg-blue-50",
  },
  {
    id: "META_CUSTOM_AUDIENCE",
    label: "Meta Custom Audience",
    description: "Push members directly into a Meta Ads custom audience.",
    badge: "Preview",
    logo: <MetaMark size={20} />,
    accent: "bg-[#E7F0FE]",
  },
  {
    id: "GOOGLE_CUSTOMER_MATCH",
    label: "Google Customer Match",
    description: "Send hashed members to a Google Ads customer match list.",
    badge: "Preview",
    logo: <GoogleMark size={20} />,
    accent: "bg-[#FFF4E5]",
  },
];

export function DestinationsManager({
  destinations,
  adAccounts,
  segments,
}: {
  destinations: DestRow[];
  adAccounts: AdAccountOpt[];
  segments: SegmentOpt[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end -mt-1 -mb-1">
        <Button
          variant={adding ? "outline" : "default"}
          size="sm"
          onClick={() => setAdding((v) => !v)}
          className="rounded-md"
        >
          <Plus />
          {adding ? "Cancel" : "Add destination"}
        </Button>
      </div>

      {adding ? (
        <AddDestinationForm
          adAccounts={adAccounts}
          onDone={() => setAdding(false)}
        />
      ) : null}

      {destinations.length === 0 && !adding ? (
        <div className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-md">
          No destinations yet. Add a webhook URL or pick a connected ad
          account to start pushing.
        </div>
      ) : null}

      {destinations.length > 0 ? (
        <div className="-mx-5 -mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="text-left font-semibold py-2 px-5">Destination</th>
                <th className="text-left font-semibold py-2 px-3">Type</th>
                <th className="text-left font-semibold py-2 px-3">Target</th>
                <th className="text-right font-semibold py-2 px-3">Last used</th>
                <th className="text-right font-semibold py-2 px-3">Run</th>
                <th className="px-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {destinations.map((d) => (
                <DestinationRow
                  key={d.id}
                  destination={d}
                  segments={segments}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function DestinationRow({
  destination,
  segments,
}: {
  destination: DestRow;
  segments: SegmentOpt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm(`Delete destination "${destination.name}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAudienceDestination(destination.id);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  const kind =
    DESTINATION_KINDS.find((k) => k.id === destination.type) ??
    DESTINATION_KINDS[0];

  const isPreviewOnly =
    destination.type === "META_CUSTOM_AUDIENCE" ||
    destination.type === "GOOGLE_CUSTOMER_MATCH";

  return (
    <tr className="hover:bg-muted/40 transition-colors">
      <td className="py-3 px-5 align-top">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0",
              kind.accent,
            )}
          >
            {kind.logo}
          </span>
          <div className="min-w-0">
            <div className="font-medium truncate">{destination.name}</div>
            {!destination.enabled ? (
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                Disabled
              </div>
            ) : null}
          </div>
        </div>
        {error ? (
          <p className="text-xs text-destructive mt-2">{error}</p>
        ) : null}
      </td>
      <td className="py-3 px-3 align-top text-muted-foreground">
        {kind.label}
      </td>
      <td className="py-3 px-3 align-top">
        <div className="text-xs text-muted-foreground font-mono truncate max-w-xs">
          {destination.webhookUrl ?? destination.adAccountLabel ?? "—"}
        </div>
      </td>
      <td className="py-3 px-3 align-top text-right text-xs text-muted-foreground tabular-nums">
        {destination.lastUsedAt
          ? new Date(destination.lastUsedAt).toLocaleDateString()
          : "—"}
      </td>
      <td className="py-3 px-3 align-top text-right">
        <RunDestinationButton
          destination={destination}
          segments={segments}
          disabled={isPreviewOnly || !destination.enabled}
        />
      </td>
      <td className="py-3 px-5 align-top text-right">
        <button
          onClick={handleDelete}
          disabled={pending}
          aria-label="Delete destination"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-rose-50 hover:text-rose-700 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

type RunStatus =
  | { kind: "idle" }
  | { kind: "pushing"; segmentId: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function RunDestinationButton({
  destination,
  segments,
  disabled,
}: {
  destination: DestRow;
  segments: SegmentOpt[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<RunStatus>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (status.kind === "pushing") return;
      const node = wrapperRef.current;
      if (node && !node.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && status.kind !== "pushing") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, status.kind]);

  const isCsv = destination.type === "CSV_DOWNLOAD";

  function handlePush(segment: SegmentOpt) {
    setStatus({ kind: "pushing", segmentId: segment.id });
    startTransition(async () => {
      const result = await pushSegmentToDestination({
        segmentId: segment.id,
        destinationId: destination.id,
      });
      if (!result.ok) {
        setStatus({ kind: "error", message: result.error });
        return;
      }
      if (result.csvBase64 && result.filename) {
        triggerCsvDownload(result.csvBase64, result.filename);
      }
      setStatus({
        kind: "success",
        message: `${result.memberCount.toLocaleString()} ${
          isCsv ? "downloaded" : "pushed"
        }`,
      });
      router.refresh();
      window.setTimeout(() => {
        setStatus({ kind: "idle" });
        setOpen(false);
      }, 2200);
    });
  }

  if (disabled) {
    return (
      <span className="text-[11px] text-muted-foreground">—</span>
    );
  }

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!open) setStatus({ kind: "idle" });
          setOpen((v) => !v);
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
          open
            ? "bg-primary text-primary-foreground"
            : "text-foreground bg-muted hover:bg-primary/10 hover:text-primary",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={
          isCsv
            ? `Download ${destination.name}`
            : `Push to ${destination.name}`
        }
      >
        {isCsv ? (
          <Download className="h-3 w-3" />
        ) : (
          <Send className="h-3 w-3" />
        )}
        {isCsv ? "Download" : "Push now"}
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={`Segments for ${destination.name}`}
          className={cn(
            "absolute right-0 top-full mt-1 z-30 w-72 rounded-md border border-border bg-card shadow-lg",
            "py-1",
          )}
        >
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
            {isCsv ? "Pick a segment to download" : "Pick a segment to push"}
          </div>

          {segments.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              No segments yet.{" "}
              <Link
                href="/portal/audiences"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Add a segment
              </Link>{" "}
              first.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {segments.map((s) => {
                const isPushing =
                  status.kind === "pushing" && status.segmentId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handlePush(s)}
                    disabled={pending}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
                      "hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        {s.memberCount.toLocaleString()} members
                      </div>
                    </div>
                    {isPushing ? <Spinner /> : null}
                  </button>
                );
              })}
            </div>
          )}

          {status.kind === "success" ? (
            <div className="border-t border-border px-3 py-2 text-[11px] text-emerald-700 flex items-start gap-1.5">
              <Check className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{status.message}</span>
            </div>
          ) : null}
          {status.kind === "error" ? (
            <div className="border-t border-border px-3 py-2 text-[11px] text-rose-700">
              {status.message}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  );
}

function triggerCsvDownload(base64: string, filename: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function AddDestinationForm({
  adAccounts,
  onDone,
}: {
  adAccounts: AdAccountOpt[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<DestinationKind["id"]>("CSV_DOWNLOAD");
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createAudienceDestination({
        type,
        name,
        webhookUrl: type === "WEBHOOK" ? webhookUrl : undefined,
        webhookSecret: type === "WEBHOOK" ? webhookSecret : undefined,
        adAccountId:
          type === "META_CUSTOM_AUDIENCE" ||
          type === "GOOGLE_CUSTOMER_MATCH"
            ? adAccountId
            : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-muted/30 border border-border rounded-md p-5 space-y-4"
    >
      <div>
        <Label className="text-xs">Pick a destination</Label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DESTINATION_KINDS.map((kind) => {
            const active = type === kind.id;
            return (
              <button
                key={kind.id}
                type="button"
                onClick={() => setType(kind.id)}
                className={cn(
                  "text-left p-4 rounded-md border transition-all",
                  active
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border bg-card hover:border-foreground/30",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-md",
                      kind.accent,
                    )}
                  >
                    {kind.logo}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
                      kind.badge === "Live"
                        ? "text-emerald-700 bg-emerald-50"
                        : "text-amber-700 bg-amber-50",
                    )}
                  >
                    {kind.badge}
                  </span>
                </div>
                <div className="mt-3 text-sm font-semibold text-foreground">
                  {kind.label}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                  {kind.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <Label htmlFor="d-name" className="text-xs">
            Label
          </Label>
          <Input
            id="d-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              type === "CSV_DOWNLOAD"
                ? "Berkeley team CSV export"
                : type === "WEBHOOK"
                  ? "HubSpot Sync via Zapier"
                  : type === "META_CUSTOM_AUDIENCE"
                    ? "Bay Area retargeting"
                    : "Customer Match — Active Buyers"
            }
            className="mt-1"
            required
          />
        </div>
      </div>

      {type === "WEBHOOK" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="d-url" className="text-xs">
              Webhook URL (https only)
            </Label>
            <Input
              id="d-url"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="d-secret" className="text-xs">
              Signing secret (optional)
            </Label>
            <Input
              id="d-secret"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Leave blank to autogenerate"
              className="mt-1"
            />
          </div>
        </div>
      ) : null}

      {type === "META_CUSTOM_AUDIENCE" ||
      type === "GOOGLE_CUSTOMER_MATCH" ? (
        <div>
          <Label htmlFor="d-acct" className="text-xs">
            Ad account
          </Label>
          {adAccounts.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-1">
              No connected ad accounts yet. Connect one in Settings →
              Integrations first, then come back here.
            </p>
          ) : (
            <select
              id="d-acct"
              value={adAccountId}
              onChange={(e) => setAdAccountId(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
              required
            >
              <option value="">Choose…</option>
              {adAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2 pt-1 border-t border-border -mx-5 px-5 pt-3">
        <Button
          type="submit"
          disabled={pending}
          size="sm"
          className="rounded-md"
        >
          {pending ? "Saving…" : "Save destination"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDone}
          className="rounded-md"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
