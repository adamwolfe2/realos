import { safeNum } from "@/components/portal/reputation/reputation-utils";

// Lightweight block used inside the analytics drawer. Replaces a nested
// DashboardSection card so the drawer reads as one cohesive surface
// instead of a card-in-card-in-card.
export function AnalyticsBlock({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {eyebrow ? (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function SentimentBar({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-foreground font-medium">{label}</span>
        <span className="tabular-nums">
          <span className="font-semibold text-foreground">
            {count.toLocaleString()}
          </span>
          <span className="ml-1.5 text-muted-foreground">{pct}%</span>
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${tone} transition-[width] duration-300`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
    </div>
  );
}

export function MonthlyVolume({
  data,
}: {
  data: Array<{ month: string; count: number; negative: number }>;
}) {
  const safeData = (data ?? []).map((d) => ({
    month: String(d?.month ?? ""),
    count: safeNum(d?.count),
    negative: safeNum(d?.negative),
  }));
  const max = Math.max(1, ...safeData.map((d) => d.count));

  // Per the design audit, raw "12, 01, 02, 03, 04, 05" axis labels read
  // as garbage. Format YYYY-MM month strings as short month names ("Dec,
  // Jan, …") and prefix the first label of a new year with the year so
  // the chart self-documents which year the data starts in.
  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const labels = safeData.map((d, i) => {
    const [yearStr, monthStr] = d.month.split("-");
    const monthIdx = Math.max(0, Math.min(11, Number(monthStr) - 1));
    const monthName = MONTHS[monthIdx] ?? d.month.slice(5);
    if (i === 0 || monthIdx === 0) return `${monthName} '${yearStr.slice(2)}`;
    return monthName;
  });

  return (
    <div className="flex items-end gap-1.5 h-24">
      {safeData.map((d, i) => {
        const height = (d.count / max) * 100;
        const negPct = d.count > 0 ? (d.negative / d.count) * 100 : 0;
        return (
          <div
            key={d.month}
            className="flex-1 flex flex-col items-center gap-1 group"
            title={`${labels[i]}: ${d.count} (${d.negative} negative)`}
          >
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full bg-primary/25 group-hover:bg-primary/40 rounded-sm relative transition-colors"
                style={{ height: `${Math.max(height, 4)}%` }}
              >
                {d.negative > 0 ? (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-foreground/25 rounded-sm"
                    style={{ height: `${negPct}%` }}
                  />
                ) : null}
              </div>
            </div>
            <span className="text-[9px] text-muted-foreground tabular-nums">
              {labels[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
