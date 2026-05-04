import "server-only";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// AppFolio status — single source of truth for the four states the rest of
// the portal needs to communicate to operators:
//
//   1. not_connected      — no integration row at all
//   2. never_synced       — credentials saved but lastSyncAt is null
//   3. synced             — at least one successful sync recorded
//   4. failed             — most recent sync attempt failed (lastError set)
//
// Pages mirroring AppFolio data (residents, renewals, work-orders) use this
// helper so the empty / partial / degraded state copy is consistent and
// honest. Source of truth for resident records remains AppFolio; we never
// pretend data exists when sync hasn't run.
// ---------------------------------------------------------------------------

export type AppFolioConnectionState =
  | "not_connected"
  | "never_synced"
  | "syncing"
  | "synced"
  | "failed";

export type AppFolioStatus = {
  state: AppFolioConnectionState;
  lastSyncAt: Date | null;
  /**
   * Wall-clock start time of the currently-running sync, when
   * syncStatus === "syncing". Used by the poller to compute real
   * elapsed time across page navigations (a per-component local
   * counter resets on every mount and reads as a "sync restart").
   * Null when no sync is in progress.
   */
  syncStartedAt: Date | null;
  lastError: string | null;
  subdomain: string | null;
  /** True when last sync is >24h old (sync should run hourly). */
  stale: boolean;
  /**
   * Per-phase counts + warnings from the most recent sync. Surfaces in
   * the banner so operators see "pulled 0 residents" as a visible signal
   * even when the sync technically succeeded — typically means an
   * AppFolio plan limitation (Core can't access reports endpoints) or
   * a creds permission gap.
   */
  stats: AppFolioSyncStatsSummary | null;
};

export type AppFolioSyncStatsSummary = {
  residentsUpserted: number;
  leasesUpserted: number;
  workOrdersUpserted: number;
  listingsUpserted: number;
  propertiesUpserted: number;
  delinquenciesUpdated: number;
  warnings: string[];
  phasesCompleted: number;
  totalPhases: number;
  completedAt: string | null;
};

