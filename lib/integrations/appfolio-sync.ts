import "server-only";
import { prisma } from "@/lib/db";
import {
  AuditAction,
  BackendPlatform,
  LeadStatus,
  Prisma,
} from "@prisma/client";
import {
  appfolioRestClient,
  fetchAllPages,
  fetchAppfolioV1Showings,
  mapLeadPayload,
  mapListingPayload,
  mapTenantPayload,
  mapResidentPayload,
  mapLeasePayload,
  mapDelinquencyPayload,
  mapWorkOrderPayload,
  mapPropertyPayload,
  mapApplicationPayload,
  mapShowingPayload,
  type MappedLead,
  type MappedTenant,
  type MappedResident,
  type MappedLease,
  type MappedWorkOrder,
  type MappedApplication,
  type MappedShowing,
} from "./appfolio";
import { classifyProperty } from "@/lib/properties/marketable";

// ---------------------------------------------------------------------------
// AppFolio REST sync worker.
//
// Runs three v2 reports (leads, tenants, units), each wrapped so one
// failure doesn't kill the whole sync. Idempotent via the compound unique
// indexes on (orgId, externalSystem, externalId) for Lead and
// (propertyId, backendListingId) for Listing — see prisma/schema.prisma.
//
// Date windows:
//   - first sync (lastSyncAt null) or fullBackfill === true  → last 90 days
//   - incremental (lastSyncAt set)                            → since lastSyncAt
//
// AppFolio v2 reports we use:
//   - guest_cards      — individual leads (per-row inquiry)
//   - tenant_directory — tenants (for SIGNED attribution)
//   - unit_directory   — units / listings
//
// `prospect_source_tracking` looks like a leads report but is actually an
// aggregate ROLLUP by source (one row per source with counts). Useless
// for individual-lead upserts.
//
// Tours / showings are NOT a v2 report — they live as a v1 CRUD entity
// (/api/v1/showings.json). Tour bookings already arrive via the Cal.com
// webhook at /api/intake/[id]/cal-booked, so we don't pull them from
// AppFolio at all.
// ---------------------------------------------------------------------------

const EXTERNAL_SYSTEM = "appfolio";
// Window for the initial full-backfill on a fresh connection. Pre-fix
// this was 90 days, which routinely exceeded Vercel's 5-min function
// timeout for tenants with >500 residents (8 report endpoints × 90
// days = a lot of pages). Dropping to 30 days fits comfortably in
// the budget while still giving every dashboard meaningful historical
// data. Operators who want deeper history can re-run a manual sync
// with an explicit `since` later; the incremental sync (default code
// path) only walks the most-recent window anyway.
const DEFAULT_BACKFILL_DAYS = 30;

export type AppfolioSyncStats = {
  leadsUpserted: number;
  toursUpserted: number;
  tenantsMatched: number;
  listingsUpserted: number;
  // New phases
  propertiesUpserted: number;
  residentsUpserted: number;
  leasesUpserted: number;
  workOrdersUpserted: number;
  delinquenciesUpdated: number;
  applicationsUpserted: number;
  warnings: string[];
};

export type AppfolioSyncResult = {
  ok: boolean;
  stats: AppfolioSyncStats;
  error?: string;
};

/**
 * Resolve an AppFolio property id (or list of candidate ids) to a LOCAL
 * Property id, using the externalId->localId map built in Phase 0.
 *
 * CRITICAL multi-property invariant: in a portfolio with more than one
 * property we NEVER guess. If no candidate id matches, we return null and let
 * the caller decide — skip + warn (applications, residents, leases, work
 * orders, which require a property) or fall back to an org-level row (leads).
 * Guessing "the first property" here would silently file a lease/application/
 * resident under the WRONG building, corrupting per-property nesting across
 * the portfolio. The convenience fallback only applies when the org has
 * exactly ONE AppFolio property (nothing to mis-assign to). This mirrors the
 * unit_directory phase, which already refused to guess.
 */
export function resolveAppfolioPropertyId(
  propertyByExternalId: Map<string, string>,
  externalIds: string[],
): string | null {
  for (const eid of externalIds) {
    const hit = propertyByExternalId.get(eid);
    if (hit) return hit;
  }
  if (propertyByExternalId.size === 1) {
    return propertyByExternalId.values().next().value ?? null;
  }
  return null;
}

