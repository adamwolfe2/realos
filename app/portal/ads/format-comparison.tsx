import { Panel } from "@/components/portal/overview/kit";
import type { FormatRow } from "@/lib/integrations/ads-insights-math";

// Which kind of ad works best: search text vs image vs video vs carousel,
// compared on cost per lead and click rate across every synced ad.

const LABEL: Record<string, string> = {
  text: "Search (text)",
  image: "Image",
  video: "Video",
  carousel: "Carousel",
};

function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function FormatComparison({ rows }: { rows: FormatRow[] }) {
  const priced = rows.filter((r) => r.leads > 0 && r.spendCents > 0);
  if (priced.length < 2) return null;
  const cpl = (r: FormatRow) => r.spendCents / r.leads;
  const best = priced.reduce((a, b) => (cpl(b) < cpl(a) ? b : a));
  const maxCpl = Math.max(...priced.map(cpl));

  return (
    <Panel title="By ad format" aside="Cost per lead across every ad of that kind">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((r) => {
          const value = r.leads ? cpl(r) : null;
          return (
            <li key={r.format} className="rounded-[var(--t-radius-sm)] border border-[var(--t-border)] p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-medium text-[var(--t-ink)]">{LABEL[r.format] ?? r.format}</span>
                <span className="text-[12px] text-[var(--t-muted)]" title={`${dollars(r.spendCents)} spent${r.impressions ? ` · ${((r.clicks / r.impressions) * 100).toFixed(1)}% click rate` : ""}`}>{r.ads} {r.ads === 1 ? "ad" : "ads"}</span>
              </div>
              <div className="mt-2 text-[22px] font-semibold tabular-nums text-[var(--t-ink)]">
                {value === null ? "—" : dollars(Math.round(value))}
                <span className="ml-1 text-[12px] font-normal text-[var(--t-muted)]">per lead</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--t-wash)]" aria-hidden>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${value === null ? 0 : (value / maxCpl) * 100}%`,
                    background: r === best ? "#15803d" : "#93b4ff",
                  }}
                />
              </div>
              {r === best ? <p className="mt-1.5 text-[12px] font-medium text-[#15803d]">Lowest cost per lead</p> : null}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
