"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  rescanAdvertiserAction,
  trackAdvertiserAction,
  untrackAdvertiserAction,
} from "@/lib/actions/ad-library";

// ---------------------------------------------------------------------------
// AdLibraryPanel — operator-facing widget on the property detail Ads tab
// (and the org-wide /portal/campaigns page). Lets the operator paste any
// Facebook Page URL or name and immediately see every ad currently
// running in Meta's public Ad Library. Tracks changes over time so the
// next visit shows "3 launched this week, 1 went inactive."
//
// Stack: client component for the form + rescan/untrack interactions.
// All data fetching happens server-side via the action handlers; the
// initial advertisers + ads list is passed in from the server.
// ---------------------------------------------------------------------------

export type AdLibraryAdvertiserView = {
  id: string;
  displayName: string;
  searchKind: "PAGE_ID" | "SEARCH_TERM";
  searchValue: string;
  lastScannedAt: string | null;
  lastScanError: string | null;
  ads: AdLibraryAdView[];
};

export type AdLibraryAdView = {
  id: string;
  externalId: string;
  status: "ACTIVE" | "INACTIVE" | string;
  creativeBody: string | null;
  creativeTitle: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  publisherPlatforms: string[];
  adCreationTime: string | null;
  adDeliveryStart: string | null;
  adDeliveryStop: string | null;
  spendLow: number | null;
  spendHigh: number | null;
  impressionsLow: number | null;
  impressionsHigh: number | null;
  currency: string | null;
};

