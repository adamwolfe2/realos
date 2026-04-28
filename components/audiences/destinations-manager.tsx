"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  FileDown,
  Webhook,
  Facebook,
  BarChart3,
} from "lucide-react";
import {
  createAudienceDestination,
  deleteAudienceDestination,
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

export function DestinationsManager({
  destinations,
  adAccounts,
}: {
  destinations: DestRow[];
  adAccounts: AdAccountOpt[];
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

      {destinations.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-md">
          No destinations yet. Add a webhook URL or pick a connected ad
          account to start pushing.
        </div>
      ) : (
        <div className="-mx-5 -mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="text-left font-semibold py-2 px-5">Destination</th>
                <th className="text-left font-semibold py-2 px-3">Type</th>
                <th className="text-left font-semibold py-2 px-3">Target</th>
                <th className="text-right font-semibold py-2 px-3">Last used</th>
                <th className="px-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {destinations.map((d) => (
                <DestinationRow key={d.id} destination={d} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DestinationRow({ destination }: { destination: DestRow }) {
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

  return (
    <tr className="hover:bg-muted/40 transition-colors">
      <td className="py-3 px-5 align-top">
        <div className="flex items-center gap-2.5 min-w-0">
          <DestinationIcon type={destination.type} />
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
        {prettyType(destination.type)}
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

function AddDestinationForm({
  adAccounts,
  onDone,
}: {
  adAccounts: AdAccountOpt[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<string>("CSV_DOWNLOAD");
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
        type: type as
          | "CSV_DOWNLOAD"
          | "WEBHOOK"
          | "META_CUSTOM_AUDIENCE"
          | "GOOGLE_CUSTOMER_MATCH",
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
      className="bg-muted/30 border border-border rounded-md p-4 space-y-3"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="d-type" className="text-xs">
            Destination type
          </Label>
          <select
            id="d-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
          >
            <option value="CSV_DOWNLOAD">CSV download</option>
            <option value="WEBHOOK">Webhook</option>
            <option value="META_CUSTOM_AUDIENCE">
              Meta Custom Audience (preview)
            </option>
            <option value="GOOGLE_CUSTOMER_MATCH">
              Google Customer Match (preview)
            </option>
          </select>
        </div>
        <div>
          <Label htmlFor="d-name" className="text-xs">
            Label
          </Label>
          <Input
            id="d-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Berkeley search retargeting"
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
              Integrations first.
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

      <div className="flex items-center gap-2 pt-1">
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

function DestinationIcon({ type }: { type: string }) {
  const Icon =
    type === "CSV_DOWNLOAD"
      ? FileDown
      : type === "WEBHOOK"
        ? Webhook
        : type === "META_CUSTOM_AUDIENCE"
          ? Facebook
          : type === "GOOGLE_CUSTOMER_MATCH"
            ? BarChart3
            : Webhook;
  const tone =
    type === "CSV_DOWNLOAD" || type === "WEBHOOK"
      ? "text-primary bg-primary/10"
      : "text-muted-foreground bg-muted";
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md shrink-0",
        tone,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function prettyType(t: string): string {
  return t.toLowerCase().replace(/_/g, " ");
}
