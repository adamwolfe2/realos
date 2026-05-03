import * as React from "react";
import Link from "next/link";
import { MapPin, Megaphone, Star, AlertTriangle } from "lucide-react";
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
  reputationMentionCount?: number;
  reputationNegativeCount?: number;
  reputationUnreviewedCount?: number;
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
  reputationMentionCount = 0,
  reputationNegativeCount = 0,
  reputationUnreviewedCount = 0,
}: PropertyDashboardCardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-md border border-border bg-card overflow-hidden",
        "transition-all duration-150 hover:border-primary/30 hover:shadow-sm",
      )}
    >
      {/* Primary clickable card body — opens property detail */}
      <Link
        href={`/portal/properties/${id}`}
        className="flex items-center"
      >
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
      </Link>

      {/* Footer strip: ad campaigns + reputation. Each piece is its own
          link that drills into the right per-property tab — gives the
          dashboard direct access to per-property sub-pages. */}
      {(activeCampaigns > 0 || reputationMentionCount > 0) ? (
        <div className="border-t border-border bg-muted/20 px-3 py-1.5 flex items-center gap-2 text-[10px]">
          {activeCampaigns > 0 ? (
            <Link
              href={`/portal/properties/${id}?tab=ads`}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <Megaphone className="h-2.5 w-2.5" />
              <span>{activeCampaigns} active</span>
            </Link>
          ) : null}
          {activeCampaigns > 0 && reputationMentionCount > 0 ? (
            <span aria-hidden="true" className="text-muted-foreground">·</span>
          ) : null}
          {reputationMentionCount > 0 ? (
            <Link
              href={`/portal/properties/${id}?tab=reputation`}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Star className="h-2.5 w-2.5" />
              <span>{reputationMentionCount} mentions</span>
              {reputationNegativeCount > 0 ? (
                <span className="text-rose-700">
                  · {reputationNegativeCount} neg
                </span>
              ) : null}
              {reputationUnreviewedCount > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-amber-700">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {reputationUnreviewedCount} new
                </span>
              ) : null}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
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
      <div className="relative h-full w-14 shrink-0 self-stretch overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="h-full w-14 object-cover"
          loading="lazy"
        />
        <span
          className="absolute inset-y-0 right-0 w-0.5"
          style={{ backgroundColor: accent ?? "hsl(var(--primary))" }}
          aria-hidden="true"
        />
      </div>
    );
  }
  // No hero image: render a single clean monogram. Previously layered a
  // letter on top of the Building2 icon which read as a broken placeholder.
  return (
    <div
      className="relative h-full w-14 shrink-0 grid place-items-center self-stretch"
      style={{ backgroundColor: accent ?? "#0A0A0A" }}
      aria-hidden="true"
    >
      <span className="text-base font-semibold text-white tracking-tight">
        {fallbackLetter.toUpperCase()}
      </span>
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
