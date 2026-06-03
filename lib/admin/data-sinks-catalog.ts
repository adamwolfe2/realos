import "server-only";

// ---------------------------------------------------------------------------
// Static catalog for data-sinks. Types + provider tables only — no DB, no
// runtime logic. Split from data-sinks-helpers.ts to keep both files under
// the 400-line cap.
// ---------------------------------------------------------------------------

import {
  FRESHNESS_BUDGET,
  type IntegrationKey,
} from "@/lib/sync/freshness";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type SinkProvider =
  | "appfolio"
  | "ga4"
  | "gsc"
  | "google_ads"
  | "meta_ads"
  | "dataforseo"
  | "aeo"
  | "reputation"
  | "cursive_pixel"
  | "site_intelligence";

export type SinkStatus = "fresh" | "stale" | "erroring" | "dead" | "missing";

export type DataSinkSummary = {
  provider: SinkProvider;
  label: string;
  cronJobName: string | null;
  status: SinkStatus;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
  runsLast24h: number;
  successesLast24h: number;
  errorsLast24h: number;
  rowsLast24h: number | null;
  expectedIntervalMs: number;
  tenantsCovered: number | null;
};

// Provider → cron job. seo-sync covers BOTH GA4 + GSC; ads-sync covers
// BOTH Google + Meta. Shared cron stats attribute to both cards so a
// single failure surfaces on both rather than hiding behind the joint job.
export const CRON_BY_PROVIDER: Record<SinkProvider, string | null> = {
  appfolio: "appfolio-sync",
  ga4: "seo-sync",
  gsc: "seo-sync",
  google_ads: "ads-sync",
  meta_ads: "ads-sync",
  dataforseo: "dataforseo-sync",
  aeo: "aeo-scan",
  reputation: "reputation-scan",
  cursive_pixel: "pixel-segment-sync",
  site_intelligence: "site-intelligence-refresh",
};

export const LABEL_BY_PROVIDER: Record<SinkProvider, string> = {
  appfolio: "AppFolio",
  ga4: "Google Analytics (GA4)",
  gsc: "Google Search Console",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  dataforseo: "DataForSEO",
  aeo: "AEO brand-mention scan",
  reputation: "Reputation (Reddit/Yelp/Google)",
  cursive_pixel: "Cursive visitor pixel",
  site_intelligence: "Site intelligence (Firecrawl)",
};

const FALLBACK_INTERVAL_MS: Record<SinkProvider, number> = {
  appfolio: HOUR,
  ga4: 6 * HOUR,
  gsc: DAY,
  google_ads: 30 * 60 * 1000,
  meta_ads: 30 * 60 * 1000,
  dataforseo: DAY,
  aeo: 7 * DAY,
  reputation: DAY,
  cursive_pixel: 2 * 60 * 1000,
  site_intelligence: DAY,
};

const FRESHNESS_KEY_BY_PROVIDER: Partial<
  Record<SinkProvider, IntegrationKey>
> = {
  appfolio: "appfolio",
  ga4: "ga4",
  gsc: "gsc",
  google_ads: "google_ads",
  meta_ads: "meta_ads",
  cursive_pixel: "cursive_pixel",
  reputation: "reputation",
};

export function expectedIntervalFor(provider: SinkProvider): number {
  const key = FRESHNESS_KEY_BY_PROVIDER[provider];
  if (key) return FRESHNESS_BUDGET[key].staleAfterMs;
  return FALLBACK_INTERVAL_MS[provider];
}

export const ALL_CRON_JOBS = Array.from(
  new Set(
    Object.values(CRON_BY_PROVIDER).filter(
      (j): j is string => typeof j === "string"
    )
  )
);
