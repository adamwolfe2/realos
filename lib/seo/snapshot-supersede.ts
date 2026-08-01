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

export function dedupeSupersededByDate<
  T extends { date: Date; propertyId: string | null },
>(rows: T[]): T[] {
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
  return dedupeSupersededByDate(rows);
}

export function sumField(
  rows: DedupedSeoSnapshotRow[],
  field: "organicSessions" | "totalClicks",
): number {
  return rows.reduce((acc, r) => acc + r[field], 0);
}
