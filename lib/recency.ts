import "server-only";

// ---------------------------------------------------------------------------
// Single source of truth for recency / sample-size cutoffs.
//
// Bloat Day Track C — every "this data is too old" or "-100% on N=1" bug
// across the portal ultimately routes through one of the helpers below.
// Adding a new window? Append to RECENCY_WINDOW so the next time a customer
// reports a stale-data bug we have ONE place to look. Time-window strings
// shown to operators (?window=24h|7d|30d|90d|all) map through parseTimeWindow
// + timeWindowGte so the UI tab string and the prisma where clause can never
// drift out of sync.
// ---------------------------------------------------------------------------

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * Standard recency windows. Use these instead of magic numbers in components
 * and queries. Adding a new window? Append here so future "this is too old"
 * bugs all map to one file.
 */
export const RECENCY_WINDOW = {
  day: DAY,
  week: 7 * DAY,
  month: 30 * DAY,
  quarter: 90 * DAY, // default for "recent mentions" everywhere
  half_year: 180 * DAY,
  year: 365 * DAY,
} as const;

export type RecencyKey = keyof typeof RECENCY_WINDOW;

export type TimeWindow = "24h" | "7d" | "30d" | "90d" | "all";

export const TIME_WINDOW_MS: Record<Exclude<TimeWindow, "all">, number> = {
  "24h": DAY,
  "7d": 7 * DAY,
  "30d": 30 * DAY,
  "90d": 90 * DAY,
};

export function parseTimeWindow(
  value: string | string[] | undefined,
  fallback: TimeWindow = "7d",
): TimeWindow {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === "24h" || v === "7d" || v === "30d" || v === "90d" || v === "all") {
    return v;
  }
  return fallback;
}

/**
 * Returns the `gte` Date for use in Prisma `where: { createdAt: { gte } }`.
 * `null` for 'all' so the caller can spread `...(gte ? { createdAt: { gte } } : {})`.
 */
export function timeWindowGte(window: TimeWindow): Date | null {
  if (window === "all") return null;
  return new Date(Date.now() - TIME_WINDOW_MS[window]);
}

/** Predicate: is `date` within the last `windowMs` ms from now? */
export function withinWindow(
  date: Date | null | undefined,
  windowMs: number,
): boolean {
  if (!date) return false;
  return Date.now() - date.getTime() <= windowMs;
}

export type SuppressedDelta = {
  display: string;
  lowSample: boolean;
  pct: number | null;
  direction: "up" | "down" | "flat" | null;
};

/**
 * Suppress low-sample percentage deltas. Stops "-100%" rendering when the
 * prior or current value is too small to be meaningful (e.g. previous=1,
 * current=0 → -100%). Returns `{ display: '—', lowSample: true }` below
 * threshold. Otherwise returns a formatted percentage string with direction
 * metadata so the caller can tint accordingly.
 *
 * Used by report KPI tiles (fixes Bug #112).
 */
export function suppressLowSampleDelta(
  current: number,
  previous: number,
  threshold = 5,
): SuppressedDelta {
  if (
    Math.abs(current) < threshold ||
    Math.abs(previous) < threshold ||
    previous === 0
  ) {
    return { display: "—", lowSample: true, pct: null, direction: null };
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  const direction: SuppressedDelta["direction"] =
    rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  return {
    display: `${sign}${Math.abs(rounded)}%`,
    lowSample: false,
    pct: rounded,
    direction,
  };
}

/**
 * Period-aware window for monthly/weekly reports. Returns the `gte` date that
 * "recent" should mean inside a report's context. For a May 2026 monthly
 * report, "Needs Attention" must not surface a 2015 review — so we clamp to
 * the report's period start at minimum, expanded to `quarter` as a floor for
 * portfolio-level surfaces where the period would otherwise be only ~30 days.
 *
 * Returns `{ gte, source }` where `source` indicates which rule won so the
 * caller can communicate the active window to the user.
 */
export function reportPeriodWindow(report: {
  periodStart: Date | null;
  periodEnd: Date | null;
}): { gte: Date; source: "period" | "quarter" } {
  const quarterAgo = new Date(Date.now() - RECENCY_WINDOW.quarter);
  if (!report.periodStart) return { gte: quarterAgo, source: "quarter" };
  return report.periodStart > quarterAgo
    ? { gte: quarterAgo, source: "quarter" }
    : { gte: report.periodStart, source: "period" };
}
