import Link from "next/link";
import { cn } from "@/lib/utils";
import { GreetingAnimated } from "./greeting-animated";
import { RANGES, type DashboardRange } from "@/lib/dashboard/range";

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

// RANGES / parseRange / rangeDays moved to lib/dashboard/range.ts
// (Carbon rebuild 2026-07-09) — import from there. This component is no
// longer rendered on the dashboard; file retained for the dead-code sweep.

// Norman bug #109: the previous timeOfDayGreeting used now.getHours()
// which reads the SERVER's local time. Vercel functions run in UTC so
// an operator on the West Coast saw "Good morning" until 4pm local.
// We now extract the hour explicitly in America/Los_Angeles (the
// operator's actual timezone — matches the #58 Pacific-time choice
// for property sync timestamps). When we add a per-user timezone
// preference, swap the literal for that lookup.
const PACIFIC_TZ = "America/Los_Angeles";

function hourInPacific(now: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: PACIFIC_TZ,
      hour: "numeric",
      hour12: false,
    }).formatToParts(now);
    const hourPart = parts.find((p) => p.type === "hour");
    const hour = hourPart ? Number.parseInt(hourPart.value, 10) : NaN;
    if (Number.isFinite(hour)) return hour;
  } catch {
    // Intl can throw on misconfigured runtimes — fall through.
  }
  return now.getHours();
}

function timeOfDayGreeting(now: Date): string {
  const hour = hourInPacific(now);
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
          {/* Per-word crossfade reveal — pixel-point/animate-text spec
              `per-word-crossfade.json`. Calm editorial rhythm on first
              paint of the dashboard. */}
          <GreetingAnimated greeting={greeting} subject={subject} />
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

        {/* Comparison toggle hidden 2026-06-04 per Norman review — the
            prior-period overlay only renders on the Lead Performance chart
            and confused operators because the KPI strip + funnel + leaderboard
            don't currently respond to it. Re-enable once every dashboard widget
            honors `compare`. The query param is still respected if set
            manually, so deep-links from existing reports keep working. */}
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
