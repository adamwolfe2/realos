"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Initial = {
  instanceSubdomain: string;
  plan: string;
  propertyGroupFilter: string | null;
  useEmbedFallback: boolean;
  autoSyncEnabled: boolean;
  syncFrequencyMinutes: number;
  hasApiKey: boolean;
  lastSyncAt: string | null;
  syncStatus: string | null;
} | null;

export function AppFolioForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [syncPending, startSync] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const [instanceSubdomain, setInstanceSubdomain] = useState(
    initial?.instanceSubdomain ?? ""
  );
  const [propertyGroupFilter, setPropertyGroupFilter] = useState(
    initial?.propertyGroupFilter ?? ""
  );
  const [useEmbedFallback, setUseEmbedFallback] = useState(
    initial?.useEmbedFallback ?? true
  );
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(
    initial?.autoSyncEnabled ?? true
  );
  const [syncFrequencyMinutes, setSyncFrequencyMinutes] = useState(
    initial?.syncFrequencyMinutes ?? 60
  );
  const [apiKey, setApiKey] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const body: Record<string, unknown> = {
        instanceSubdomain: instanceSubdomain.trim(),
        propertyGroupFilter: propertyGroupFilter.trim() || null,
        useEmbedFallback,
        autoSyncEnabled,
        syncFrequencyMinutes,
      };
      if (apiKey.trim()) body.apiKey = apiKey.trim();

      const res = await fetch("/api/tenant/appfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const rb = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(rb.error ?? "Save failed");
        return;
      }
      setSaved(true);
      setApiKey("");
      router.refresh();
    });
  }

  function runSync() {
    setSyncResult(null);
    setError(null);
    startSync(async () => {
      const res = await fetch("/api/tenant/appfolio/sync", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Sync failed");
        return;
      }
      const syncedCount = body.synced ?? 0;
      setSyncResult(
        `Synced ${syncedCount} listing${syncedCount === 1 ? "" : "s"}${
          body.skippedUnknownProperty
            ? `, skipped ${body.skippedUnknownProperty} with unmatched property groups`
            : ""
        }.`
      );
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 border rounded-md p-5">
      <div className="rounded-md bg-muted/40 border border-border px-3 py-2.5 text-xs text-muted-foreground">
        Sync behavior for this property. API credentials are managed in{" "}
        <Link
          href="/portal/settings/integrations"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Settings → Integrations
        </Link>
        .
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs tracking-widest uppercase opacity-70">
          AppFolio subdomain
        </span>
        <input
          value={instanceSubdomain}
          onChange={(e) => setInstanceSubdomain(e.target.value)}
          placeholder="sgrealestate"
          className="border rounded px-3 py-2 text-sm bg-background"
          required
        />
        <span className="text-xs opacity-60">
          The <strong>{instanceSubdomain || "example"}</strong> part of
          https://{instanceSubdomain || "example"}.appfolio.com.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs tracking-widest uppercase opacity-70">
          Property group filter
        </span>
        <input
          value={propertyGroupFilter}
          onChange={(e) => setPropertyGroupFilter(e.target.value)}
          placeholder="e.g. 2490 Channing"
          className="border rounded px-3 py-2 text-sm bg-background"
        />
        <span className="text-xs opacity-60">
          If your AppFolio account manages multiple properties, enter a snippet of this
          property's address. Only units whose AppFolio group name contains this string
          will sync. Leave blank to sync all units on the account.
        </span>
      </label>

      <label className="flex items-center justify-between gap-3 border rounded-md px-3 py-2 text-sm">
        <div>
          <span>Use embed-scrape mode</span>
          <p className="text-xs opacity-60 mt-0.5">
            Syncs public listings without an API key. Enable this if you don't
            have REST credentials — slower but always works.
          </p>
        </div>
        <input
          type="checkbox"
          checked={useEmbedFallback}
          onChange={(e) => setUseEmbedFallback(e.target.checked)}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs tracking-widest uppercase opacity-70">
          AppFolio REST API key (Plus/Max plan)
        </span>
        <input
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={
            initial?.hasApiKey
              ? "Key on file — enter a new one to rotate"
              : "Paste your AppFolio API key"
          }
          className="border rounded px-3 py-2 text-sm bg-background"
        />
        <span className="text-xs opacity-60">
          Found in AppFolio → Settings → API Settings → Reports API. Stored
          encrypted.
          {initial?.hasApiKey
            ? " Saving a new key immediately replaces the existing one."
            : ""}
        </span>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex items-center justify-between gap-3 border rounded-md px-3 py-2 text-sm">
          <div>
            <span>Auto-sync on a schedule</span>
            <p className="text-xs opacity-60 mt-0.5">
              Pulls listings from AppFolio automatically.
            </p>
          </div>
          <input
            type="checkbox"
            checked={autoSyncEnabled}
            onChange={(e) => setAutoSyncEnabled(e.target.checked)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs tracking-widest uppercase opacity-70">
            Sync frequency (minutes)
          </span>
          <input
            type="number"
            min={15}
            max={1440}
            disabled={!autoSyncEnabled}
            value={syncFrequencyMinutes}
            onChange={(e) =>
              setSyncFrequencyMinutes(parseInt(e.target.value, 10) || 60)
            }
            className="border rounded px-3 py-2 text-sm bg-background disabled:opacity-40"
          />
          <span className="text-xs opacity-60">
            {autoSyncEnabled
              ? `Syncs every ${syncFrequencyMinutes} min. Range: 15–1440 (24h).`
              : "Enable auto-sync to set frequency."}
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-3 border-t">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-4 py-2 text-xs font-semibold rounded disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={runSync}
          disabled={syncPending}
          className="border px-4 py-2 text-xs font-semibold rounded disabled:opacity-40 hover:bg-muted/30 transition-colors"
        >
          {syncPending ? "Syncing…" : "Sync now"}
        </button>
        {saved && (
          <span className="text-xs text-emerald-700 font-medium">
            Settings saved.
          </span>
        )}
        {syncResult && (
          <span className="text-xs text-emerald-700">{syncResult}</span>
        )}
        {error && (
          <span className="text-xs text-destructive">{error}</span>
        )}
        {initial?.lastSyncAt && (
          <span className="text-xs opacity-60 ml-auto">
            Last synced {new Date(initial.lastSyncAt).toLocaleString()}
            {initial?.syncStatus ? ` · ${initial.syncStatus}` : ""}
          </span>
        )}
      </div>
    </form>
  );
}
