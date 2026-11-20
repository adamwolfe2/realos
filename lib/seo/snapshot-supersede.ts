import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Read-side mirror of the seo-sync write-side "supersede" policy (see
// lib/integrations/seo-sync.ts, "Double-counting write-side policy"): once a
// property-scoped SeoSnapshot row exists for a date, the org-wide
// (propertyId NULL) row for that same date should not also be counted —
// otherwise an unfiltered org-wide sum double-counts that date's traffic.
//
// The write-side delete is NOT airtight, so read sites can't just trust it:
//   - it's best-effort — a deleteMany failure is caught and only logged as
//     a warning (deleteSupersededNullRows), leaving the stale NULL row
//   - seed/backfill scripts (scripts/seed-*.ts) write SeoSnapshot rows
//     directly and never invoke the supersede cleanup
// So any org-wide (unfiltered) aggregate read applies this same rule
// itself instead of assuming the write path already handled it.
//
// Safe to apply even to already property-filtered reads: when every row
// in the input has a non-null propertyId (because the caller's `where`
// already constrained propertyId), this is a no-op.
// ---------------------------------------------------------------------------

//
// Exception (same one the write side makes): when the org still has a live
// org-wide (propertyId NULL) integration, its NULL rows are that connection's
// own site, not a stale blend of the property rows. Dropping them silently
// removes that site's traffic (SG: Telegraph Commons is on the org-wide
// connection while four sibling sites have their own). Pass orgWideLive.
export function dedupeSupersededByDate<
  T extends { date: Date; propertyId: string | null },
>(rows: T[], orgWideLive = false): T[] {
  if (orgWideLive) return rows;
  const datesWithProperty = new Set(
    rows.filter((r) => r.propertyId !== null).map((r) => r.date.getTime()),
  );
  return rows.filter(
    (r) => r.propertyId !== null || !datesWithProperty.has(r.date.getTime()),
  );
}

export type DedupedSeoSnapshotRow = {
  date: Date;
  propertyId: string | null;
  organicSessions: number;
  totalClicks: number;
};

/**
 * Supersede dedupe for one org's rows. Looks up the org-wide connection only
 * when the rows actually mix NULL and property rows (the only case the
 * dedupe would drop anything), so property-filtered reads cost no query.
 */
export async function dedupeSupersededForOrg<
  T extends { date: Date; propertyId: string | null },
>(rows: T[], orgId: string | undefined): Promise<T[]> {
  const mixed =
    rows.some((r) => r.propertyId === null) &&
    rows.some((r) => r.propertyId !== null);
  if (!mixed) return rows;
  const orgWideLive = orgId
    ? (await prisma.seoIntegration.count({ where: { orgId, propertyId: null } })) > 0
    : false;
  return dedupeSupersededByDate(rows, orgWideLive);
}

/** Fetch SeoSnapshot rows for a where-clause and apply the supersede dedupe. */
export async function fetchDedupedSeoSnapshots(
  where: Prisma.SeoSnapshotWhereInput,
): Promise<DedupedSeoSnapshotRow[]> {
  const rows = await prisma.seoSnapshot.findMany({
    where,
    select: {
      date: true,
      propertyId: true,
      organicSessions: true,
      totalClicks: true,
    },
  });
  return dedupeSupersededForOrg(
    rows,
    typeof where.orgId === "string" ? where.orgId : undefined,
  );
}

export function sumField(
  rows: DedupedSeoSnapshotRow[],
  field: "organicSessions" | "totalClicks",
): number {
  return rows.reduce((acc, r) => acc + r[field], 0);
}
