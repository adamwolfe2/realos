import * as React from "react";
import Link from "next/link";
import { Building2, MapPin, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PropertyDashboardCard
//
// One row in the "Properties" grid on the dashboard. Reads at-a-glance:
//   - thumbnail (or fallback gradient with first-letter glyph)
//   - name + address
//   - occupancy %
//   - leads in last 28d (with mini sparkline)
//   - active ad campaigns count
// Clicks through to the property detail page.
// ---------------------------------------------------------------------------

export type PropertyDashboardCardProps = {
  id: string;
  name: string;
  address?: string | null;
  thumbnailUrl?: string | null;
  occupancyPct?: number | null;
  leads28d: number;
  leadsSpark: number[];
  activeCampaigns: number;
  // Subtle accent (e.g. the tenant brand color) used on the side rail.
  accent?: string;
};

export function PropertyDashboardCard({
  id,
  name,
  address,
  thumbnailUrl,
  occupancyPct,
  leads28d,
  leadsSpark,
  activeCampaigns,
  accent,
}: PropertyDashboardCardProps) {
  return (
    <Link
      href={`/portal/properties/${id}`}
      className={cn(
        "group relative block rounded-xl border border-[var(--border-cream)] bg-[var(--ivory)] overflow-hidden",
        "transition-all duration-150 hover:border-[var(--terracotta)]/30 hover:shadow-[0_4px_24px_rgba(0,0,0,0.05)]",
      )}
    >
      <div className="flex">
        <Thumbnail src={thumbnailUrl} fallbackLetter={name.slice(0, 1)} accent={accent} />
        <div className="flex-1 min-w-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-[var(--near-black)] tracking-tight truncate">
                {name}
              </h3>
              {address ? (
                <p className="mt-0.5 text-[11px] text-[var(--stone-gray)] flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{address}</span>
                </p>
              ) : null}
            </div>
            {occupancyPct != null ? (
              <OccupancyBadge pct={occupancyPct} />
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
            <div>
              <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)]">
                Leads (28d)
              </div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-lg font-semibold tabular-nums text-[var(--near-black)]">
                  {leads28d}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-[var(--olive-gray)]">
                  <Megaphone className="h-3 w-3" aria-hidden="true" />
                  {activeCampaigns} {activeCampaigns === 1 ? "campaign" : "campaigns"}
                </span>
              </div>
            </div>
            <MiniSpark data={leadsSpark} />
          </div>
        </div>
      </div>
    </Link>
  );
}

function Thumbnail({
  src,
  fallbackLetter,
  accent,
}: {
  src?: string | null;
  fallbackLetter: string;
  accent?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-full w-24 shrink-0 object-cover"
        loading="lazy"
      />
    );
  }
  // Fallback: warm gradient + serif letter glyph + brand accent rail.
  return (
    <div
      className="relative h-auto w-24 shrink-0 grid place-items-center"
      style={{
        background:
          "linear-gradient(135deg, var(--warm-sand) 0%, var(--border-cream) 100%)",
      }}
      aria-hidden="true"
    >
      <Building2 className="h-6 w-6 text-[var(--stone-gray)]" />
      <span className="absolute top-2 left-2 font-serif text-base font-semibold text-[var(--near-black)]">
        {fallbackLetter}
      </span>
      <span
        className="absolute inset-y-0 right-0 w-1"
        style={{ backgroundColor: accent ?? "var(--terracotta)" }}
      />
    </div>
  );
}

function OccupancyBadge({ pct }: { pct: number }) {
  const tone =
    pct >= 90
      ? "bg-emerald-50 text-emerald-700"
      : pct >= 75
        ? "bg-amber-50 text-amber-800"
        : "bg-rose-50 text-rose-700";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        tone,
      )}
    >
      {pct}% full
    </span>
  );
}

function MiniSpark({ data }: { data: number[] }) {
  if (data.length < 2) {
    return <div className="h-7 w-20" aria-hidden="true" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const stepX = w / (data.length - 1);
  const points = data
    .map(
      (v, i) =>
        `${(i * stepX).toFixed(1)},${(h - ((v - min) / range) * (h - 4) - 2).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-7 w-20"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--terracotta)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