export async function getAppFolioStatus(orgId: string): Promise<AppFolioStatus> {
  // Resilient query: if a column is missing in production (schema drift
  // from dev `prisma db push` history), fall back to a reduced column set
  // so the page still renders an honest "syncing" / "synced" status
  // instead of silently masquerading as "not_connected" — the previous
  // `.catch(() => null)` swallowed the real Postgres error and confused
  // operators for days. Logs the actual error so we know which column
  // is missing.
  const integ = await prisma.appFolioIntegration
    .findUnique({
      where: { orgId },
      select: {
        instanceSubdomain: true,
        clientIdEncrypted: true,
        clientSecretEncrypted: true,
        apiKeyEncrypted: true,
        useEmbedFallback: true,
        syncStatus: true,
        syncStartedAt: true,
        lastSyncAt: true,
        lastError: true,
        lastSyncStats: true,
      },
    })
    .catch(async (err) => {
      console.warn(
        "[appfolio-status] full select failed, falling back to minimal columns:",
        err instanceof Error ? err.message : err,
      );
      return prisma.appFolioIntegration
        .findUnique({
          where: { orgId },
          select: {
            instanceSubdomain: true,
            clientIdEncrypted: true,
            apiKeyEncrypted: true,
            useEmbedFallback: true,
            lastSyncAt: true,
          },
        })
        .then((row) =>
          row
            ? {
                ...row,
                clientSecretEncrypted: null,
                syncStatus: null,
                syncStartedAt: null,
                lastError: null,
                lastSyncStats: null,
              }
            : null,
        )
        .catch(() => null);
    });

  // Coerce the JSONB column into a typed shape the UI can rely on.
  const stats = parseStats(integ?.lastSyncStats);

  if (!integ) {
    return {
      state: "not_connected",
      lastSyncAt: null,
      syncStartedAt: null,
      lastError: null,
      subdomain: null,
      stale: false,
      stats: null,
    };
  }

  const syncStartedAt = integ.syncStartedAt ?? null;

  const hasCreds =
    Boolean(integ.instanceSubdomain) &&
    (Boolean(integ.clientIdEncrypted) ||
      Boolean(integ.apiKeyEncrypted) ||
      Boolean(integ.useEmbedFallback));

  if (!hasCreds) {
    return {
      state: "not_connected",
      lastSyncAt: integ.lastSyncAt ?? null,
      syncStartedAt,
      lastError: integ.lastError ?? null,
      subdomain: integ.instanceSubdomain ?? null,
      stale: false,
      stats,
    };
  }

  if (integ.syncStatus === "syncing") {
    // Stuck-sync detection. If syncStartedAt is set + older than 10 min,
    // the sync function probably timed out (Vercel function maxDuration
    // is 5 min) and the row is wedged. Surface as failed so the operator
    // sees the actionable state instead of an indefinite spinner.
    const STUCK_AFTER_MS = 10 * 60 * 1000;
    const isStuck =
      syncStartedAt != null &&
      Date.now() - syncStartedAt.getTime() > STUCK_AFTER_MS;
    if (isStuck) {
      return {
        state: "failed",
        lastSyncAt: integ.lastSyncAt ?? null,
        syncStartedAt,
        lastError:
          integ.lastError ??
          `Sync stuck for ${Math.round(
            (Date.now() - syncStartedAt.getTime()) / 60000
          )} minutes — likely timed out. Click Retry to re-run.`,
        subdomain: integ.instanceSubdomain ?? null,
        stale: false,
        stats,
      };
    }
    return {
      state: "syncing",
      lastSyncAt: integ.lastSyncAt ?? null,
      syncStartedAt,
      lastError: integ.lastError ?? null,
      subdomain: integ.instanceSubdomain ?? null,
      stale: false,
      stats,
    };
  }

  if (integ.lastError) {
    return {
      state: "failed",
      lastSyncAt: integ.lastSyncAt ?? null,
      syncStartedAt,
      lastError: integ.lastError,
      subdomain: integ.instanceSubdomain ?? null,
      stale: false,
      stats,
    };
  }

  if (!integ.lastSyncAt) {
    return {
      state: "never_synced",
      lastSyncAt: null,
      syncStartedAt,
      lastError: null,
      subdomain: integ.instanceSubdomain ?? null,
      stale: false,
      stats,
    };
  }

  const ageMs = Date.now() - integ.lastSyncAt.getTime();
  const stale = ageMs > 24 * 60 * 60 * 1000;

  return {
    state: "synced",
    lastSyncAt: integ.lastSyncAt,
    syncStartedAt,
    lastError: null,
    subdomain: integ.instanceSubdomain ?? null,
    stale,
    stats,
  };
}

// Defensive shape coercion. The DB column is JSONB so anything could be in
// there; treat unknown / partial shapes as missing instead of crashing the
// status helper.
function parseStats(raw: unknown): AppFolioSyncStatsSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (k: string) =>
    typeof r[k] === "number" && Number.isFinite(r[k] as number)
      ? (r[k] as number)
      : 0;
  const warnings = Array.isArray(r.warnings)
    ? (r.warnings as unknown[]).filter((w): w is string => typeof w === "string")
    : [];
  return {
    residentsUpserted: num("residentsUpserted"),
    leasesUpserted: num("leasesUpserted"),
    workOrdersUpserted: num("workOrdersUpserted"),
    listingsUpserted: num("listingsUpserted"),
    propertiesUpserted: num("propertiesUpserted"),
    delinquenciesUpdated: num("delinquenciesUpdated"),
    warnings,
    phasesCompleted: num("phasesCompleted"),
    totalPhases: num("totalPhases"),
    completedAt:
      typeof r.completedAt === "string" ? r.completedAt : null,
  };
}
