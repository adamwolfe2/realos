import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Building2, Megaphone, Star } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PropertyGridCard — AeroStore-style image-led card for the dashboard
// Properties section. Replaces the dense table-row format on the dashboard
// with a visually rich card grid where each property is immediately
// recognisable by its photo, not just its name in a list.
//
// Layout (top → bottom):
//   [Photo hero — 16:9, gradient scrim + name/address overlay]
//   [Stats strip — Units | divider | Leads 28d + mini sparkline]
//   [Optional: ads badge + reviews badge if non-zero]
//
// Server component — pure SVG + CSS, zero client hydration cost.
// ---------------------------------------------------------------------------

export type PropertyGridCardProps = {
  id: string;
  name: string;
  address?: string | null;
  thumbnailUrl?: string | null;
  occupancyPct?: number | null;
  totalUnits?: number | null;
  availableCount?: number | null;
  leads28d: number;
  leadsSpark: number[];
  activeCampaigns: number;
  reputationMentionCount?: number;
  reputationUnreviewedCount?: number;
  accent?: string;
};

export function PropertyGridCard({
  id,
  name,
  address,
  thumbnailUrl,
  occupancyPct,
  totalUnits,
  availableCount,
  leads28d,
  leadsSpark,
  activeCampaigns,
  reputationMentionCount = 0,
  reputationUnreviewedCount = 0,
  accent,
}: PropertyGridCardProps) {
  const stroke = accent ?? "#2563EB";

  // Premium 2026 redesign: floating ls-card surface + gradient occupancy bar
  // beneath the photo so capacity reads from across the room without needing
  // to parse "23 / 28".
  const occClass =
    occupancyPct == null
      ? ""
      : occupancyPct >= 92
        ? "is-high"
        : occupancyPct >= 75
          ? ""
          : occupancyPct >= 60
            ? "is-warn"
            : "is-danger";

  return (
    <Link
      href={`/portal/properties/${id}`}
      className={cn(
        "group ls-card flex flex-col overflow-hidden p-0",
      )}
    >
      {/* ── Photo hero ──────────────────────────────────────────────────── */}
      <div className="relative w-full aspect-[16/9] bg-muted overflow-hidden">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Building2 className="h-10 w-10 text-muted-foreground/20" />
          </div>
        )}

        {/* Bottom gradient scrim so name is readable over any photo */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

        {/* Occupancy pill — top-right */}
        {occupancyPct != null ? (
          <div className="absolute top-2 right-2 inline-flex items-center rounded-md bg-black/50 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
            {occupancyPct}%
          </div>
        ) : null}

        {/* Badges row — top-left: active campaigns + unreviewed mentions */}
        {(activeCampaigns > 0 || reputationUnreviewedCount > 0) ? (
          <div className="absolute top-2 left-2 flex items-center gap-1">
            {activeCampaigns > 0 ? (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-black/50 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-semibold text-white">
                <Megaphone className="h-2.5 w-2.5" />
                {activeCampaigns}
              </span>
            ) : null}
            {reputationUnreviewedCount > 0 ? (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/80 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-semibold text-white">
                <Star className="h-2.5 w-2.5" />
                {reputationUnreviewedCount} new
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Name + address overlay at bottom of photo */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 pt-6">
          <h3 className="font-semibold text-[13.5px] text-white leading-tight truncate">
            {name}
          </h3>
          {address ? (
            <p className="mt-0.5 text-[10.5px] text-white/70 flex items-center gap-1 truncate">
              <MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{address}</span>
            </p>
          ) : null}
        </div>
      </div>

      {/* ── Occupancy gradient bar — instant capacity signal ──────────── */}
      {occupancyPct != null ? (
        <div className={cn("ls-progress rounded-none", occClass)} style={{ height: 4 }}>
          <span style={{ width: `${Math.max(2, Math.min(100, occupancyPct))}%` }} />
        </div>
      ) : null}

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 divide-x divide-border">
        {/* Units */}
        <div className="flex-1 px-3 py-2.5">
          <div className="text-[9px] tracking-[0.14em] uppercase font-semibold text-muted-foreground leading-none">
            Units
          </div>
          <div className="mt-1 text-[14px] font-semibold tabular-nums text-foreground leading-none">
            {totalUnits != null
              ? `${totalUnits - (availableCount ?? 0)} / ${totalUnits}`
              : "—"}
          </div>
          {availableCount != null && availableCount > 0 ? (
            <div className="mt-0.5 text-[10px] text-primary tabular-nums leading-none font-medium">
              {availableCount} available
            </div>
          ) : (
            <div className="mt-0.5 text-[10px] text-muted-foreground leading-none">
              {occupancyPct != null ? "fully leased" : "no data"}
            </div>
          )}
        </div>

        {/* Leads + sparkline */}
        <div className="flex-1 px-3 py-2.5">
          <div className="text-[9px] tracking-[0.14em] uppercase font-semibold text-muted-foreground leading-none">
            Leads (28d)
          </div>
          <div className="mt-1 flex items-end justify-between gap-2">
            <span className="text-[14px] font-semibold tabular-nums text-foreground leading-none">
              {leads28d}
            </span>
            <GridSpark data={leadsSpark} stroke={stroke} />
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground leading-none">
            {leads28d === 0 ? "no leads yet" : leads28d === 1 ? "1 lead" : `${leads28d} leads`}
          </div>
        </div>
      </div>
    </Link>
  );
}

// Compact area sparkline for the stats strip. 52×18px.
function GridSpark({ data, stroke }: { data: number[]; stroke: string }) {
  if (data.length < 2 || data.every((v) => v === 0)) {
    return (
      <svg
        viewBox="0 0 52 18"
        className="h-[18px] w-[52px] shrink-0"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          x1="0" y1="16" x2="52" y2="16"
          stroke="hsl(var(--border))"
          strokeWidth="1"
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 52;
  const h = 18;
  const stepX = w / (data.length - 1);
  const pts = data
    .map(
      (v, i) =>
        `${(i * stepX).toFixed(1)},${(h - ((v - min) / range) * (h - 4) - 2).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-[18px] w-[52px] shrink-0"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon
        points={`0,${h} ${pts} ${w},${h}`}
        fill={stroke}
        opacity="0.14"
      />
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
