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
  mapLeadPayload,
  mapListingPayload,
  mapTenantPayload,
  mapResidentPayload,
  mapLeasePayload,
  mapDelinquencyPayload,
  mapWorkOrderPayload,
  mapPropertyPayload,
  type MappedLead,
  type MappedTenant,
  type MappedResident,
  type MappedLease,
  type MappedWorkOrder,
} from "./appfolio";

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
const DEFAULT_BACKFILL_DAYS = 90;

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
  warnings: string[];
};

export type AppfolioSyncResult = {
  ok: boolean;
  stats: AppfolioSyncStats;
  error?: string;
};

export async function runAppfolioSync(
  orgId: string,
  options: { fullBackfill?: boolean } = {}
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

  // Derive the fallback Property at call time, not capture time. Phase 0
  // (Properties auto-discovery) runs first and may have populated
  // propertyByExternalId after this block; downstream phases that fall
  // back when AppFolio omits property_id need to see those new entries.
  function getFallbackPropertyId(): string | null {
    if (propertyByExternalId.size === 0) return null;
    return propertyByExternalId.values().next().value ?? null;
  }

  function resolvePropertyId(externalIds: string[]): string | null {
    for (const eid of externalIds) {
      const hit = propertyByExternalId.get(eid);
      if (hit) return hit;
    }
    return getFallbackPropertyId();
  }

  let topLevelError: string | null = null;
  // Resilience: track per-phase completion separately from row counts. A
  // phase that runs the request to completion (even with 0 rows) counts as
  // "the connector worked" — the integration goes back to idle. But we
  // only advance lastSyncAt to "now" when *every* phase completed, so a
  // partial failure doesn't shrink the failed phase's window forever on
  // subsequent incremental syncs.
  let phasesCompleted = 0;
  const totalPhases = 8;

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
        select: { id: true },
      });
      if (existing) {
        // Property already known. User-edited fields stay sticky; we
        // still ensure it's in our local map for downstream phases.
        propertyByExternalId.set(mapped.externalId, existing.id);
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
      const created = await prisma.property.create({
        data: {
          orgId,
          name: mapped.name ?? `Property ${mapped.externalId}`,
          slug,
          propertyType: "RESIDENTIAL",
          backendPlatform: BackendPlatform.APPFOLIO,
          backendPropertyId: mapped.externalId,
          addressLine1: mapped.addressLine1,
          addressLine2: mapped.addressLine2,
          city: mapped.city,
          state: mapped.state,
          postalCode: mapped.postalCode,
          country: mapped.country,
          totalUnits: mapped.totalUnits,
          yearBuilt: mapped.yearBuilt,
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
  try {
    const rows = await fetchAllPages(client, "guest_cards", { fromDate, toDate });
    for (const row of rows) {
      const mapped = mapLeadPayload(row);
      if (!mapped) continue;
      await upsertAppfolioLead(orgId, mapped, resolvePropertyId(mapped.propertyIds));
      stats.leadsUpserted += 1;
    }
    phasesCompleted += 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    stats.warnings.push(`leads: ${message}`);
    topLevelError = topLevelError ?? `leads: ${message}`;
  }

  // (Tours intentionally skipped: showings is a v1 CRUD entity, not a v2
  // report. Tour bookings arrive via the Cal.com webhook instead.)

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
    for (const row of rows) {
      const mapped = mapResidentPayload(row);
      if (!mapped) continue;
      const propertyId =
        (mapped.propertyExternalId &&
          propertyByExternalId.get(mapped.propertyExternalId)) ||
        getFallbackPropertyId();
      if (!propertyId) {
        stats.warnings.push(
          `resident ${mapped.externalId}: no Property mapped`,
        );
        continue;
      }
      const listingId =
        (mapped.unitExternalId && listingByExternalId.get(mapped.unitExternalId)) ||
        null;
      const id = await upsertResident(orgId, propertyId, listingId, mapped);
      residentByExternalId.set(mapped.externalId, id);
      stats.residentsUpserted += 1;
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
    for (const row of rows) {
      const mapped = mapLeasePayload(row);
      if (!mapped) continue;
      const propertyId =
        (mapped.propertyExternalId &&
          propertyByExternalId.get(mapped.propertyExternalId)) ||
        getFallbackPropertyId();
      if (!propertyId) {
        stats.warnings.push(`lease ${mapped.externalId}: no Property mapped`);
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
    for (const row of rows) {
      const mapped = mapWorkOrderPayload(row);
      if (!mapped) continue;
      const propertyId =
        (mapped.propertyExternalId &&
          propertyByExternalId.get(mapped.propertyExternalId)) ||
        getFallbackPropertyId();
      if (!propertyId) {
        stats.warnings.push(`work-order ${mapped.externalId}: no Property mapped`);
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
    phasesCompleted += 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    stats.warnings.push(`work-orders: ${message}`);
    topLevelError = topLevelError ?? `work-orders: ${message}`;
  }

  // Connector is "healthy" if at least one phase completed (even with 0
  // rows) — the integration goes back to idle. But lastSyncAt only
  // advances when *every* phase completed; partial syncs preserve the
  // existing lastSyncAt so the failed phase's window doesn't shrink and
  // lose unsynced data.
  const allPhasesCompleted = phasesCompleted === totalPhases;
  const anyPhaseCompleted = phasesCompleted > 0;

  // Build the persisted stats payload — same shape as in-memory stats plus
  // a few derived fields so the UI doesn't have to recompute them.
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
    totalPhases,
    completedAt: new Date().toISOString(),
    fullBackfill: !!options.fullBackfill,
  };

  try {
    await prisma.appFolioIntegration.update({
      where: { orgId },
      data: {
        syncStatus: anyPhaseCompleted ? "idle" : "error",
        // Always clear the start-time marker on completion. Stuck-sync
        // detection in the status helper only fires while syncStartedAt
        // is set + syncStatus === "syncing" — leaving it set here would
        // false-positive the next page load.
        syncStartedAt: null,
        lastSyncAt: allPhasesCompleted
          ? new Date()
          : integration.lastSyncAt,
        lastError:
          anyPhaseCompleted && !allPhasesCompleted
            ? topLevelError
            : !anyPhaseCompleted
              ? topLevelError
              : null,
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
