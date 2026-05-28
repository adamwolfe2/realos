import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// LeadHeatmap — 7×24 grid of lead activity by hour for the last 7 days.
// Server-rendered with plain divs (no SVG, no client JS). Each cell is
// tinted by intensity relative to the busiest hour in the window. Hover
// reveals the count via title attribute (kept native to avoid any JS).
//
// Bucketing: the parent passes raw createdAt[] for max simplicity; we group
// in-memory here so the component stays self-contained.
// ----------------------------------------------------------------------------

export type LeadHeatmapProps = {
  leadCreatedAt: Date[];
  /** Now() in the user's timezone — defaults to UTC if omitted. */
  now?: Date;
};

const DAYS = 7;
const HOURS = 24;

export function LeadHeatmap({ leadCreatedAt, now = new Date() }: LeadHeatmapProps) {
  const grid = bucketLeads(leadCreatedAt, now);
  const max = grid.reduce(
    (m, row) => row.reduce((rm, v) => Math.max(rm, v), m),
    0,
  );
  const total = leadCreatedAt.length;

  const dayLabels = buildDayLabels(now);

  if (total === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
        <div className="text-sm font-medium text-foreground">
          No lead activity in the last 7 days
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Once leads start flowing the heatmap fills in by day and hour of day.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            Last 7 days &middot; by hour
          </div>
          <div className="text-sm font-medium text-foreground">
            Lead activity
          </div>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {total} total
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col justify-between py-1 text-[10px] text-muted-foreground tabular-nums">
          {dayLabels.map((d) => (
            <div key={d} className="h-3 leading-3">
              {d}
            </div>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="grid grid-rows-7 gap-[2px]">
            {grid.map((row, dayIdx) => (
              <div
                key={dayIdx}
                className="grid grid-cols-24 gap-[2px]"
                style={{ gridTemplateColumns: `repeat(${HOURS}, minmax(0, 1fr))` }}
              >
                {row.map((count, hour) => (
                  <HeatCell
                    key={hour}
                    count={count}
                    max={max}
                    day={dayLabels[dayIdx]}
                    hour={hour}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>12a</span>
            <span>6a</span>
            <span>12p</span>
            <span>6p</span>
            <span>11p</span>
          </div>
        </div>
      </div>

      <Legend max={max} />
    </div>
  );
}

function HeatCell({
  count,
  max,
  day,
  hour,
}: {
  count: number;
  max: number;
  day: string;
  hour: number;
}) {
  // 5 intensity steps. 0 = empty (neutral grey), 1-4 escalating sage-green.
  const intensity = count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4));
  const cls = INTENSITY_CLASSES[intensity];
  const hourLabel = formatHour(hour);
  return (
    <div
      className={cn("h-3 rounded-[2px]", cls)}
      title={`${day} ${hourLabel}: ${count} lead${count === 1 ? "" : "s"}`}
      aria-label={`${count} leads on ${day} at ${hourLabel}`}
    />
  );
}

const INTENSITY_CLASSES = [
  "bg-neutral-100",
  "bg-emerald-100",
  "bg-emerald-200",
  "bg-emerald-400",
  "bg-emerald-600",
];

function Legend({ max }: { max: number }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
      <span>Less</span>
      {INTENSITY_CLASSES.map((cls, i) => (
        <span key={i} className={cn("h-3 w-3 rounded-[2px]", cls)} />
      ))}
      <span>More</span>
      <span className="ml-auto tabular-nums">peak {max}/hr</span>
    </div>
  );
}

function bucketLeads(dates: Date[], now: Date): number[][] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const grid: number[][] = Array.from({ length: DAYS }, () =>
    Array.from({ length: HOURS }, () => 0),
  );
  for (const d of dates) {
    const ageMs = startOfToday.getTime() - d.getTime();
    // Day 0 in our grid = oldest (6 days ago). Day 6 = today.
    const daysAgo = Math.floor(ageMs / 86_400_000);
    if (daysAgo < -1 || daysAgo >= DAYS) continue;
    const rowIdx = DAYS - 1 - Math.max(0, daysAgo);
    const hour = d.getHours();
    if (hour < 0 || hour >= HOURS) continue;
    grid[rowIdx][hour] += 1;
  }
  return grid;
}

function buildDayLabels(now: Date): string[] {
  const labels: string[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    labels.push(
      d.toLocaleDateString(undefined, { weekday: "short" }),
    );
  }
  return labels;
}

function formatHour(h: number): string {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  if (h < 12) return `${h}a`;
  return `${h - 12}p`;
}
