import { cn } from "@/lib/utils";

export type LocationRow = {
  label: string;
  sublabel?: string;
  value: number;
};

export function TopLocations({
  rows,
  emptyHint = "No location data yet.",
}: {
  rows: LocationRow[];
  emptyHint?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">{emptyHint}</div>
    );
  }
  const top = Math.max(1, rows[0].value);
  const totalReach = rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <ol className="space-y-2">
      {rows.map((r, i) => {
        const widthPct = Math.max(2, Math.round((r.value / top) * 100));
        const sharePct = totalReach > 0 ? Math.round((r.value / totalReach) * 100) : 0;
        return (
          <li key={`${r.label}-${i}`} className="flex items-center gap-3">
            <div className="w-20 shrink-0 min-w-0">
              <div className="text-sm font-medium truncate">{r.label}</div>
              {r.sublabel ? (
                <div className="text-[11px] text-muted-foreground truncate">
                  {r.sublabel}
                </div>
              ) : null}
            </div>
            <div className="flex-1 relative h-6 rounded-md bg-muted/50 overflow-hidden">
              <div
                className={cn(
                  "h-full bg-primary/80 transition-all duration-700",
                  i === 0 && "bg-primary",
                )}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <div className="w-20 text-right shrink-0">
              <div className="text-sm font-medium tabular-nums">
                {formatCount(r.value)}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {sharePct}%
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
