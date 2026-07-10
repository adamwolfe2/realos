// ---------------------------------------------------------------------------
// Dashboard range helpers — moved verbatim out of
// components/portal/dashboard/dashboard-greeting.tsx when the animated
// greeting was replaced by PageHeader (Carbon rebuild, 2026-07-09).
// Pure helpers: the range and comparison flags flow through URL params so
// the dashboard stays a pure server component.
// ---------------------------------------------------------------------------

export type DashboardRange = "7d" | "28d" | "90d";

export const RANGES: Array<{
  key: DashboardRange;
  label: string;
  days: number;
}> = [
  { key: "7d", label: "7d", days: 7 },
  { key: "28d", label: "28d", days: 28 },
  { key: "90d", label: "90d", days: 90 },
];

export function parseRange(value: string | undefined): DashboardRange {
  if (value === "7d" || value === "90d") return value;
  return "28d";
}

export function rangeDays(range: DashboardRange): number {
  return RANGES.find((r) => r.key === range)?.days ?? 28;
}
