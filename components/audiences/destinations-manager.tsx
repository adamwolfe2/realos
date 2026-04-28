"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileDown, Webhook, Facebook, BarChart3 } from "lucide-react";
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Connected destinations</h2>
        <Button
          variant="default"
          onClick={() => setAdding((v) => !v)}
          size="sm"
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
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No destinations yet. Add a webhook URL or pick a connected ad
            account to start pushing.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {destinations.map((d) => (
            <DestinationRow key={d.id} destination={d} />
          ))}
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
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <DestinationIcon type={destination.type} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium truncate">{destination.name}</p>
              <Badge variant="secondary" className="shrink-0">
                {prettyType(destination.type)}
              </Badge>
              {!destination.enabled ? (
                <Badge variant="outline" className="shrink-0">
                  Disabled
                </Badge>
              ) : null}
            </div>
            {destination.webhookUrl ? (
              <p className="text-xs text-muted-foreground font-mono truncate mt-1">
                {destination.webhookUrl}
              </p>
            ) : null}
            {destination.adAccountLabel ? (
              <p className="text-xs text-muted-foreground mt-1">
                {destination.adAccountLabel}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground mt-1">
              {destination.lastUsedAt
                ? `Last used ${new Date(destination.lastUsedAt).toLocaleString()}`
                : `Created ${new Date(destination.createdAt).toLocaleDateString()}`}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDelete}
          disabled={pending}
          aria-label="Delete destination"
        >
          <Trash2 />
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive mt-2">{error}</p>
      ) : null}
    </Card>
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
    <Card className="p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="d-type" className="text-xs">
            Destination type
          </Label>
          <select
            id="d-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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

        {type === "WEBHOOK" ? (
          <>
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
                Signing secret (optional, autogenerated if blank)
              </Label>
              <Input
                id="d-secret"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Leave blank to autogenerate"
                className="mt-1"
              />
            </div>
          </>
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
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save destination"}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function DestinationIcon({ type }: { type: string }) {
  const cls = "h-5 w-5 text-muted-foreground shrink-0 mt-0.5";
  switch (type) {
    case "CSV_DOWNLOAD":
      return <FileDown className={cls} />;
    case "WEBHOOK":
      return <Webhook className={cls} />;
    case "META_CUSTOM_AUDIENCE":
      return <Facebook className={cls} />;
    case "GOOGLE_CUSTOMER_MATCH":
      return <BarChart3 className={cls} />;
    default:
      return <Webhook className={cls} />;
  }
}

function prettyType(t: string): string {
  return t.toLowerCase().replace(/_/g, " ");
}
