import Link from "next/link";
import { cn } from "@/lib/utils";
import { ADS_RANGES, type AdsRangeDays } from "@/lib/integrations/ads-insights-math";

// 7 / 28 / 90 day switch for /portal/ads. Plain links so the range lives in
// the URL (shareable, back button works) and keeps the property filter.
export function RangeTabs({
  current,
  params,
  basePath = "/portal/ads",
}: {
  current: AdsRangeDays;
  params: Record<string, string | undefined>;
  basePath?: string;
}) {
  const href = (days: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "range") q.set(k, v);
    if (days !== 28) q.set("range", String(days));
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav aria-label="Date range" className="inline-flex h-9 items-center rounded-[8px] border border-[var(--t-border)] bg-white p-0.5">
      {ADS_RANGES.map((d) => (
        <Link
          key={d}
          href={href(d)}
          aria-current={d === current ? "page" : undefined}
          className={cn(
            "rounded-[6px] px-3 py-1.5 text-[12.5px] font-medium tabular-nums transition-colors",
            d === current ? "bg-[var(--t-accent-soft)] text-[var(--t-accent)]" : "text-[var(--t-muted)] hover:text-[var(--t-ink)]",
          )}
        >
          {d}d
        </Link>
      ))}
    </nav>
  );
}
