import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// TopMovers — five SEO keywords that moved the most in the last 7 days. Data
// comes from either the precomputed snapshot.seo.topMovers (preferred) or a
// fallback query in the page over RankedKeyword. Empty state guides the
// operator to /portal/connect when no SEO data is wired yet.
// ----------------------------------------------------------------------------

export type TopMoverRow = {
  keyword: string;
  from: number;
  to: number;
  volume: number;
};

export function TopMovers({
  movers,
  hasData,
}: {
  movers: TopMoverRow[];
  hasData: boolean;
}) {
  if (!hasData) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
        <Search className="h-5 w-5 mx-auto text-muted-foreground" />
        <div className="mt-2 text-sm font-medium text-foreground">
          Connect SEO data to see ranking movements
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Plug in Search Console or run a domain audit and weekly mover deltas
          appear here.
        </div>
        <Link
          href="/portal/connect"
          className="mt-3 inline-block text-xs font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          Connect a source
        </Link>
      </div>
    );
  }

  if (movers.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
        <Search className="h-5 w-5 mx-auto text-muted-foreground" />
        <div className="mt-2 text-sm font-medium text-foreground">
          No notable ranking moves this week
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Positions are steady. We&rsquo;ll surface keywords that move by 2+
          positions or shift to/from page one.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            Last 7 days
          </div>
          <div className="text-sm font-medium text-foreground">
            Top SEO movers
          </div>
        </div>
        <Link
          href="/portal/seo"
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Open SEO →
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
          <tr>
            <th className="text-left font-semibold px-5 py-2">Keyword</th>
            <th className="text-right font-semibold px-3 py-2">From</th>
            <th className="text-right font-semibold px-3 py-2">To</th>
            <th className="text-right font-semibold px-5 py-2">Volume</th>
          </tr>
        </thead>
        <tbody>
          {movers.map((m) => {
            const swing = m.from - m.to; // positive = improved (lower = better)
            const tone =
              swing > 0 ? "positive" : swing < 0 ? "negative" : "neutral";
            const Icon =
              tone === "positive"
                ? ArrowUpRight
                : tone === "negative"
                  ? ArrowDownRight
                  : null;
            const color =
              tone === "positive"
                ? "text-emerald-600"
                : tone === "negative"
                  ? "text-rose-600"
                  : "text-muted-foreground";
            return (
              <tr
                key={m.keyword}
                className="border-t border-border hover:bg-muted/30 transition-colors"
              >
                <td className="px-5 py-2.5 text-foreground truncate max-w-[18rem]">
                  {m.keyword}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  #{m.from}
                </td>
                <td
                  className={cn(
                    "px-3 py-2.5 text-right tabular-nums font-medium",
                    color,
                  )}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {Icon ? <Icon className="h-3 w-3" /> : null}#{m.to}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">
                  {m.volume.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
