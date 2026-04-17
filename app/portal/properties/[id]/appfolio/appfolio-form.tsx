"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
  const [plan, setPlan] = useState(initial?.plan ?? "");
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
        plan: plan || undefined,
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
        `Synced ${syncedCount} listings${
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
          The "{instanceSubdomain || "example"}" in
          https://{instanceSubdomain || "example"}.appfolio.com.
        </span>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs tracking-widest uppercase opacity-70">
            Plan
          </span>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="border rounded px-3 py-2 text-sm bg-background"
          >
            <option value="">Unknown</option>
            <option value="core">Core</option>
            <option value="plus">Plus</option>
            <option value="max">Max</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs tracking-widest uppercase opacity-70">
            Property group filter
          </span>
          <input
            value={propertyGroupFilter}
            onChange={(e) => setPropertyGroupFilter(e.target.value)}
            placeholder="Telegraph Commons"
            className="border rounded px-3 py-2 text-sm bg-background"
          />
        </label>
      </div>

      <label className="flex items-center justify-between gap-3 border rounded-md px-3 py-2 text-sm">
        <div>
          <span>Use embed-scrape mode</span>
          <p className="text-xs opacity-60 mt-0.5">
            Works for any AppFolio tenant, no API key needed. Falls back
            automatically if REST isn't configured.
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
          AppFolio REST API key (Plus plan)
        </span>
        <input
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={
            initial?.hasApiKey
              ? "Key on file, enter a new one to replace"
              : "sk_live_..."
          }
          className="border rounded px-3 py-2 text-sm bg-background"
        />
        <span className="text-xs opacity-60">
          Encrypted at rest before saving.
        </span>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex items-center justify-between gap-3 border rounded-md px-3 py-2 text-sm">
          <span>Auto-sync on a schedule</span>
          <input
            type="checkbox"
            checked={autoSyncEnabled}
            onChange={(e) => setAutoSyncEnabled(e.target.checked)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs tracking-widest uppercase opacity-70">
            Sync every (minutes)
          </span>
          <input
            type="number"
            min={15}
            max={1440}
            value={syncFrequencyMinutes}
            onChange={(e) =>
              setSyncFrequencyMinutes(parseInt(e.target.value, 10) || 60)
            }
            className="border rounded px-3 py-2 text-sm bg-background"
          />
        </label>
      </div>

      <div className="flex items-center gap-3 pt-3 border-t">
        <button
          type="submit"
          disabled={pending}
          className="bg-foreground text-background px-4 py-2 text-xs font-semibold rounded disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={runSync}
          disabled={syncPending}
          className="border px-4 py-2 text-xs font-semibold rounded disabled:opacity-40"
        >
          {syncPending ? "Syncing…" : "Sync now"}
        </button>
        {saved ? (
          <span className="text-xs text-emerald-700">Saved</span>
        ) : null}
        {syncResult ? (
          <span className="text-xs text-emerald-700">{syncResult}</span>
        ) : null}
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : null}
        {initial?.lastSyncAt ? (
          <span className="text-xs opacity-60 ml-auto">
            Last synced {new Date(initial.lastSyncAt).toLocaleString()}
            {initial?.syncStatus ? ` · ${initial.syncStatus}` : ""}
          </span>
        ) : null}
      </div>
    </form>
  );
}
