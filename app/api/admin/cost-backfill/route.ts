import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiUsageStatus } from "@prisma/client";
import { requireAgency } from "@/lib/tenancy/scope";
import { usdToMicroCents } from "@/lib/cost-tracker/log";
import {
  ESTIMATED_AUDIT_COST_BY_PROVIDER,
  ESTIMATED_SNAPSHOT_COST_BY_PROVIDER,
  fetchDataForSeoTotalSpentUsd,
} from "@/lib/cost-tracker/backfill";

// ---------------------------------------------------------------------------
// POST /api/admin/cost-backfill
//
// One-shot endpoint that synthesizes ApiUsage rows from existing
// ProspectAudit + DailySignalSnapshot data so /admin/costs has
// meaningful historical context.
//
// Idempotent: every synthesized row carries a unique `meta.backfillKey`
// (composed from row id + provider). The endpoint deletes any prior
// synthesized rows with the same key before inserting new ones, so
// re-running the backfill won't double-count.
//
// What gets written:
//   1. One ApiUsage row per (ProspectAudit, provider) pair using
//      ESTIMATED_AUDIT_COST_BY_PROVIDER. Tagged with the prospectAuditId
//      and synthesized=true.
//   2. One ApiUsage row per (DailySignalSnapshot, provider) pair using
//      ESTIMATED_SNAPSHOT_COST_BY_PROVIDER. Tagged with orgId.
//   3. One DataForSEO "ground-truth" reconciliation row carrying the
//      real lifetime spend from /v3/appendix/user_data, minus the
//      sum of the per-call rows we just synthesized for dataforseo.
//      The remainder is "tracked elsewhere on the account" — usually
//      manual SEO Agent runs that don't correspond to a ProspectAudit.
//
// All synthesized rows are timestamped at the source row's `createdAt`
// so the /admin/costs day/week/month rollups respect chronology.
//
// Returns a JSON summary of how many rows were written/replaced + the
// DataForSEO reconciliation delta so the operator can verify.
// ---------------------------------------------------------------------------

export const maxDuration = 60;

const BACKFILL_PROVIDER_LABEL = "leasestack-backfill";

