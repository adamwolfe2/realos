import * as React from "react";
import Link from "next/link";
import { Building2, MapPin, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

export type PropertyDashboardCardProps = {
  id: string;
  name: string;
  address?: string | null;
  thumbnailUrl?: string | null;
  occupancyPct?: number | null;
  leads28d: number;
  leadsSpark: number[];
  activeCampaigns: number;
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
        "group relative block rounded-md border border-border bg-card overflow-hidden",
        "transition-all duration-150 hover:border-primary/30 hover:shadow-sm",
      )}
    >
      <div className="flex items-center">
        <Thumbnail src={thumbnailUrl} fallbackLetter={name.slice(0, 1)} accent={accent} />
        <div className="flex-1 min-w-0 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-xs text-foreground tracking-tight truncate">
                {name}
              </h3>
              {address ? (
                <p className="mt-0.5 text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                  <MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{address}</span>
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {occupancyPct != null ? <OccupancyBadge pct={occupancyPct} /> : null}
              <div className="text-right">
                <div className="text-[9px] tracking-widest uppercase font-semibold text-muted-foreground leading-none">
                  Leads
                </div>
                <div className="text-sm font-semibold tabular-nums text-foreground leading-tight">
                  {leads28d}
                </div>
              </div>
              <MiniSpark data={leadsSpark} />
            </div>
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
        className="h-full w-14 shrink-0 object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div
      className="relative h-full w-14 shrink-0 grid place-items-center bg-muted self-stretch"
      aria-hidden="true"
    >
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold text-foreground">
        {fallbackLetter}
      </span>
      <span
        className="absolute inset-y-0 right-0 w-0.5"
        style={{ backgroundColor: accent ?? "hsl(var(--primary))" }}
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
    return <div className="h-5 w-14" aria-hidden="true" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 56;
  const h = 20;
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
      className="h-5 w-14"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="#2563EB"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
