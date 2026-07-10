import Link from "next/link";
import { PropertyAvatar } from "@/components/portal/properties/property-avatar";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// TopPropertiesLeaderboard — mirrors the URBN "Realtor efficiency" /
// AeroStore "Top Selling Products" reference patterns. A ranked list
// of properties by lead count in the active window, each row showing:
//
//   [avatar] [name + city]  ──── progress bar ────  [count]  [trend]
//
// The progress bar is normalized to the top-scoring property in the
// visible set, so the leader always reads at 100% width and everything
// else trails proportionally. This is a far more scannable view than
// the raw "X leads, Y leads, Z leads" list — the eye picks up rank and
// spread in one pass.
//
// Rendered as a pure server component. No client JS — the rows are
// real Links to the property detail surface.
// ---------------------------------------------------------------------------

export type LeaderboardRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  heroImageUrl: string | null;
  logoUrl: string | null;
  leadsCurrent: number;
  leadsPrior: number;
};

export function TopPropertiesLeaderboard({
  rows,
}: {
  rows: LeaderboardRow[];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        Properties will appear here ranked by lead volume once data is
        flowing.
      </p>
    );
  }

  // Normalize bar widths against the leader so #1 reads as a full bar
  // and everything else is proportional. Guards against divide-by-zero
  // when the whole window has no leads yet.
  const peak = Math.max(...rows.map((r) => r.leadsCurrent), 1);

  return (
    <ol className="space-y-2.5">
      {rows.map((row, idx) => {
        const pct = Math.max(2, (row.leadsCurrent / peak) * 100);
        const delta = row.leadsCurrent - row.leadsPrior;
        const trendClass =
          delta > 0
            ? "text-emerald-700"
            : delta < 0
              ? "text-destructive"
              : "text-muted-foreground";
        const TrendIcon =
          delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
        const location = [row.city, row.state].filter(Boolean).join(", ");
        return (
          <li key={row.id}>
            <Link
              href={`/portal/properties/${row.id}`}
              className="group grid grid-cols-[28px_minmax(0,1.4fr)_minmax(0,2fr)_72px] items-center gap-3 rounded-lg px-1.5 py-1.5 -mx-1.5 hover:bg-muted/40 transition-colors"
            >
              {/* Rank chip — the small "01 / 02 / 03" numeral the
                  URBN realtor leaderboard uses to anchor the row. */}
              <span
                aria-hidden="true"
                className="text-[11px] font-mono text-muted-foreground/70 tabular-nums tracking-tight"
              >
                {String(idx + 1).padStart(2, "0")}
              </span>

              <span className="flex items-center gap-2 min-w-0">
                <PropertyAvatar
                  src={row.heroImageUrl}
                  logoSrc={row.logoUrl}
                  size="sm"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {row.name}
                  </span>
                  {location ? (
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {location}
                    </span>
                  ) : null}
                </span>
              </span>

              {/* Progress bar. Track in blue-50 so the active fill
                  pops against the neutral surface; fill at brand
                  primary. Width is the relative share of the leader. */}
              <span
                aria-hidden="true"
                className="h-1.5 rounded-full bg-[#EFF6FF] relative overflow-hidden"
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </span>

              <span className="text-right shrink-0">
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {row.leadsCurrent.toLocaleString()}
                </span>
                <span
                  className={cn(
                    "block text-[10px] tabular-nums inline-flex items-center gap-0.5 justify-end",
                    trendClass,
                  )}
                >
                  <TrendIcon className="h-2.5 w-2.5" aria-hidden="true" />
                  {delta > 0 ? "+" : ""}
                  {delta}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
      <li className="pt-1.5">
        <Link
          href="/portal/properties"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
        >
          See full portfolio
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </li>
    </ol>
  );
}