export function AdLibraryPanel({
  propertyId,
  advertisers,
  configured,
}: {
  /** When set, the form scopes new tracks to this property. */
  propertyId?: string | null;
  advertisers: AdLibraryAdvertiserView[];
  /** Whether META_AD_LIBRARY_TOKEN is configured server-side. */
  configured: boolean;
}) {
  if (!configured) {
    return <NotConfiguredCard />;
  }
  return (
    <div className="space-y-3">
      <TrackForm propertyId={propertyId ?? null} />
      {advertisers.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic px-1">
          No advertisers tracked yet. Paste a Facebook Page URL above to
          surface their public ads.
        </p>
      ) : (
        <div className="space-y-3">
          {advertisers.map((adv) => (
            <AdvertiserCard key={adv.id} advertiser={adv} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotConfiguredCard() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-6 text-center">
      <p className="text-sm font-semibold text-foreground">
        Meta Ad Library not configured
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground max-w-md mx-auto leading-snug">
        Set <code className="text-foreground font-mono">META_AD_LIBRARY_TOKEN</code>{" "}
        on the server to enable live ad-tracking from Meta&apos;s public Ad
        Library. One agency-level token serves every tenant; no per-customer
        credentials required.
      </p>
    </div>
  );
}

function TrackForm({ propertyId }: { propertyId: string | null }) {
  const [raw, setRaw] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!raw.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await trackAdvertiserAction({ raw, propertyId });
      if (!result.ok) {
        setError(result.error);
      } else {
        setRaw("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Track failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-border bg-card px-3 py-2 flex flex-wrap items-center gap-2"
    >
      <Search
        className="h-3.5 w-3.5 text-muted-foreground shrink-0"
        aria-hidden="true"
      />
      <input
        type="text"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Paste a Facebook Page URL, page ID, or advertiser name…"
        className="flex-1 min-w-[200px] bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        disabled={submitting}
      />
      <button
        type="submit"
        disabled={submitting || !raw.trim()}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-3 py-1 text-xs font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {submitting ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            Scanning…
          </>
        ) : (
          "Track"
        )}
      </button>
      {error ? (
        <p className="basis-full text-[11px] text-destructive">{error}</p>
      ) : null}
    </form>
  );
}

function AdvertiserCard({
  advertiser,
}: {
  advertiser: AdLibraryAdvertiserView;
}) {
  const [scanning, setScanning] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [scanResult, setScanResult] = React.useState<string | null>(null);

  const active = advertiser.ads.filter((a) => a.status === "ACTIVE");
  const inactive = advertiser.ads.filter((a) => a.status !== "ACTIVE");

  async function handleRescan() {
    if (scanning) return;
    setScanning(true);
    setScanResult(null);
    try {
      const r = await rescanAdvertiserAction(advertiser.id);
      if (r.ok) {
        const parts: string[] = [];
        if (r.newCount > 0) parts.push(`${r.newCount} new`);
        if (r.inactiveCount > 0)
          parts.push(`${r.inactiveCount} went inactive`);
        setScanResult(
          parts.length > 0
            ? parts.join(" · ")
            : `${r.found} ads · no changes`,
        );
      } else {
        setScanResult(r.error);
      }
    } finally {
      setScanning(false);
    }
  }

  async function handleRemove() {
    if (removing) return;
    if (!confirm(`Stop tracking ${advertiser.displayName}?`)) return;
    setRemoving(true);
    try {
      await untrackAdvertiserAction(advertiser.id);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex items-start justify-between gap-2 px-3 py-2 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            <Activity className="h-3 w-3" aria-hidden="true" />
            Tracking
          </div>
          <h3
            className="mt-0.5 text-sm font-medium tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {advertiser.displayName}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {active.length} active · {inactive.length} inactive ·{" "}
            {advertiser.lastScannedAt
              ? `scanned ${formatDistanceToNow(new Date(advertiser.lastScannedAt), { addSuffix: true })}`
              : "never scanned"}
            {scanResult ? (
              <span className="ml-2 text-primary font-medium">
                · {scanResult}
              </span>
            ) : null}
          </p>
          {advertiser.lastScanError ? (
            <p className="text-[11px] text-destructive mt-1 inline-flex items-center gap-1">
              <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
              {advertiser.lastScanError}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <button
            onClick={handleRescan}
            disabled={scanning}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-60 transition-colors"
          >
            <RefreshCw
              className={cn("h-3 w-3", scanning && "animate-spin")}
              aria-hidden="true"
            />
            Rescan
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            aria-label="Stop tracking"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card p-1 text-muted-foreground hover:text-destructive hover:border-destructive/30 disabled:opacity-60 transition-colors"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </header>

      {advertiser.ads.length === 0 ? (
        <div className="px-3 py-6 text-center">
          <p className="text-[11px] text-muted-foreground">
            No public ads found in Meta&apos;s Ad Library for{" "}
            <span className="font-semibold text-foreground">
              {advertiser.displayName}
            </span>
            .
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {advertiser.ads.slice(0, 8).map((ad) => (
            <AdRow key={ad.id} ad={ad} />
          ))}
        </ul>
      )}
      {advertiser.ads.length > 8 ? (
        <div className="px-3 py-2 text-[11px] text-muted-foreground text-center bg-secondary/30">
          + {advertiser.ads.length - 8} more ads tracked
        </div>
      ) : null}
    </section>
  );
}

function AdRow({ ad }: { ad: AdLibraryAdView }) {
  const isActive = ad.status === "ACTIVE";
  const dot = isActive ? "bg-primary" : "bg-muted-foreground/40";
  const platforms = ad.publisherPlatforms
    .map((p) => p.toLowerCase().replace(/_/g, " "))
    .join(", ");
  const launched = ad.adDeliveryStart
    ? formatDistanceToNow(new Date(ad.adDeliveryStart), { addSuffix: true })
    : null;
  const stopped = ad.adDeliveryStop
    ? formatDistanceToNow(new Date(ad.adDeliveryStop), { addSuffix: true })
    : null;

  // Spend / impressions ranges only ship for political ads. We render
  // them tastefully when present, suppress when absent.
  const spendRange = formatRange(ad.spendLow, ad.spendHigh, "currency", ad.currency);
  const imprRange = formatRange(ad.impressionsLow, ad.impressionsHigh, "number");

  return (
    <li className="px-3 py-2.5 flex items-start gap-3">
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-1.5 rounded-full mt-1.5 shrink-0", dot)}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-wider",
              isActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            {isActive ? "Active" : "Inactive"}
          </p>
          <p className="text-[10px] tabular-nums text-muted-foreground">
            {launched ? `Launched ${launched}` : null}
            {stopped ? ` · stopped ${stopped}` : null}
          </p>
        </div>
        {ad.creativeTitle ? (
          <p className="text-xs font-semibold text-foreground line-clamp-1">
            {ad.creativeTitle}
          </p>
        ) : null}
        {ad.creativeBody ? (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-3">
            {ad.creativeBody}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          {platforms ? <span>{platforms}</span> : null}
          {spendRange ? <span>· spend {spendRange}</span> : null}
          {imprRange ? <span>· impr {imprRange}</span> : null}
          <a
            href={`https://www.facebook.com/ads/library/?id=${ad.externalId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-0.5 text-foreground hover:text-primary font-medium"
          >
            View in Library
            <ArrowUpRight className="h-2.5 w-2.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </li>
  );
}

function formatRange(
  low: number | null,
  high: number | null,
  kind: "number" | "currency",
  currency?: string | null,
): string | null {
  if (low == null && high == null) return null;
  const fmt = (v: number) => {
    if (kind === "currency") {
      const dollars = v / 100;
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency ?? "USD",
        maximumFractionDigits: 0,
      }).format(dollars);
    }
    return v.toLocaleString();
  };
  if (low != null && high != null) return `${fmt(low)}–${fmt(high)}`;
  if (low != null) return `≥ ${fmt(low)}`;
  return `≤ ${fmt(high!)}`;
}
