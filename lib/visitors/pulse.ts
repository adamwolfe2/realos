// ---------------------------------------------------------------------------
// Visit pulse — buckets raw firstSeenAt timestamps into UTC daily counts,
// oldest to newest, so the strip below the KPI tiles reads left-to-right as
// a calendar. Pure function, no dependency on the request's local timezone.
// Rows older than the window (idx < 0) are dropped; callers must derive the
// headline total from the RETURNED buckets (sum), never from the raw row
// count, so the number always matches the bars.
// ---------------------------------------------------------------------------

export function bucketDailyCounts(dates: Date[], days: number): number[] {
  const buckets = new Array(days).fill(0);
  const now = new Date();
  const todayUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  for (const d of dates) {
    const dUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const diffDays = Math.round((todayUTC - dUTC) / 86_400_000);
    const idx = days - 1 - diffDays;
    if (idx >= 0 && idx < days) buckets[idx] += 1;
  }
  return buckets;
}
