import Link from "next/link";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// DashboardGreeting — the personalized header that opens /portal home.
//
// Mirrors the AeroStore / URBN / Mori reference dashboards: a warm
// "Welcome back, {firstName}" anchor on the left, a date-range pill
// group + comparison toggle on the right. The range and comparison
// flags flow through URL params so the page stays a pure server
// component (no client state, no flash of unstyled chrome).
//
// Time-of-day greeting: pulls a localized greeting from the server
// clock at render time. Good morning before noon, Good afternoon
// through 5pm, Good evening after. Used purely for warmth — the
// dashboard never depends on this string for behavior.
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

function timeOfDayGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardGreeting({
  firstName,
  orgName,
  range,
  compare,
  asOf,
}: {
  firstName: string | null;
  orgName: string;
  range: DashboardRange;
  compare: boolean;
  /** ISO string of the data freshness instant (now) for the "as of" meta. */
  asOf: string;
}) {
  const greeting = timeOfDayGreeting(new Date(asOf));
  // First name is the warm hook. Fall back to the org name when we
  // haven't synced a user profile yet (new tenants, first session) so
  // the greeting still feels addressed to someone.
  const subject = firstName?.trim().length ? firstName : orgName;
  // `asOf` is still accepted on the props interface so callers can keep
  // passing it without breaking, but the headline no longer renders a
  // date/time + range subtitle next to the greeting. Per design pass:
  // the sun icon + "Mon, May 18, 2:25 AM · Showing last 28 days" read
  // as visual noise next to the user name. The active range is already
  // communicated by the pill group on the right side of the header.
  void asOf;

  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-tight">
          {greeting}, <span className="text-primary">{subject}</span>
        </h1>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Range pill group. Each pill is a real Link so deep-links and
            back/forward navigation work without any client state. */}
        <div
          className="inline-flex items-center rounded-lg border border-border bg-card p-0.5"
          role="group"
          aria-label="Time range"
        >
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={hrefWith({ range: r.key, compare })}
              className={cn(
                "px-3 py-1 text-[12px] font-semibold rounded-md transition-colors",
                r.key === range
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
              prefetch={false}
            >
              {r.label}
            </Link>
          ))}
        </div>

        {/* Comparison toggle — a single Link that flips the param. */}
        <Link
          href={hrefWith({ range, compare: !compare })}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors",
            compare
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40",
          )}
          prefetch={false}
        >
          <span
            aria-hidden="true"
            className={cn(
              "inline-block h-2.5 w-2.5 rounded-full",
              compare ? "bg-primary" : "bg-muted-foreground/30",
            )}
          />
          Compare vs previous
        </Link>
      </div>
    </header>
  );
}

// Build a URL that preserves the active params we care about (range +
// compare) and drops the rest. Page-level filters (property selector)
// live in their own search params and are appended by the caller when
// needed — keep this helper deliberately narrow.
function hrefWith({
  range,
  compare,
}: {
  range: DashboardRange;
  compare: boolean;
}): string {
  const params = new URLSearchParams();
  if (range !== "28d") params.set("range", range);
  if (compare) params.set("compare", "1");
  const qs = params.toString();
  return `/portal${qs ? `?${qs}` : ""}`;
}
