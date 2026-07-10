"use client";

import * as React from "react";

// ---------------------------------------------------------------------------
// Schedule time display for the report cadence surfaces.
//
// Report crons run in UTC, but operators think in their own timezone —
// showing UTC alone invites misconfigured sends ("Monday 07:00" is Sunday
// evening on the US west coast). These components render the canonical UTC
// label on the server, then swap in the viewer's local time (with a tz
// label) after mount, so there is never a hydration mismatch. Display-only:
// nothing here reads or writes the schedule itself.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

const LOCAL_RUN_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};

/**
 * "Next scheduled report: Monday, Jul 13, 3:00 AM EDT" — the instant is
 * computed server-side (UTC) and re-rendered in the viewer's local zone
 * after mount. `utcLabel` is the deterministic SSR fallback.
 */
export function NextScheduledReport({
  nextRunAtIso,
  utcLabel,
}: {
  nextRunAtIso: string | null;
  utcLabel: string | null;
}) {
  const mounted = useMounted();
  if (!nextRunAtIso || !utcLabel) {
    return (
      <span>
        Next scheduled report:{" "}
        <span className="font-semibold text-foreground">none</span> — automatic
        generation is off.
      </span>
    );
  }
  const local = mounted
    ? new Intl.DateTimeFormat(undefined, LOCAL_RUN_FORMAT).format(
        new Date(nextRunAtIso),
      )
    : null;
  return (
    <span>
      Next scheduled report:{" "}
      <span className="font-semibold text-foreground">{local ?? utcLabel}</span>
      {local ? <span> ({utcLabel})</span> : null}
    </span>
  );
}

/**
 * Viewer-local equivalent of a recurring UTC schedule point, appended in
 * parentheses — e.g. hour 7 UTC on Mondays renders " (Sunday 11:00 PM PST
 * local)" for a Pacific viewer. Renders nothing until mounted, so the SSR
 * output stays the canonical UTC copy.
 */
export function LocalTime({
  hourUtc,
  minuteUtc = 0,
  weekdayUtc,
}: {
  hourUtc: number;
  minuteUtc?: number;
  /** 0 = Sunday … 6 = Saturday. When set, the local weekday is included
   *  (a UTC weekday can land on a different local weekday). */
  weekdayUtc?: number;
}) {
  const mounted = useMounted();
  if (!mounted) return null;
  const now = new Date();
  const base = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hourUtc,
      minuteUtc,
    ),
  );
  const instant =
    weekdayUtc == null
      ? base
      : new Date(
          base.getTime() + ((weekdayUtc - base.getUTCDay() + 7) % 7) * DAY_MS,
        );
  const options: Intl.DateTimeFormatOptions =
    weekdayUtc == null
      ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" }
      : {
          weekday: "long",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        };
  const label = new Intl.DateTimeFormat(undefined, options).format(instant);
  return <> ({label} local)</>;
}
