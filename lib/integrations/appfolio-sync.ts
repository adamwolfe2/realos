import "server-only";
import { prisma } from "@/lib/db";
import {
  AuditAction,
  BackendPlatform,
  LeadStatus,
  Prisma,
  TourStatus,
} from "@prisma/client";
import {
  appfolioRestClient,
  fetchAllPages,
  mapLeadPayload,
  mapListingPayload,
  mapShowingPayload,
  mapTenantPayload,
  type MappedLead,
  type MappedShowing,
  type MappedTenant,
} from "./appfolio";

// ---------------------------------------------------------------------------
// AppFolio REST sync worker.
//
// Runs four reports in order (leads, showings, tenants, listings), each
// wrapped so one failure doesn't kill the whole sync. Idempotent via the
// compound unique indexes on (orgId, externalSystem, externalId) for Lead
// and (externalSystem, externalId) for Tour — see prisma/schema.prisma.
//
// Date windows:
//   - first sync (lastSyncAt null) or fullBackfill === true  → last 90 days
//   - incremental (lastSyncAt set)                            → since lastSyncAt
// ---------------------------------------------------------------------------

const EXTERNAL_SYSTEM = "appfolio";
const DEFAULT_BACKFILL_DAYS = 90;

export type AppfolioSyncStats = {
  leadsUpserted: number;
  toursUpserted: number;
  tenantsMatched: number;
  listingsUpserted: number;
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

  await prisma.appFolioIntegration.update({
    where: { orgId },
    data: { syncStatus: "syncing", lastError: null },
  });

  let client;
  try {
    client = appfolioRestClient(integration);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.appFolioIntegration.update({
      where: { orgId },
      data: { syncStatus: "error", lastError: message },
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
  const fallbackPropertyId = properties[0]?.id ?? null;

  function resolvePropertyId(externalIds: string[]): string | null {
    for (const eid of externalIds) {
      const hit = propertyByExternalId.get(eid);
      if (hit) return hit;
    }
    return fallbackPropertyId;
  }

  let topLevelError: string | null = null;
  // Resilience: track per-phase completion separately from row counts. A
  // phase that runs the request to completion (even with 0 rows) counts as
  // "the connector worked" — the integration goes back to idle. But we
  // only advance lastSyncAt to "now" when *every* phase completed, so a
  // partial failure doesn't shrink the failed phase's window forever on
  // subsequent incremental syncs.
  let phasesCompleted = 0;
  const totalPhases = 4;

  // 1. LEADS — AppFolio v2 report: prospect_source_tracking
  try {
    const rows = await fetchAllPages(client, "prospect_source_tracking", { fromDate, toDate });
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

  // 2. SHOWINGS (→ Tours). Note: `showings` is a v1 CRUD entity, not a v2
  // report — AppFolio may reject it with "Id is not a valid report." If it
  // does, the resilience guard above keeps the sync from being blocked.
  try {
    const rows = await fetchAllPages(client, "showings", { fromDate, toDate });
    for (const row of rows) {
      const mapped = mapShowingPayload(row);
      if (!mapped) continue;
      const upserted = await upsertAppfolioTour(orgId, mapped, fallbackPropertyId);
      if (upserted) stats.toursUpserted += 1;
      else stats.warnings.push(`showing ${mapped.externalId}: no matching lead`);
    }
    phasesCompleted += 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    stats.warnings.push(`showings: ${message}`);
    topLevelError = topLevelError ?? `showings: ${message}`;
  }

  // 3. TENANTS (→ Lead SIGNED attribution)
  try {
    const rows = await fetchAllPages(client, "tenant_directory", {
      fromDate,
      toDate,
    });
    for (const row of rows) {
      const mapped = mapTenantPayload(row);
      if (!mapped || !mapped.email) continue;
      const matched = await markLeadSignedByTenant(orgId, mapped);
      if (matched) stats.tenantsMatched += 1;
    }
    phasesCompleted += 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    stats.warnings.push(`tenants: ${message}`);
    topLevelError = topLevelError ?? `tenants: ${message}`;
  }

  // 4. UNITS / LISTINGS — pulled from `unit_directory` (v2 directory report).
  try {
    const rows = await fetchAllPages(client, "unit_directory", {
      fromDate: options.fullBackfill
        ? new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        : fromDate,
      toDate,
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
      const rawPropertyId =
        (row.PropertyId as string | undefined) ??
        (row.property_id as string | undefined) ??
        null;
      let propertyId: string | null;
      if (rawPropertyId && propertyByExternalId.has(rawPropertyId)) {
        propertyId = propertyByExternalId.get(rawPropertyId) ?? null;
      } else if (properties.length === 1) {
        // Single-property tenants: safe to use the only Property.
        propertyId = fallbackPropertyId;
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

  // Connector is "healthy" if at least one phase completed (even with 0
  // rows) — the integration goes back to idle. But lastSyncAt only
  // advances when *every* phase completed; partial syncs preserve the
  // existing lastSyncAt so the failed phase's window doesn't shrink and
  // lose unsynced data.
  const allPhasesCompleted = phasesCompleted === totalPhases;
  const anyPhaseCompleted = phasesCompleted > 0;

  try {
    await prisma.appFolioIntegration.update({
      where: { orgId },
      data: {
        syncStatus: anyPhaseCompleted ? "idle" : "error",
        lastSyncAt: allPhasesCompleted
          ? new Date()
          : integration.lastSyncAt,
        lastError:
          anyPhaseCompleted && !allPhasesCompleted
            ? topLevelError
            : !anyPhaseCompleted
              ? topLevelError
              : null,
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

async function upsertAppfolioTour(
  orgId: string,
  mapped: MappedShowing,
  fallbackPropertyId: string | null
): Promise<boolean> {
  if (!mapped.leadExternalId) return false;

  const lead = await prisma.lead.findUnique({
    where: {
      orgId_externalSystem_externalId: {
        orgId,
        externalSystem: EXTERNAL_SYSTEM,
        externalId: mapped.leadExternalId,
      },
    },
    select: { id: true, propertyId: true, status: true },
  });
  if (!lead) return false;

  const propertyId = lead.propertyId ?? fallbackPropertyId;
  if (!propertyId) return false;

  const tourWhere = {
    externalSystem_externalId: {
      externalSystem: EXTERNAL_SYSTEM,
      externalId: mapped.externalId,
    },
  } as const;
  const tourData = {
    leadId: lead.id,
    propertyId,
    status: mapped.status,
    scheduledAt: mapped.scheduledAt,
    completedAt: mapped.completedAt,
    notes: mapped.notes,
  };
  const existingTour = await prisma.tour.findUnique({ where: tourWhere, select: { id: true } });
  if (existingTour) {
    await prisma.tour.update({ where: tourWhere, data: tourData });
  } else {
    await prisma.tour.create({
      data: {
        ...tourData,
        externalSystem: EXTERNAL_SYSTEM,
        externalId: mapped.externalId,
      },
    });
  }

  // Auto-advance lead status when a tour is scheduled.
  if (
    mapped.status === TourStatus.SCHEDULED &&
    (lead.status === LeadStatus.NEW || lead.status === LeadStatus.CONTACTED)
  ) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: LeadStatus.TOUR_SCHEDULED,
        lastActivityAt: new Date(),
      },
    });
  } else if (
    mapped.status === TourStatus.COMPLETED &&
    (lead.status === LeadStatus.NEW ||
      lead.status === LeadStatus.CONTACTED ||
      lead.status === LeadStatus.TOUR_SCHEDULED)
  ) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: LeadStatus.TOURED,
        lastActivityAt: new Date(),
      },
    });
  }

  return true;
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
