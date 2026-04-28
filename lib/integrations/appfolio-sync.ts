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
  type MappedLead,
  type MappedTenant,
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
  const totalPhases = 3;

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
