import Link from "next/link";

// ---------------------------------------------------------------------------
// RangePresetControl — the shared preset date-range chip group for the
// attribution surfaces. Same Carbon segmented-Link treatment as the dashboard
// range pills (app/portal/page.tsx + lib/dashboard/range.ts): flat, bordered,
// active segment solid Blue 60, real <Link>s so deep-links and back/forward
// navigation work with zero client state.
//
// The dashboard's RANGES (7/28/90 keyed by ?range=) don't transfer directly:
// attribution pages filter by explicit ?from/?to ISO dates and default to a
// trailing 30-day window, so the presets here are 7/30/60/90 with the same
// visual grammar. Both /portal/attribution and /portal/reverse-attribution
// mount this control instead of hand-rolling their own.
// ---------------------------------------------------------------------------

const PRESET_DAYS = [7, 30, 60, 90] as const;

export function RangePresetControl({
  basePath,
  activeDays,
  properties,
}: {
  /** e.g. "/portal/attribution" */
  basePath: string;
  /** Current window length in days — highlights the matching preset. */
  activeDays: number;
  /** Pass-through ?properties= filter so switching range keeps scope. */
  properties?: string;
}) {
  return (
    <div
      className="inline-flex items-center rounded-none border border-[#e0e0e0] bg-white p-0"
      role="group"
      aria-label="Time range"
    >
      {PRESET_DAYS.map((days) => (
        <Link
          key={days}
          href={presetHref(basePath, days, properties)}
          prefetch={false}
          className={
            activeDays === days
              ? "px-3 py-1 text-[12px] font-semibold rounded-none bg-[#0f62fe] text-white transition-colors"
              : "px-3 py-1 text-[12px] font-semibold rounded-none text-[#525252] hover:bg-[#f4f4f4] transition-colors"
          }
        >
          {days}d
        </Link>
      ))}
    </div>
  );
}

/** Build a "last N days" href for the given attribution surface. */
function presetHref(
  basePath: string,
  days: number,
  properties?: string,
): string {
  const today = new Date();
  const from = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    from: toIsoDay(from),
    to: toIsoDay(today),
  });
  if (properties) params.set("properties", properties);
  return `${basePath}?${params.toString()}`;
}

function toIsoDay(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
