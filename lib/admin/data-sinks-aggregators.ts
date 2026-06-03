import "server-only";

// ---------------------------------------------------------------------------
// Per-integration aggregators for data-sinks-helpers.ts. Each returns the
// freshest success + error timestamps + distinct orgs touched. Aggregates
// run on small arrays already pulled by the caller — no DB work here.
// ---------------------------------------------------------------------------

export function maxDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export type IntegrationAggregate = {
  lastSyncAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
  tenantsCovered: number;
};

export const EMPTY_AGG: IntegrationAggregate = {
  lastSyncAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
  tenantsCovered: 0,
};

export function aggregateAppFolio(
  rows: Array<{
    orgId: string;
    lastSyncAt: Date | null;
    lastError: string | null;
    syncStatus: string | null;
  }>
): IntegrationAggregate {
  let lastSyncAt: Date | null = null;
  let lastErrorAt: Date | null = null;
  let lastErrorMessage: string | null = null;
  const orgs = new Set<string>();
  for (const r of rows) {
    if (r.lastSyncAt) orgs.add(r.orgId);
    lastSyncAt = maxDate(lastSyncAt, r.lastSyncAt);
    if (r.lastError || r.syncStatus === "error") {
      lastErrorAt = maxDate(lastErrorAt, r.lastSyncAt);
      lastErrorMessage = r.lastError ?? lastErrorMessage;
    }
  }
  return { lastSyncAt, lastErrorAt, lastErrorMessage, tenantsCovered: orgs.size };
}

export function aggregateSeo(
  rows: Array<{
    orgId: string;
    provider: "GSC" | "GA4";
    lastSyncAt: Date | null;
    lastSyncError: string | null;
  }>,
  provider: "GSC" | "GA4"
): IntegrationAggregate {
  let lastSyncAt: Date | null = null;
  let lastErrorAt: Date | null = null;
  let lastErrorMessage: string | null = null;
  const orgs = new Set<string>();
  for (const r of rows) {
    if (r.provider !== provider) continue;
    if (r.lastSyncAt) orgs.add(r.orgId);
    lastSyncAt = maxDate(lastSyncAt, r.lastSyncAt);
    if (r.lastSyncError) {
      lastErrorAt = maxDate(lastErrorAt, r.lastSyncAt);
      lastErrorMessage = r.lastSyncError ?? lastErrorMessage;
    }
  }
  return { lastSyncAt, lastErrorAt, lastErrorMessage, tenantsCovered: orgs.size };
}

export function aggregateAds(
  rows: Array<{
    orgId: string;
    platform: string;
    lastSyncAt: Date | null;
    lastSyncError: string | null;
  }>,
  platform: "GOOGLE_ADS" | "META"
): IntegrationAggregate {
  let lastSyncAt: Date | null = null;
  let lastErrorAt: Date | null = null;
  let lastErrorMessage: string | null = null;
  const orgs = new Set<string>();
  for (const r of rows) {
    if (r.platform !== platform) continue;
    if (r.lastSyncAt) orgs.add(r.orgId);
    lastSyncAt = maxDate(lastSyncAt, r.lastSyncAt);
    if (r.lastSyncError) {
      lastErrorAt = maxDate(lastErrorAt, r.lastSyncAt);
      lastErrorMessage = r.lastSyncError ?? lastErrorMessage;
    }
  }
  return { lastSyncAt, lastErrorAt, lastErrorMessage, tenantsCovered: orgs.size };
}

export function aggregateCursive(
  rows: Array<{
    orgId: string;
    lastEventAt: Date | null;
    lastSegmentSyncAt: Date | null;
    cursivePixelId: string | null;
  }>
): IntegrationAggregate {
  let lastSyncAt: Date | null = null;
  const orgs = new Set<string>();
  for (const r of rows) {
    if (!r.cursivePixelId) continue;
    const seen = maxDate(r.lastEventAt, r.lastSegmentSyncAt);
    if (seen) orgs.add(r.orgId);
    lastSyncAt = maxDate(lastSyncAt, seen);
  }
  return {
    lastSyncAt,
    lastErrorAt: null,
    lastErrorMessage: null,
    tenantsCovered: orgs.size,
  };
}

export function countDistinctOrgs(rows: Array<{ orgId: string }>): number {
  const orgs = new Set<string>();
  for (const r of rows) orgs.add(r.orgId);
  return orgs.size;
}