export async function runAppfolioSync(
  orgId: string,
  options: { fullBackfill?: boolean; retrySkipped?: boolean } = {}
): Promise<AppfolioSyncResult> {
  const stats: AppfolioSyncStats = {
    leadsUpserted: 0,
    toursUpserted: 0,
    tenantsMatched: 0,
    listingsUpserted: 0,
    propertiesUpserted: 0,
    residentsUpserted: 0,
    leasesUpserted: 0,
    workOrdersUpserted: 0,
    delinquenciesUpdated: 0,
    applicationsUpserted: 0,
    warnings: [],
  };

  const integration = await prisma.appFolioIntegration.findUnique({
    where: { orgId },
  });
  if (!integration) {
    return {
      ok: false,
      stats,
      error: "AppFolio integration not configured for this org",
    };
  }
  const hasRestCreds = Boolean(
    integration.clientIdEncrypted &&
      (integration.clientSecretEncrypted || integration.apiKeyEncrypted)
  );
  if (!hasRestCreds || !integration.instanceSubdomain) {
    return {
      ok: false,
      stats,
      error:
        "AppFolio credentials missing. Configure subdomain, clientId, and clientSecret.",
    };
  }

  const now = new Date();
  const toDate = now;
  const fromDate =
    options.fullBackfill || !integration.lastSyncAt
      ? new Date(now.getTime() - DEFAULT_BACKFILL_DAYS * 24 * 60 * 60 * 1000)
      : integration.lastSyncAt;

  // Concurrency guard. If a sync is already in flight + started less
  // than 10 min ago, no-op instead of racing a second one. The
  // StaleOnLoadTrigger can fire from multiple tabs in rapid succession;
  // without this guard we'd start parallel syncs that fight over the
  // integration row's syncStatus and double-write the same upserts.
  // Older "syncing" rows are presumed stuck (Vercel function timeouts)
  // and get steamrolled by the new run.
  //
  // When the guard fires we now return ok:false with an explicit message.
  // Previously we returned ok:true with empty stats which rendered as
  // "Synced 0 leads, 0 tenants, 0 listings" — making operators think
  // their AppFolio account was empty when reality was just "another sync
  // is already running, please wait".
  const STUCK_AFTER_MS = 10 * 60 * 1000;
  if (
    integration.syncStatus === "syncing" &&
    integration.syncStartedAt &&
    Date.now() - integration.syncStartedAt.getTime() < STUCK_AFTER_MS
  ) {
    const elapsedSec = Math.round(
      (Date.now() - integration.syncStartedAt.getTime()) / 1000,
    );
    return {
      ok: false,
      stats,
      error: `Another sync is already running (${elapsedSec}s elapsed). Wait for it to finish, or click Clear stuck sync if it's been more than 10 minutes.`,
    };
  }

  // Sweep stuck rows BEFORE marking ours as in-flight. A row in
  // syncStatus='syncing' with syncStartedAt > 10 min ago is a killed
  // Vercel function; clear it so this run starts from a clean slate.
  if (
    integration.syncStatus === "syncing" &&
    (!integration.syncStartedAt ||
      Date.now() - integration.syncStartedAt.getTime() >= STUCK_AFTER_MS)
  ) {
    await prisma.appFolioIntegration
      .update({
        where: { orgId },
        data: {
          syncStatus: "error",
          syncStartedAt: null,
          lastError: "Previous sync timed out — auto-cleared.",
        },
      })
      .catch(() => undefined);
  }

  // Mark sync as started + capture the wall-clock start time. The UI
  // reads syncStartedAt to (a) compute real elapsed time across page
  // navigations and (b) detect stuck syncs (>10 min) as failures rather
  // than letting them sit forever.
  const syncStartedAt = new Date();
  await prisma.appFolioIntegration.update({
    where: { orgId },
    data: {
      syncStatus: "syncing",
      syncStartedAt,
      lastError: null,
    },
  });

  let client;
  try {
    client = appfolioRestClient(integration);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.appFolioIntegration.update({
      where: { orgId },
      data: {
        syncStatus: "error",
        syncStartedAt: null,
        lastError: message,
      },
    });
    return { ok: false, stats, error: message };
  }

  const properties = await prisma.property.findMany({
    where: { orgId, backendPlatform: BackendPlatform.APPFOLIO },
    select: {
      id: true,
      backendPropertyId: true,
      backendPropertyGroup: true,
    },
  });
  const propertyByExternalId = new Map<string, string>();
  for (const p of properties) {
    if (p.backendPropertyId) propertyByExternalId.set(p.backendPropertyId, p.id);
  }

  // Resolve an AppFolio property id to a local Property. Reads
  // propertyByExternalId at call time (Phase 0 may add entries after this
  // block). Never guesses in a multi-property portfolio — see
  // resolveAppfolioPropertyId. Callers that require a property skip+warn on
  // null; the leads phase treats null as an org-level lead.
  const resolvePropertyId = (externalIds: string[]): string | null =>
    resolveAppfolioPropertyId(propertyByExternalId, externalIds);

  let topLevelError: string | null = null;
  // Resilience: track per-phase completion separately from row counts. A
  // phase that runs the request to completion (even with 0 rows) counts as
  // "the connector worked" — the integration goes back to idle. But we
  // only advance lastSyncAt to "now" when *every* phase completed, so a
  // partial failure doesn't shrink the failed phase's window forever on
  // subsequent incremental syncs.
  let phasesCompleted = 0;
  // Skipped phases are tracked separately from completed so we never
  // lie about health. Pre-fix the auto-skipped branch did
  // `phasesCompleted += 1` which made the writer think 8/8 phases ran
  // — masking persistent failures (SG Real Estate's leads phase had
  // been "all phases completed" for 20 days while guest_cards 404'd).
  let phasesSkipped = 0;
  // 10 = properties + leads + applications + showings + tenants + units +
  // residents + leases + work orders + delinquencies. Bumped from 9 → 10
  // on 2026-06-01 when showings (v1 CRUD) was added.
  const totalPhases = 10;

  // Persistent per-phase failure tracking. Stored in lastSyncStats as a
  // map of { phaseName: { consecutiveFailures, firstFailedAt, lastError,
  // skipped, lastRetryAttemptAt } }. After 3 consecutive failures we
  // mark the phase as "skipped" and the next sync skips it entirely
  // instead of repeatedly hitting AppFolio with a request we know will
  // 404. Auto-retry is attempted weekly via the cron (see
  // app/api/cron/appfolio-sync/route.ts) so a transient AppFolio
  // outage doesn't pin a phase as broken forever.
  const PHASE_SKIP_THRESHOLD = 3;
  type PhaseFailureState = {
    consecutiveFailures: number;
    firstFailedAt: string;
    lastError: string;
    skipped?: boolean;
    // "unsupported" = report isn't on this account's AppFolio plan (404 /
    // "not a valid report") — permanent, never auto-retried. "transient" =
    // a recoverable failure that the weekly retry should re-attempt.
    reason?: "transient" | "unsupported";
    lastRetryAttemptAt?: string;
  };
  // Defensive parsing — a malformed prior payload (manual DB edit,
  // schema drift) could give us NaN or undefined values that bypass
  // the skip threshold forever. Zod-validate the shape, default to
  // empty on any parse failure.
  const priorStatsRaw = (integration.lastSyncStats as unknown as {
    phaseFailures?: Record<string, unknown>;
  } | null) ?? null;
  const priorFailures: Record<string, PhaseFailureState> = {};
  if (priorStatsRaw?.phaseFailures && typeof priorStatsRaw.phaseFailures === "object") {
    for (const [k, v] of Object.entries(priorStatsRaw.phaseFailures)) {
      if (v && typeof v === "object") {
        const e = v as Record<string, unknown>;
        const cf = typeof e.consecutiveFailures === "number" && Number.isFinite(e.consecutiveFailures)
          ? Math.max(0, Math.floor(e.consecutiveFailures))
          : 0;
        priorFailures[k] = {
          consecutiveFailures: cf,
          firstFailedAt: typeof e.firstFailedAt === "string" ? e.firstFailedAt : new Date().toISOString(),
          lastError: typeof e.lastError === "string" ? e.lastError : "unknown",
          skipped: e.skipped === true,
          reason:
            e.reason === "unsupported"
              ? "unsupported"
              : e.reason === "transient"
                ? "transient"
                : undefined,
          lastRetryAttemptAt: typeof e.lastRetryAttemptAt === "string" ? e.lastRetryAttemptAt : undefined,
        };
      }
    }
  }
  // When the operator explicitly retries skipped phases (manual button)
  // OR the cron's weekly auto-retry fires, clear the skipped flags so
  // those phases get one fresh attempt this run. Track the attempt
  // timestamp so the cron doesn't auto-retry more than once per week.
  if (options.retrySkipped) {
    const nowIso = new Date().toISOString();
    for (const k of Object.keys(priorFailures)) {
      // Only re-attempt transient skips. Reports the account's plan doesn't
      // expose (404 / "not a valid report") will never recover, so retrying
      // them weekly just burns API calls and re-raises the warning banner.
      if (priorFailures[k]?.skipped && priorFailures[k]?.reason !== "unsupported") {
        priorFailures[k] = {
          ...priorFailures[k],
          skipped: false,
          consecutiveFailures: 0,
          lastRetryAttemptAt: nowIso,
        };
      }
    }
  }
  const phaseFailures: Record<string, PhaseFailureState> = { ...priorFailures };

  function isPhaseSkipped(phase: string): boolean {
    const entry = phaseFailures[phase];
    return !!entry?.skipped;
  }

  function recordPhaseSuccess(phase: string): void {
    // Successful run clears the consecutive-failure counter so a flaky
    // endpoint that recovers doesn't stay marked.
    if (phaseFailures[phase]) delete phaseFailures[phase];
  }

  function recordPhaseFailure(phase: string, error: string): void {
    const prior = phaseFailures[phase];
    const consecutiveFailures = (prior?.consecutiveFailures ?? 0) + 1;
    // A 404 / 400 "not a valid report" means the report isn't exposed on this
    // account's AppFolio plan — it never recovers by retrying. Mark it
    // unsupported and skip it immediately (no 3-strike wait) so the sync stops
    // hitting a known-dead endpoint every 30 min and the operator banner stays
    // green for the reports that DO work.
    const unsupported =
      /\b40[04]\b|not a valid report|no longer available|not available on/i.test(
        error,
      );
    phaseFailures[phase] = {
      consecutiveFailures,
      firstFailedAt: prior?.firstFailedAt ?? new Date().toISOString(),
      lastError: error,
      reason: unsupported ? "unsupported" : "transient",
      skipped: unsupported || consecutiveFailures >= PHASE_SKIP_THRESHOLD,
    };
  }

  // 0. PROPERTIES — must run BEFORE leads/listings/residents so those
  // phases can attribute to a real Property row on the first sync. Was
  // Phase 4 historically; that meant the very first sync silently lost
  // attribution for every lead and listing because their `property_id`
  // pointed at AppFolio rows our DB had never seen. Auto-discovering
  // first means downstream phases find their Property in the map.
  try {
    const rows = await fetchAllPages(client, "property_directory");
    for (const row of rows) {
      const mapped = mapPropertyPayload(row);
      if (!mapped) continue;
      const existing = await prisma.property.findFirst({
        where: {
          orgId,
          backendPlatform: BackendPlatform.APPFOLIO,
          backendPropertyId: mapped.externalId,
        },
        select: {
          id: true,
          lifecycle: true,
          lifecycleSetBy: true,
          name: true,
          backendPropertyGroup: true,
        },
      });
      if (existing) {
        // Property already known. User-edited fields stay sticky; we
        // still ensure it's in our local map for downstream phases.
        propertyByExternalId.set(mapped.externalId, existing.id);

        // Backfill the AppFolio property group if we don't have it yet, so
        // existing portfolios gain nesting metadata on the next sync without
        // disturbing any operator-edited fields.
        if (mapped.propertyGroup && !existing.backendPropertyGroup) {
          await prisma.property.update({
            where: { id: existing.id },
            data: { backendPropertyGroup: mapped.propertyGroup },
          });
        }

        // Re-classify ONLY if the lifecycle was last set by the auto-
        // classifier — never override an operator decision. The
        // classifier only returns confident EXCLUDE verdicts, so we
        // never demote ACTIVE → IMPORTED on re-sync (an existing row
        // is implicitly approved). The narrow case we DO want to act
        // on: a previously EXCLUDED row whose name no longer matches
        // (operator renamed "Parking lot 12" to "12 Channing Apts")
        // should bounce out of EXCLUDED so the operator can re-review.
        if (existing.lifecycleSetBy === "AUTO_CLASSIFIER") {
          const classification = classifyProperty({
            name: mapped.name ?? existing.name,
            totalUnits: mapped.totalUnits,
            addressLine1: mapped.addressLine1,
          });

          if (classification.excluded && existing.lifecycle !== "EXCLUDED") {
            // New pattern match — demote with a fresh reason.
            await prisma.property.update({
              where: { id: existing.id },
              data: {
                lifecycle: "EXCLUDED",
                lifecycleSetAt: new Date(),
                excludeReason: classification.reason,
              },
            });
          } else if (
            !classification.excluded &&
            existing.lifecycle === "EXCLUDED"
          ) {
            // Was excluded by classifier; pattern no longer matches
            // (likely renamed). Promote to IMPORTED for re-review —
            // never auto-promote to ACTIVE without operator say-so.
            await prisma.property.update({
              where: { id: existing.id },
              data: {
                lifecycle: "IMPORTED",
                lifecycleSetAt: new Date(),
                excludeReason: null,
              },
            });
          }
          // Otherwise: leave alone. Don't disturb ACTIVE rows just
          // because the classifier has no opinion.
        }
        continue;
      }

      // Pre-existing manual Property with the same name (or address) but
      // no backendPropertyId? Adopt it instead of creating a duplicate.
      // Without this, customers who manually entered properties before
      // connecting AppFolio end up with TWO rows per building — the
      // manual one (with hero image, slug, marketing copy) AND a synced
      // one carrying the resident/lease/work-order data. Operators then
      // click into the manual row and see "no residents synced yet"
      // because the children attached to the synced twin.
      const orphan = await prisma.property.findFirst({
        where: {
          orgId,
          backendPropertyId: null,
          OR: [
            mapped.name
              ? { name: { equals: mapped.name, mode: "insensitive" } }
              : undefined,
            mapped.addressLine1
              ? {
                  addressLine1: {
                    equals: mapped.addressLine1,
                    mode: "insensitive",
                  },
                }
              : undefined,
          ].filter(Boolean) as Prisma.PropertyWhereInput[],
        },
        select: { id: true },
      });
      if (orphan) {
        await prisma.property.update({
          where: { id: orphan.id },
          data: {
            backendPlatform: BackendPlatform.APPFOLIO,
            backendPropertyId: mapped.externalId,
            backendPropertyGroup: mapped.propertyGroup ?? undefined,
            // Backfill empty address/unit fields from AppFolio without
            // overwriting whatever the operator may have hand-edited.
            addressLine1: mapped.addressLine1 ?? undefined,
            addressLine2: mapped.addressLine2 ?? undefined,
            city: mapped.city ?? undefined,
            state: mapped.state ?? undefined,
            postalCode: mapped.postalCode ?? undefined,
            country: mapped.country ?? undefined,
            totalUnits: mapped.totalUnits ?? undefined,
            yearBuilt: mapped.yearBuilt ?? undefined,
          },
        });
        propertyByExternalId.set(mapped.externalId, orphan.id);
        stats.propertiesUpserted += 1;
        continue;
      }

      const slug = await uniquePropertySlug(orgId, mapped.name ?? mapped.externalId);

      // Auto-classify at import. High-confidence sub-records (parking,
      // storage, "do not use", "Property 12345" placeholders) land as
      // EXCLUDED so they never pollute counts. Everything else lands as
      // IMPORTED for operator review in /portal/properties/curate.
      const classification = classifyProperty({
        name: mapped.name,
        totalUnits: mapped.totalUnits,
        addressLine1: mapped.addressLine1,
      });

      const created = await prisma.property.create({
        data: {
          orgId,
          name: mapped.name ?? `Property ${mapped.externalId}`,
          slug,
          propertyType: "RESIDENTIAL",
          backendPlatform: BackendPlatform.APPFOLIO,
          backendPropertyId: mapped.externalId,
          backendPropertyGroup: mapped.propertyGroup,
          addressLine1: mapped.addressLine1,
          addressLine2: mapped.addressLine2,
          city: mapped.city,
          state: mapped.state,
          postalCode: mapped.postalCode,
          country: mapped.country,
          totalUnits: mapped.totalUnits,
          yearBuilt: mapped.yearBuilt,
          // EXCLUDED if the classifier matched a sub-record pattern;
          // otherwise IMPORTED so the operator approves new buildings
          // explicitly before they show in dashboards.
          lifecycle: classification.excluded ? "EXCLUDED" : "IMPORTED",
          lifecycleSetBy: "AUTO_CLASSIFIER",
          lifecycleSetAt: new Date(),
          excludeReason: classification.excluded ? classification.reason : null,
        },
      });
      propertyByExternalId.set(mapped.externalId, created.id);
      stats.propertiesUpserted += 1;
    }
    phasesCompleted += 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    stats.warnings.push(`properties: ${message}`);
    topLevelError = topLevelError ?? `properties: ${message}`;
  }

  // 1. LEADS — AppFolio v2 report: guest_cards
  if (isPhaseSkipped("leads")) {
    // Auto-skipped after 3 consecutive failures. Almost always indicates
    // the tenant's AppFolio plan doesn't include the guest_cards report
    // (Core plan vs. Plus/Max), or AppFolio's pagination is consistently
    // 404ing for this account. We DELIBERATELY DO NOT increment
    // phasesCompleted — skipped phases are tracked separately so the
    // writer (and the UI) can honestly say "7 of 8 ran, 1 was skipped".
    stats.warnings.push(
      `leads: phase auto-skipped after ${PHASE_SKIP_THRESHOLD} consecutive failures (last: ${phaseFailures.leads?.lastError ?? "unknown"}). Use Retry skipped phases to re-attempt.`
    );
    phasesSkipped += 1;
  } else {
    try {
      const rows = await fetchAllPages(client, "guest_cards", { fromDate, toDate });
      for (const row of rows) {
        const mapped = mapLeadPayload(row);
        if (!mapped) continue;
        await upsertAppfolioLead(orgId, mapped, resolvePropertyId(mapped.propertyIds));
        stats.leadsUpserted += 1;
      }
      phasesCompleted += 1;
      recordPhaseSuccess("leads");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      stats.warnings.push(`leads: ${message}`);
      // No longer pollutes topLevelError — partial-success state is
      // signalled via stats.warnings + phaseFailures only. The whole-
      // sync "failed" banner now only fires when zero phases complete.
      recordPhaseFailure("leads", message);
    }
  }

  // 1c. SHOWINGS — AppFolio v1 CRUD endpoint (/api/v1/showings.json).
  // Tour bookings AppFolio is tracking on its side (manual entries by
  // leasing agents, AppFolio tour-scheduler bookings). Cal.com bookings
  // arrive via /api/webhooks/cal/[orgId] independently — both paths
  // upsert Tour rows keyed on (externalSystem, externalId) so they
  // never collide. Same auto-skip pattern as leads/applications.
  if (isPhaseSkipped("showings")) {
    stats.warnings.push(
      `showings: phase auto-skipped after ${PHASE_SKIP_THRESHOLD} consecutive failures (last: ${phaseFailures.showings?.lastError ?? "unknown"}). Use Retry skipped phases to re-attempt.`,
    );
    phasesSkipped += 1;
  } else {
    try {
      const rows = await fetchAppfolioV1Showings(integration, fromDate);
      let unmatchedNoLead = 0;
      for (const row of rows) {
        const mapped = mapShowingPayload(row);
        if (!mapped) continue;
        const result = await upsertAppfolioShowing(orgId, mapped);
        if (result === "no_lead") unmatchedNoLead += 1;
        else if (result === "ok") stats.toursUpserted += 1;
      }
      if (unmatchedNoLead > 0) {
        stats.warnings.push(
          `showings: ${unmatchedNoLead} showing${unmatchedNoLead === 1 ? "" : "s"} had no matching Lead by AppFolio guest_card id — skipped (will attach when the matching lead lands).`,
        );
      }
      phasesCompleted += 1;
      recordPhaseSuccess("showings");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      stats.warnings.push(`showings: ${message}`);
      recordPhaseFailure("showings", message);
    }
  }

  // 1b. APPLICATIONS — AppFolio v2 report: `applicant_directory`.
  // Each row is a rental application AppFolio is tracking. We upsert
  // into our Application table, matching applicants to existing Lead
  // rows by email (the most reliable cross-system identifier — AppFolio
  // doesn't expose the guest_card_id on this report on most plans).
  // Property is resolved via the property_directory map populated in
  // phase 0; applications missing a resolvable property are skipped
  // (logged as a warning, not a hard failure).
  //
  // Auto-skip behavior mirrors the leads phase: on tenant plans where
  // applicant_directory isn't included, three consecutive 404s mark
  // the phase as skipped and the cron re-attempts weekly.
  if (isPhaseSkipped("applications")) {
    stats.warnings.push(
      `applications: phase auto-skipped after ${PHASE_SKIP_THRESHOLD} consecutive failures (last: ${phaseFailures.applications?.lastError ?? "unknown"}). Use Retry skipped phases to re-attempt.`,
    );
    phasesSkipped += 1;
  } else {
    try {
      const rows = await fetchAllPages(client, "applicant_directory", {
        fromDate,
        toDate,
      });
      let unmatchedNoLead = 0;
      let unmatchedNoProperty = 0;
      for (const row of rows) {
        const mapped = mapApplicationPayload(row);
        if (!mapped) continue;
        const propertyId = resolvePropertyId(mapped.propertyIds);
        if (!propertyId) {
          unmatchedNoProperty += 1;
          continue;
        }
        const upserted = await upsertAppfolioApplication(
          orgId,
          mapped,
          propertyId,
        );
        if (upserted === "no_lead") unmatchedNoLead += 1;
        else if (upserted === "ok") stats.applicationsUpserted += 1;
      }
      if (unmatchedNoLead > 0) {
        stats.warnings.push(
          `applications: ${unmatchedNoLead} applicant${unmatchedNoLead === 1 ? "" : "s"} had no matching Lead by email — skipped. They'll attach automatically when the matching lead lands.`,
        );
      }
      if (unmatchedNoProperty > 0) {
        stats.warnings.push(
          `applications: ${unmatchedNoProperty} application${unmatchedNoProperty === 1 ? "" : "s"} couldn't be matched to a Property — skipped.`,
        );
      }
      phasesCompleted += 1;
      recordPhaseSuccess("applications");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      stats.warnings.push(`applications: ${message}`);
      recordPhaseFailure("applications", message);
    }
  }

  // 2. TENANTS (→ Lead SIGNED attribution).
  // Directory reports are full snapshots and don't honor date filters the
  // way per-record reports do — passing fromDate/toDate against
  // tenant_directory returns nothing on some org configs. We fetch the
  // full directory and only do DB work for emails that actually match an
  // existing Lead, so the loop stays cheap even with thousands of rows.
  try {
    const rows = await fetchAllPages(client, "tenant_directory", {
      extraFilters: { status: "all" },
    });
    const tenantEmails = new Set<string>();
    const tenantsByEmail = new Map<string, MappedTenant>();
    for (const row of rows) {
      const mapped = mapTenantPayload(row);
      if (!mapped || !mapped.email) continue;
      tenantEmails.add(mapped.email);
      tenantsByEmail.set(mapped.email, mapped);
    }
    if (tenantEmails.size > 0) {
      const matchingLeads = await prisma.lead.findMany({
        where: { orgId, email: { in: Array.from(tenantEmails) } },
        select: { email: true },
      });
      for (const lead of matchingLeads) {
        if (!lead.email) continue;
        const tenant = tenantsByEmail.get(lead.email);
        if (!tenant) continue;
        const matched = await markLeadSignedByTenant(orgId, tenant);
        if (matched) stats.tenantsMatched += 1;
      }
    }
    phasesCompleted += 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    stats.warnings.push(`tenants: ${message}`);
    topLevelError = topLevelError ?? `tenants: ${message}`;
  }

  // 3. UNITS / LISTINGS — pulled from `unit_directory` (v2 directory report).
  // Don't pass a date window: directory reports filter on LastModified, so
  // a unit that hasn't been edited recently (but is still listed and
  // available) would silently drop out of the sync and our Listing rows
  // would go stale. We fetch the full directory each run; idempotent
  // upserts keep this safe.
  try {
    const rows = await fetchAllPages(client, "unit_directory", {
      extraFilters: integration.propertyGroupFilter
        ? { property_group: integration.propertyGroupFilter }
        : undefined,
    });
    for (const row of rows) {
      const mapped = mapListingPayload(row);
      if (!mapped) continue;
      // Resolve the AppFolio PropertyId on the row to a local Property.
      // For multi-building tenants we MUST NOT fall back to properties[0]
      // — that would make every unit collide on
      // (propertyId, backendListingId) and silently overwrite each other.
      // v2 returns property_id as a number (e.g., 134). Coerce to string
      // so the Map lookup against backendPropertyId actually matches.
      const rawPropRaw = row.property_id ?? row.PropertyId ?? null;
      const rawPropertyId = rawPropRaw != null ? String(rawPropRaw) : null;
      let propertyId: string | null;
      if (rawPropertyId && propertyByExternalId.has(rawPropertyId)) {
        propertyId = propertyByExternalId.get(rawPropertyId) ?? null;
      } else if (propertyByExternalId.size === 1) {
        // Single-property tenants: safe to use the only Property. Read from
        // the map so we pick up properties auto-discovered by Phase 0
        // (the captured `properties` array reflects pre-sync state).
        const onlyId = propertyByExternalId.values().next().value;
        propertyId = onlyId ?? null;
      } else {
        propertyId = null;
      }
      if (!propertyId) {
        stats.warnings.push(
          `listing ${mapped.backendListingId}: no Property mapped (AppFolio PropertyId=${rawPropertyId ?? "none"})`
        );
        continue;
      }
      const syncListingWhere = {
        propertyId_backendListingId: { propertyId, backendListingId: mapped.backendListingId },
      } as const;
      const syncListingData = {
        unitType: mapped.unitType ?? null,
        unitNumber: mapped.unitNumber ?? null,
        bedrooms: mapped.bedrooms ?? null,
        bathrooms: mapped.bathrooms ?? null,
        squareFeet: mapped.squareFeet ?? null,
        priceCents: mapped.priceCents ?? null,
        isAvailable: mapped.isAvailable,
        availableFrom: mapped.availableFrom ?? null,
        photoUrls: mapped.photoUrls
          ? (mapped.photoUrls as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        description: mapped.description ?? null,
        raw: mapped.raw,
        lastSyncedAt: new Date(),
      };
      const existingSyncListing = await prisma.listing.findUnique({ where: syncListingWhere, select: { id: true } });
      if (existingSyncListing) {
        await prisma.listing.update({ where: syncListingWhere, data: syncListingData });
      } else {
        await prisma.listing.create({ data: { propertyId, backendListingId: mapped.backendListingId, ...syncListingData } });
      }
      stats.listingsUpserted += 1;
    }
    phasesCompleted += 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    stats.warnings.push(`listings: ${message}`);
    topLevelError = topLevelError ?? `listings: ${message}`;
  }

  // Listing-by-external-id map for downstream phases that need to bridge
  // unit_id → local Listing.id. Built once after listings are upserted.
  const listings = await prisma.listing.findMany({
    where: { propertyId: { in: properties.map((p) => p.id) } },
    select: { id: true, propertyId: true, backendListingId: true },
  });
  const listingByExternalId = new Map<string, string>();
  for (const l of listings) {
    if (l.backendListingId) listingByExternalId.set(l.backendListingId, l.id);
  }

  // (Properties moved to Phase 0 — see top of function. Removed from the
  // post-Listings position so leads/listings/residents can attribute to
  // a real Property row on the first sync.)

  // 5. RESIDENTS — full tenant_directory roster as Resident rows.
  // residentByExternalId is built so subsequent phases (leases, work
  // orders) can resolve tenant_id → local Resident.id.
  const residentByExternalId = new Map<string, string>();
  try {
    const rows = await fetchAllPages(client, "tenant_directory", {
      extraFilters: { status: "all" },
    });
    let residentsNoProperty = 0;
    for (const row of rows) {
      const mapped = mapResidentPayload(row);
      if (!mapped) continue;
      const propertyId = resolvePropertyId(
        mapped.propertyExternalId ? [mapped.propertyExternalId] : [],
      );
      if (!propertyId) {
        residentsNoProperty += 1;
        continue;
      }
      const listingId =
        (mapped.unitExternalId && listingByExternalId.get(mapped.unitExternalId)) ||
        null;
      const id = await upsertResident(orgId, propertyId, listingId, mapped);
      residentByExternalId.set(mapped.externalId, id);
      stats.residentsUpserted += 1;
    }
    if (residentsNoProperty > 0) {
      stats.warnings.push(
        `residents: ${residentsNoProperty} resident${residentsNoProperty === 1 ? "" : "s"} couldn't be matched to a specific Property (AppFolio omitted property_id in a multi-property account) — skipped rather than risk filing them under the wrong building.`,
      );
    }
    phasesCompleted += 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    stats.warnings.push(`residents: ${message}`);
    topLevelError = topLevelError ?? `residents: ${message}`;
  }

  // 6. LEASES — rent_roll for active leases. Updates Resident.currentLeaseId
  // when we can match the resident.
  const leaseByExternalId = new Map<string, string>();
  try {
    const rows = await fetchAllPages(client, "rent_roll");
    let leasesNoProperty = 0;
    for (const row of rows) {
      const mapped = mapLeasePayload(row);
      if (!mapped) continue;
      const propertyId = resolvePropertyId(
        mapped.propertyExternalId ? [mapped.propertyExternalId] : [],
      );
      if (!propertyId) {
        leasesNoProperty += 1;
        continue;
      }
      const listingId =
        (mapped.unitExternalId && listingByExternalId.get(mapped.unitExternalId)) ||
        null;
      const residentId =
        (mapped.residentExternalId &&
          residentByExternalId.get(mapped.residentExternalId)) ||
        null;
      const leaseId = await upsertLease(orgId, propertyId, listingId, residentId, mapped);
      leaseByExternalId.set(mapped.externalId, leaseId);
      stats.leasesUpserted += 1;
    }
    if (leasesNoProperty > 0) {
      stats.warnings.push(
        `leases: ${leasesNoProperty} lease${leasesNoProperty === 1 ? "" : "s"} couldn't be matched to a specific Property (AppFolio omitted property_id in a multi-property account) — skipped rather than risk filing them under the wrong building.`,
      );
    }
    phasesCompleted += 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    stats.warnings.push(`leases: ${message}`);
    topLevelError = topLevelError ?? `leases: ${message}`;
  }

  // 7. DELINQUENCY — denormalize past-due balance onto each Lease.
  try {
    const rows = await fetchAllPages(client, "delinquency");
    for (const row of rows) {
      const mapped = mapDelinquencyPayload(row);
      if (!mapped) continue;
      const leaseId = leaseByExternalId.get(mapped.leaseExternalId);
      if (!leaseId) {
        // Try to find by external id directly in case rent_roll didn't
        // include this row (e.g., terminated lease still owing money).
        const existing = await prisma.lease.findFirst({
          where: {
            orgId,
            externalSystem: EXTERNAL_SYSTEM,
            externalId: mapped.leaseExternalId,
          },
          select: { id: true },
        });
        if (!existing) continue;
        await prisma.lease.update({
          where: { id: existing.id },
          data: {
            currentBalanceCents: mapped.currentBalanceCents,
            isPastDue: mapped.isPastDue,
            pastDueAsOf: mapped.asOf,
          },
        });
        stats.delinquenciesUpdated += 1;
        continue;
      }
      await prisma.lease.update({
        where: { id: leaseId },
        data: {
          currentBalanceCents: mapped.currentBalanceCents,
          isPastDue: mapped.isPastDue,
          pastDueAsOf: mapped.asOf,
        },
      });
      stats.delinquenciesUpdated += 1;
    }
    phasesCompleted += 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    stats.warnings.push(`delinquency: ${message}`);
    topLevelError = topLevelError ?? `delinquency: ${message}`;
  }

  // 8. WORK ORDERS — maintenance ticket sync.
  try {
    const rows = await fetchAllPages(client, "work_order", { fromDate, toDate });
    let workOrdersNoProperty = 0;
    for (const row of rows) {
      const mapped = mapWorkOrderPayload(row);
      if (!mapped) continue;
      const propertyId = resolvePropertyId(
        mapped.propertyExternalId ? [mapped.propertyExternalId] : [],
      );
      if (!propertyId) {
        workOrdersNoProperty += 1;
        continue;
      }
      const listingId =
        (mapped.unitExternalId && listingByExternalId.get(mapped.unitExternalId)) ||
        null;
      const residentId =
        (mapped.residentExternalId &&
          residentByExternalId.get(mapped.residentExternalId)) ||
        null;
      await upsertWorkOrder(orgId, propertyId, listingId, residentId, mapped);
      stats.workOrdersUpserted += 1;
    }
    if (workOrdersNoProperty > 0) {
      stats.warnings.push(
        `work-orders: ${workOrdersNoProperty} work order${workOrdersNoProperty === 1 ? "" : "s"} couldn't be matched to a specific Property (AppFolio omitted property_id in a multi-property account) — skipped rather than risk filing them under the wrong building.`,
      );
    }
    phasesCompleted += 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    stats.warnings.push(`work-orders: ${message}`);
    topLevelError = topLevelError ?? `work-orders: ${message}`;
  }

  // Connector is "healthy" if at least one phase completed (even with 0
  // rows) — the integration goes back to idle. lastSyncAt advances on
  // any successful phase; warnings persist in lastSyncStats.
  //
  // `allPhasesCompleted` now treats SKIPPED phases as "ran cleanly for
  // this tenant" — the operator either acknowledged the skip with
  // retrySkipped:true (which clears the skip flag) or the cron will
  // auto-retry on a weekly schedule. Either way, a tenant whose plan
  // genuinely doesn't include guest_cards can have a steady-state of
  // "phasesCompleted: 7, phasesSkipped: 1" without false-alarm UI.
  const allPhasesCompleted = phasesCompleted + phasesSkipped === totalPhases;
  const anyPhaseCompleted = phasesCompleted > 0;

  // Bug #16/#25 — Property.lastSyncedAt was only being updated by the
  // legacy `syncListingsForOrg` path. The full-sync pipeline above
  // writes residents/leases/work-orders into properties but never
  // bumped Property.lastSyncedAt, so the property detail page kept
  // showing "Last synced: Never" even after a successful sync. Update
  // every property we touched in this run so the timestamp on the
  // property card matches the AppFolioIntegration.lastSyncAt below.
  if (anyPhaseCompleted && propertyByExternalId.size > 0) {
    try {
      const touched = Array.from(propertyByExternalId.values());
      await prisma.property.updateMany({
        where: { id: { in: touched } },
        data: { lastSyncedAt: new Date() },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.warn("[appfolio-sync] property lastSyncedAt update failed:", msg);
      stats.warnings.push(`property-lastSyncedAt: ${msg}`);
    }
  }

  // Build the persisted stats payload — same shape as in-memory stats plus
  // a few derived fields so the UI doesn't have to recompute them. The
  // phaseFailures map is persisted so the next run can decide whether to
  // skip a phase that's failed 3+ times in a row (e.g. guest_cards on
  // a Core-plan tenant that doesn't expose that report).
  const persistedStats: Prisma.InputJsonValue = {
    leadsUpserted: stats.leadsUpserted,
    toursUpserted: stats.toursUpserted,
    tenantsMatched: stats.tenantsMatched,
    listingsUpserted: stats.listingsUpserted,
    propertiesUpserted: stats.propertiesUpserted,
    residentsUpserted: stats.residentsUpserted,
    leasesUpserted: stats.leasesUpserted,
    workOrdersUpserted: stats.workOrdersUpserted,
    delinquenciesUpdated: stats.delinquenciesUpdated,
    warnings: stats.warnings.slice(0, 50), // cap to avoid runaway JSON
    phasesCompleted,
    phasesSkipped,
    totalPhases,
    completedAt: new Date().toISOString(),
    fullBackfill: !!options.fullBackfill,
    phaseFailures,
  };

  // Partial vs hard-failure distinction. Pre-fix any phase failure set
  // lastError, which flipped the integration status to "failed" and
  // surfaced a rose "AppFolio sync failed" banner on every portal
  // page — even when 5 of 6 phases pulled data successfully. This is
  // what left SG Real Estate staring at a 20-day-old red banner.
  //
  // Now:
  //   - Zero phases completed   → hard failure: set lastError, hold
  //     lastSyncAt at the prior value so the freshness window doesn't
  //     advance over data we don't have.
  //   - Some phases completed   → partial success: clear lastError,
  //     advance lastSyncAt to NOW. Warnings live in lastSyncStats.
  //     Status pill shows "Partial sync" amber, not rose "failed".
  //   - All phases completed    → clean: advance lastSyncAt, clear
  //     lastError.
  try {
    await prisma.appFolioIntegration.update({
      where: { orgId },
      data: {
        syncStatus: anyPhaseCompleted ? "idle" : "error",
        syncStartedAt: null,
        // Advance lastSyncAt whenever ANY phase wrote data. The freshness
        // banner ("AppFolio data is stale, last sync 20d ago") was
        // misleading operators into thinking nothing was syncing —
        // when in reality, properties/residents/leases ARE current and
        // only one phase (leads/guest_cards) was broken.
        lastSyncAt: anyPhaseCompleted ? new Date() : integration.lastSyncAt,
        lastError: !anyPhaseCompleted ? topLevelError : null,
        lastSyncStats: persistedStats,
      },
    });

    await prisma.auditEvent.create({
      data: {
        orgId,
        action: AuditAction.SETTING_CHANGE,
        entityType: "AppFolioIntegration",
        entityId: integration.id,
        description: topLevelError
          ? `AppFolio sync completed with warnings: ${topLevelError}`
          : "AppFolio sync completed",
        diff: {
          leadsUpserted: stats.leadsUpserted,
          toursUpserted: stats.toursUpserted,
          tenantsMatched: stats.tenantsMatched,
          listingsUpserted: stats.listingsUpserted,
          propertiesUpserted: stats.propertiesUpserted,
          residentsUpserted: stats.residentsUpserted,
          leasesUpserted: stats.leasesUpserted,
          workOrdersUpserted: stats.workOrdersUpserted,
          delinquenciesUpdated: stats.delinquenciesUpdated,
          warnings: stats.warnings,
          fullBackfill: !!options.fullBackfill,
          fromDate: fromDate.toISOString(),
          toDate: toDate.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.warn("[appfolio-sync] failed to record completion", err);
  }

  // On-data-arrival insight pass — fires after the sync row commits so
  // detectors see the just-written properties / leases / residents and
  // surface insights within minutes of the user clicking "Connect
  // AppFolio". Non-blocking; errors are caught inside the trigger.
  if (anyPhaseCompleted) {
    try {
      const { triggerInsightsForOrg } = await import("@/lib/insights/triggers");
      triggerInsightsForOrg(orgId, "appfolio_sync_complete");
    } catch (err) {
      console.warn("[appfolio-sync] failed to trigger insights", err);
    }
  }

  return {
    ok: anyPhaseCompleted,
    stats,
    error: !anyPhaseCompleted ? topLevelError ?? undefined : undefined,
  };
}

async function upsertAppfolioLead(
  orgId: string,
  mapped: MappedLead,
  propertyId: string | null
): Promise<void> {
  const where = {
    orgId_externalSystem_externalId: {
      orgId,
      externalSystem: EXTERNAL_SYSTEM,
      externalId: mapped.externalId,
    },
  } as const;

  const data = {
    firstName: mapped.firstName,
    lastName: mapped.lastName,
    email: mapped.email,
    phone: mapped.phone,
    source: mapped.source,
    sourceDetail: mapped.sourceDetail,
    status: mapped.status,
    desiredMoveIn: mapped.desiredMoveIn,
    budgetMaxCents: mapped.budgetMaxCents,
    preferredUnitType: mapped.preferredUnitType,
    notes: mapped.notes,
    lastActivityAt: new Date(),
    propertyId: propertyId ?? undefined,
  };

  const existing = await prisma.lead.findUnique({ where, select: { id: true } });
  if (existing) {
    await prisma.lead.update({ where, data });
  } else {
    await prisma.lead.create({
      data: {
        orgId,
        externalSystem: EXTERNAL_SYSTEM,
        externalId: mapped.externalId,
        firstName: mapped.firstName,
        lastName: mapped.lastName,
        email: mapped.email,
        phone: mapped.phone,
        source: mapped.source,
        sourceDetail: mapped.sourceDetail,
        status: mapped.status,
        desiredMoveIn: mapped.desiredMoveIn,
        budgetMaxCents: mapped.budgetMaxCents,
        preferredUnitType: mapped.preferredUnitType,
        notes: mapped.notes,
        propertyId: propertyId ?? null,
        firstSeenAt: mapped.createdAt ?? new Date(),
        lastActivityAt: new Date(),
      },
    });
  }
}

async function markLeadSignedByTenant(
  orgId: string,
  tenant: MappedTenant
): Promise<boolean> {
  if (!tenant.email) return false;
  const lead = await prisma.lead.findFirst({
    where: { orgId, email: tenant.email },
    select: { id: true, status: true },
  });
  if (!lead) return false;
  if (lead.status === LeadStatus.SIGNED) return true;

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: LeadStatus.SIGNED,
      convertedAt: new Date(),
      lastActivityAt: new Date(),
    },
  });
  return true;
}

// ---------------------------------------------------------------------------
// Slug helper for auto-created Property rows from property_directory. The
// schema requires unique (orgId, slug); collisions get -2, -3, etc.
async function uniquePropertySlug(orgId: string, name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "property";
  let candidate = base;
  let n = 2;
  while (n <= 50) {
    const existing = await prisma.property.findFirst({
      where: { orgId, slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${n++}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Showing upsert. Matches the AppFolio showing to an existing Lead via
// the AppFolio guest_card_id stored on Lead.externalId. Falls through
// to "no_lead" when the guest card hasn't synced yet — re-run the next
// sync after guest_cards lands and the showing will attach.
// ---------------------------------------------------------------------------
async function upsertAppfolioShowing(
  orgId: string,
  mapped: MappedShowing,
): Promise<"ok" | "no_lead"> {
  if (!mapped.leadExternalId) return "no_lead";

  const lead = await prisma.lead.findUnique({
    where: {
      orgId_externalSystem_externalId: {
        orgId,
        externalSystem: EXTERNAL_SYSTEM,
        externalId: mapped.leadExternalId,
      },
    },
    select: { id: true, propertyId: true },
  });
  if (!lead) return "no_lead";

  // Tour requires propertyId; fall back to the lead's propertyId. When
  // the lead doesn't have one set, prefer the org's first ACTIVE
  // property — same fallback rule the Cal webhook uses.
  let propertyId = lead.propertyId;
  if (!propertyId) {
    const fallback = await prisma.property.findFirst({
      where: { orgId, lifecycle: "ACTIVE" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (!fallback) return "no_lead";
    propertyId = fallback.id;
  }

  const existing = await prisma.tour.findFirst({
    where: {
      externalSystem: EXTERNAL_SYSTEM,
      externalId: mapped.externalId,
      property: { orgId },
    },
    select: { id: true },
  });
  if (existing) {
    await prisma.tour.update({
      where: { id: existing.id },
      data: {
        status: mapped.status,
        scheduledAt: mapped.scheduledAt,
        completedAt: mapped.completedAt,
        notes: mapped.notes,
      },
    });
  } else {
    await prisma.tour.create({
      data: {
        leadId: lead.id,
        propertyId,
        externalSystem: EXTERNAL_SYSTEM,
        externalId: mapped.externalId,
        status: mapped.status,
        scheduledAt: mapped.scheduledAt,
        completedAt: mapped.completedAt,
        notes: mapped.notes,
      },
    });
  }
  return "ok";
}

// ---------------------------------------------------------------------------
// Application upsert. Matches the AppFolio applicant to an existing Lead
// by email (the most reliable cross-system join key on Core/Plus plans).
// Returns:
//   "ok"      — upserted (insert OR update)
//   "no_lead" — no matching Lead by email; row skipped
// ---------------------------------------------------------------------------
async function upsertAppfolioApplication(
  orgId: string,
  mapped: MappedApplication,
  propertyId: string,
): Promise<"ok" | "no_lead"> {
  // Match by email (case-insensitive) scoped to this org + property. We
  // prefer same-property matches first; falls back to same-org if not
  // found (covers operators whose AppFolio property mapping is one-off).
  const email = mapped.email?.toLowerCase();
  if (!email) return "no_lead";
  const lead =
    (await prisma.lead.findFirst({
      where: { orgId, propertyId, email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    })) ??
    (await prisma.lead.findFirst({
      where: { orgId, email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    }));
  if (!lead) return "no_lead";

  const applicantData = {
    firstName: mapped.firstName,
    lastName: mapped.lastName,
    email: mapped.email,
    unitName: mapped.unitName,
    desiredMoveIn: mapped.desiredMoveIn?.toISOString() ?? null,
    screeningStatus: mapped.screeningStatus,
    applicantRole: mapped.applicantRole,
  };

  const writeData = {
    status: mapped.status,
    appliedAt: mapped.appliedAt,
    decidedAt: mapped.decidedAt,
    receivedAt: mapped.receivedAt,
    desiredMoveIn: mapped.desiredMoveIn,
    unitName: mapped.unitName,
    unitExternalId: mapped.unitExternalId,
    applicationGroupId: mapped.applicationGroupId,
    applicantRole: mapped.applicantRole,
    screeningStatus: mapped.screeningStatus,
    propertyId,
    applicantData,
  };

  // Idempotent upsert keyed on the (leadId, backendAppId) unique constraint.
  // backendAppId carries the AppFolio applicant id, so re-syncs update in
  // place instead of duplicating — and concurrent syncs can't race a
  // find-then-create gap.
  await prisma.application.upsert({
    where: {
      leadId_backendAppId: {
        leadId: lead.id,
        backendAppId: mapped.externalId,
      },
    },
    create: {
      leadId: lead.id,
      backendAppId: mapped.externalId,
      ...writeData,
    },
    update: writeData,
  });

  // Roll the Lead status forward so the funnel reflects reality. We only
  // promote, never demote — a Lead already past SIGNED won't get knocked
  // back to APPLIED by an AppFolio sync.
  const promoteTo =
    mapped.status === "APPROVED" || mapped.status === "SUBMITTED"
      ? "APPLIED"
      : mapped.status === "STARTED"
        ? "APPLICATION_SENT"
        : null;
  if (promoteTo) {
    // Single atomic conditional update: only promote when the lead is at a
    // strictly lower-ranked status. updateMany with `status: { in: lower }`
    // avoids the read-modify-write race two concurrent syncs would hit, and
    // never demotes (LOST / UNQUALIFIED / SIGNED are outside `lower`, so they
    // never match). A DB failure here surfaces to the phase handler rather
    // than being swallowed.
    const RANK: LeadStatus[] = [
      "NEW",
      "CONTACTED",
      "TOUR_SCHEDULED",
      "TOURED",
      "APPLICATION_SENT",
      "APPLIED",
      "SIGNED",
    ] as LeadStatus[];
    const lowerRanked = RANK.slice(0, RANK.indexOf(promoteTo as LeadStatus));
    if (lowerRanked.length > 0) {
      await prisma.lead.updateMany({
        where: { id: lead.id, status: { in: lowerRanked } },
        data: { status: promoteTo as LeadStatus, lastActivityAt: new Date() },
      });
    }
  }

  return "ok";
}

// ---------------------------------------------------------------------------
// Resident upsert — keyed on (orgId, externalSystem, externalId). Best-effort
// match to an existing Lead by email so the Resident row carries leadId.
async function upsertResident(
  orgId: string,
  propertyId: string,
  listingId: string | null,
  mapped: MappedResident,
): Promise<string> {
  let leadId: string | null = null;
  if (mapped.email) {
    const lead = await prisma.lead.findFirst({
      where: { orgId, email: mapped.email },
      select: { id: true },
    });
    if (lead) leadId = lead.id;
  }

  const where = {
    orgId_externalSystem_externalId: {
      orgId,
      externalSystem: EXTERNAL_SYSTEM,
      externalId: mapped.externalId,
    },
  } as const;
  const data = {
    propertyId,
    listingId,
    leadId,
    firstName: mapped.firstName,
    lastName: mapped.lastName,
    email: mapped.email,
    phone: mapped.phone,
    status: mapped.status,
    unitNumber: mapped.unitNumber,
    moveInDate: mapped.moveInDate,
    moveOutDate: mapped.moveOutDate,
    noticeGivenDate: mapped.noticeGivenDate,
    monthlyRentCents: mapped.monthlyRentCents,
    raw: mapped.raw as unknown as Prisma.InputJsonValue,
  };

  const existing = await prisma.resident.findUnique({ where, select: { id: true } });
  if (existing) {
    await prisma.resident.update({ where, data });
    return existing.id;
  }
  const created = await prisma.resident.create({
    data: {
      orgId,
      externalSystem: EXTERNAL_SYSTEM,
      externalId: mapped.externalId,
      ...data,
    },
  });
  return created.id;
}

// ---------------------------------------------------------------------------
// Lease upsert — keyed on (orgId, externalSystem, externalId). Updates
// Resident.currentLeaseId if both exist.
async function upsertLease(
  orgId: string,
  propertyId: string,
  listingId: string | null,
  residentId: string | null,
  mapped: MappedLease,
): Promise<string> {
  const where = {
    orgId_externalSystem_externalId: {
      orgId,
      externalSystem: EXTERNAL_SYSTEM,
      externalId: mapped.externalId,
    },
  } as const;
  const data = {
    propertyId,
    listingId,
    residentId,
    status: mapped.status,
    startDate: mapped.startDate,
    endDate: mapped.endDate,
    monthlyRentCents: mapped.monthlyRentCents,
    securityDepositCents: mapped.securityDepositCents,
    termMonths: mapped.termMonths,
    raw: mapped.raw as unknown as Prisma.InputJsonValue,
  };

  let leaseId: string;
  const existing = await prisma.lease.findUnique({ where, select: { id: true } });
  if (existing) {
    await prisma.lease.update({ where, data });
    leaseId = existing.id;
  } else {
    const created = await prisma.lease.create({
      data: {
        orgId,
        externalSystem: EXTERNAL_SYSTEM,
        externalId: mapped.externalId,
        ...data,
      },
    });
    leaseId = created.id;
  }

  // Tie this lease as the resident's current lease if it's active/expiring
  // and the resident exists. Don't override a more-recent ACTIVE lease with
  // an older ENDED one.
  if (residentId && (mapped.status === "ACTIVE" || mapped.status === "EXPIRING")) {
    await prisma.resident.update({
      where: { id: residentId },
      data: { currentLeaseId: leaseId },
    });
  }

  return leaseId;
}

// ---------------------------------------------------------------------------
// Work order upsert — keyed on (orgId, externalSystem, externalId).
async function upsertWorkOrder(
  orgId: string,
  propertyId: string,
  listingId: string | null,
  residentId: string | null,
  mapped: MappedWorkOrder,
): Promise<void> {
  const where = {
    orgId_externalSystem_externalId: {
      orgId,
      externalSystem: EXTERNAL_SYSTEM,
      externalId: mapped.externalId,
    },
  } as const;
  const data = {
    propertyId,
    listingId,
    residentId,
    workOrderNumber: mapped.workOrderNumber,
    status: mapped.status,
    priority: mapped.priority,
    category: mapped.category,
    title: mapped.title,
    description: mapped.description,
    unitNumber: mapped.unitNumber,
    vendorName: mapped.vendorName,
    vendorEmail: mapped.vendorEmail,
    reportedAt: mapped.reportedAt,
    scheduledFor: mapped.scheduledFor,
    completedAt: mapped.completedAt,
    estimatedCostCents: mapped.estimatedCostCents,
    actualCostCents: mapped.actualCostCents,
    raw: mapped.raw as unknown as Prisma.InputJsonValue,
  };
  const existing = await prisma.workOrder.findUnique({ where, select: { id: true } });
  if (existing) {
    await prisma.workOrder.update({ where, data });
    return;
  }
  await prisma.workOrder.create({
    data: {
      orgId,
      externalSystem: EXTERNAL_SYSTEM,
      externalId: mapped.externalId,
      ...data,
    },
  });
}
