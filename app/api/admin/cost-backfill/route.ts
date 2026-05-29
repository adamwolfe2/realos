import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiUsageStatus, Prisma } from "@prisma/client";
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

// Bumped from 60 → 120 because the backfill walks every audit + tenant
// snapshot in the last 90 days × 6 providers. A small portfolio of 50
// audits = 300 row inserts (fast), but a future ~1000-event window
// would push the upsert + DataForSEO HEAD probe past the 60s ceiling.
export const maxDuration = 120;

const BACKFILL_PROVIDER_LABEL = "leasestack-backfill";

export async function POST(req: NextRequest) {
  try {
    await requireAgency();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Whole-route try/catch so any Prisma/network throw returns a JSON
  // error response instead of an empty body + 500 (which made the
  // client throw "Unexpected end of JSON input" instead of showing
  // the real error message).
  try {
    const body = (await req.json().catch(() => ({}))) as {
      /** Optional: how far back to walk. Defaults to 90 days. */
      sinceDays?: number;
    };
    const sinceDays = Math.min(365, Math.max(1, body.sinceDays ?? 90));
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

    // --- 1. Drop any prior synthesized rows so re-running is idempotent --
    // We identify synthesized rows by provider tag "leasestack-backfill"
    // (the reconciliation row) and by meta.synthesized=true (per-call
    // synthesized rows). Two deletes to cover both.
    await prisma.$executeRaw`
      DELETE FROM "ApiUsage"
      WHERE provider = ${BACKFILL_PROVIDER_LABEL}
         OR (meta IS NOT NULL AND meta->>'synthesized' = 'true');
    `;

    // --- 2. Walk ProspectAudit rows + synthesize per-provider per-audit --
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
  //
  // capturedOn is DateTime @db.Date — pass a Date object, not a string.
  // The earlier `.toISOString().slice(0, 10)` was what made Prisma's
  // type validator reject the query with PrismaClientValidationError.
  const snapshots = await prisma.dailySignalSnapshot.findMany({
    where: {
      capturedOn: { gte: since },
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

  // createMany — cast meta through Prisma's InputJsonValue. The
  // earlier `as never` cast compiled fine but the runtime Prisma
  // validator rejected the createMany call (PrismaClientValidationError).
  // Casting through InputJsonValue tells Prisma the JSON shape is
  // explicitly safe to serialize.
  //
  // Postgres parameter limit is 65535. Each row uses ~10 parameters,
  // so we batch in chunks of ~5000 to stay well under the ceiling.
  if (allRows.length > 0) {
    const BATCH = 1000;
    for (let i = 0; i < allRows.length; i += BATCH) {
      const slice = allRows.slice(i, i + BATCH);
      await prisma.apiUsage.createMany({
        data: slice.map((r) => ({
          provider: r.provider,
          endpoint: r.endpoint,
          status: r.status,
          costMicroCents: r.costMicroCents,
          orgId: r.orgId,
          propertyId: r.propertyId,
          prospectAuditId: r.prospectAuditId,
          durationMs: r.durationMs,
          meta: r.meta as Prisma.InputJsonValue,
          createdAt: r.createdAt,
        })),
      });
    }
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
  } catch (err) {
    // Surface real error messages as JSON so the client doesn't fail
    // to parse the response. PrismaClientValidationError, network
    // errors, anything — all land as a structured payload the banner
    // can display verbatim.
    const message =
      err instanceof Error ? err.message : "Unknown backfill error";
    console.error("[cost-backfill] failed:", err);
    return NextResponse.json(
      { ok: false, error: message.slice(0, 800) },
      { status: 500 },
    );
  }
}
