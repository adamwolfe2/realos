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
  lastError: string | null;
  subdomain: string | null;
  /** True when last sync is >24h old (sync should run hourly). */
  stale: boolean;
};

export async function getAppFolioStatus(orgId: string): Promise<AppFolioStatus> {
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
        lastSyncAt: true,
        lastError: true,
      },
    })
    .catch(() => null);

  if (!integ) {
    return {
      state: "not_connected",
      lastSyncAt: null,
      lastError: null,
      subdomain: null,
      stale: false,
    };
  }

  const hasCreds =
    Boolean(integ.instanceSubdomain) &&
    (Boolean(integ.clientIdEncrypted) ||
      Boolean(integ.apiKeyEncrypted) ||
      Boolean(integ.useEmbedFallback));

  if (!hasCreds) {
    return {
      state: "not_connected",
      lastSyncAt: integ.lastSyncAt ?? null,
      lastError: integ.lastError ?? null,
      subdomain: integ.instanceSubdomain ?? null,
      stale: false,
    };
  }

  if (integ.syncStatus === "syncing") {
    return {
      state: "syncing",
      lastSyncAt: integ.lastSyncAt ?? null,
      lastError: integ.lastError ?? null,
      subdomain: integ.instanceSubdomain ?? null,
      stale: false,
    };
  }

  if (integ.lastError) {
    return {
      state: "failed",
      lastSyncAt: integ.lastSyncAt ?? null,
      lastError: integ.lastError,
      subdomain: integ.instanceSubdomain ?? null,
      stale: false,
    };
  }

  if (!integ.lastSyncAt) {
    return {
      state: "never_synced",
      lastSyncAt: null,
      lastError: null,
      subdomain: integ.instanceSubdomain ?? null,
      stale: false,
    };
  }

  const ageMs = Date.now() - integ.lastSyncAt.getTime();
  const stale = ageMs > 24 * 60 * 60 * 1000;

  return {
    state: "synced",
    lastSyncAt: integ.lastSyncAt,
    lastError: null,
    subdomain: integ.instanceSubdomain ?? null,
    stale,
  };
}