export async function POST(req: NextRequest) {
  try {
    await requireAgency();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    /** Optional: how far back to walk. Defaults to 90 days. */
    sinceDays?: number;
  };
  const sinceDays = Math.min(365, Math.max(1, body.sinceDays ?? 90));
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  // --- 1. Drop any prior synthesized rows so re-running is idempotent ----
  // We identify synthesized rows by provider tag "leasestack-backfill"
  // (the reconciliation row) and by meta.synthesized=true (per-call
  // synthesized rows). Two deletes to cover both.
  await prisma.$executeRaw`
    DELETE FROM "ApiUsage"
    WHERE provider = ${BACKFILL_PROVIDER_LABEL}
       OR (meta IS NOT NULL AND meta->>'synthesized' = 'true');
  `;

  // --- 2. Walk ProspectAudit rows + synthesize per-provider per-audit -----
  const audits = await prisma.prospectAudit.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id: true,
      domain: true,
      brandName: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  type SeedRow = {
    provider: string;
    endpoint: string;
    status: ApiUsageStatus;
    costMicroCents: number;
    orgId: string | null;
    propertyId: string | null;
    prospectAuditId: string | null;
    durationMs: number | null;
    meta: Record<string, unknown>;
    createdAt: Date;
  };

  const auditRows: SeedRow[] = [];
  for (const audit of audits) {
    for (const [provider, cost] of Object.entries(
      ESTIMATED_AUDIT_COST_BY_PROVIDER,
    )) {
      auditRows.push({
        provider,
        endpoint: `${provider}/prospect-audit`,
        status: ApiUsageStatus.SUCCESS,
        costMicroCents: usdToMicroCents(cost),
        orgId: null,
        propertyId: null,
        prospectAuditId: audit.id,
        durationMs: null,
        meta: {
          synthesized: true,
          backfillKind: "prospect_audit",
          backfillKey: `audit:${audit.id}:${provider}`,
          domain: audit.domain,
          brandName: audit.brandName,
          auditStatus: audit.status,
          note: "Estimated from observed pipeline shape — actual per-call dollars only available from 2026-05-29 onward.",
        },
        createdAt: audit.createdAt,
      });
    }
  }

  // --- 3. Walk DailySignalSnapshot rows + synthesize tenant cron rows -----
  // Filter to tenant-scope snapshots (prospect snapshots would double-
  // count against the audits we already walked). Tenant snapshots have
  // a scopeKey like "tenant:{orgId}:{propertyId|_}".
  const snapshots = await prisma.dailySignalSnapshot.findMany({
    where: {
      capturedOn: { gte: since.toISOString().slice(0, 10) },
      scopeKey: { startsWith: "tenant:" },
    },
    select: {
      id: true,
      orgId: true,
      propertyId: true,
      capturedOn: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    // Cap at 5000 to keep the transaction bounded. Realistically we'll
    // never exceed this in the early-tenant period.
    take: 5000,
  });

  const snapshotRows: SeedRow[] = [];
  for (const snap of snapshots) {
    for (const [provider, cost] of Object.entries(
      ESTIMATED_SNAPSHOT_COST_BY_PROVIDER,
    )) {
      snapshotRows.push({
        provider,
        endpoint: `${provider}/signals-daily`,
        status: ApiUsageStatus.SUCCESS,
        costMicroCents: usdToMicroCents(cost),
        orgId: snap.orgId ?? null,
        propertyId: snap.propertyId ?? null,
        prospectAuditId: null,
        durationMs: null,
        meta: {
          synthesized: true,
          backfillKind: "tenant_snapshot",
          backfillKey: `snapshot:${snap.id}:${provider}`,
          capturedOn: snap.capturedOn,
          note: "Estimated from observed cron-fan-out shape — actual per-call dollars only available from 2026-05-29 onward.",
        },
        createdAt: snap.createdAt,
      });
    }
  }

  // --- 4. DataForSEO reconciliation row ----------------------------------
  // Pull real lifetime spent from DataForSEO's appendix/user_data. The
  // delta between that and the dataforseo rows we just synthesized lives
  // in a "BACKFILL_PROVIDER_LABEL" row so it shows up on the dashboard
  // total without inflating dataforseo's own bucket (which is for
  // forward, per-call attributed data).
  const dataForSeoLifetimeSpent = await fetchDataForSeoTotalSpentUsd();
  const synthesizedDataForSeoUsd =
    (auditRows.length / Object.keys(ESTIMATED_AUDIT_COST_BY_PROVIDER).length) *
      ESTIMATED_AUDIT_COST_BY_PROVIDER.dataforseo +
    (snapshotRows.length /
      Object.keys(ESTIMATED_SNAPSHOT_COST_BY_PROVIDER).length) *
      ESTIMATED_SNAPSHOT_COST_BY_PROVIDER.dataforseo;

  let reconciliationRow: SeedRow | null = null;
  let reconciliationDelta: number | null = null;
  if (dataForSeoLifetimeSpent != null) {
    reconciliationDelta = Math.max(
      0,
      dataForSeoLifetimeSpent - synthesizedDataForSeoUsd,
    );
    if (reconciliationDelta > 0.001) {
      reconciliationRow = {
        provider: BACKFILL_PROVIDER_LABEL,
        endpoint: "dataforseo/reconciliation",
        status: ApiUsageStatus.SUCCESS,
        costMicroCents: usdToMicroCents(reconciliationDelta),
        orgId: null,
        propertyId: null,
        prospectAuditId: null,
        durationMs: null,
        meta: {
          synthesized: true,
          backfillKind: "vendor_reconciliation",
          source: "dataforseo /v3/appendix/user_data",
          lifetimeSpentUsd: dataForSeoLifetimeSpent,
          attributedToAuditsUsd: synthesizedDataForSeoUsd,
          deltaUsd: reconciliationDelta,
          note: "Difference between DataForSEO's lifetime account spend and the per-audit estimates we attributed. Probably manual SEO Agent runs from before 2026-05-29.",
        },
        // Timestamp the reconciliation at "now" so it doesn't skew the
        // historical day-rollup distribution.
        createdAt: new Date(),
      };
    }
  }

  // --- 5. Bulk insert -----------------------------------------------------
  const allRows = [...auditRows, ...snapshotRows];
  if (reconciliationRow) allRows.push(reconciliationRow);

  // createMany doesn't accept Date for the JSON `meta` field via the
  // typed client without explicit casting. Map each row to the shape
  // Prisma expects.
  if (allRows.length > 0) {
    await prisma.apiUsage.createMany({
      data: allRows.map((r) => ({
        provider: r.provider,
        endpoint: r.endpoint,
        status: r.status,
        costMicroCents: r.costMicroCents,
        orgId: r.orgId,
        propertyId: r.propertyId,
        prospectAuditId: r.prospectAuditId,
        durationMs: r.durationMs,
        meta: r.meta as never,
        createdAt: r.createdAt,
      })),
    });
  }

  return NextResponse.json({
    ok: true,
    summary: {
      sinceDays,
      since: since.toISOString(),
      audits: audits.length,
      tenantSnapshots: snapshots.length,
      synthesizedRowsInserted: allRows.length,
      dataForSeoLifetimeSpentUsd: dataForSeoLifetimeSpent,
      attributedToAuditsUsd: Number(synthesizedDataForSeoUsd.toFixed(4)),
      reconciliationDeltaUsd:
        reconciliationDelta != null
          ? Number(reconciliationDelta.toFixed(4))
          : null,
    },
  });
}
