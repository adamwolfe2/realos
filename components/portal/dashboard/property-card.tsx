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
  const hasFooter = activeCampaigns > 0 || reputationMentionCount > 0;
  return (
    <div
      className={cn(
        "group relative rounded-lg border border-border bg-card overflow-hidden h-full flex flex-col",
        "transition-colors duration-150 hover:border-foreground/20",
      )}
    >
      {/* Primary clickable card body — opens property detail */}
      <Link
        href={`/portal/properties/${id}`}
        className="flex items-center gap-3 px-3 py-2.5 flex-1"
      >
        <Thumbnail
          src={thumbnailUrl}
          fallbackLetter={name.slice(0, 1)}
          accent={accent}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground tracking-tight truncate">
            {name}
          </h3>
          {address ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
              <span className="truncate">{address}</span>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {occupancyPct != null ? <OccupancyBadge pct={occupancyPct} /> : null}
          <div className="text-right min-w-[40px]">
            <div className="text-[9px] tracking-widest uppercase font-semibold text-muted-foreground leading-none">
              Leads
            </div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground leading-none">
              {leads28d}
            </div>
          </div>
          {leads28d > 0 ? <MiniSpark data={leadsSpark} /> : null}
        </div>
      </Link>

      {/* Footer strip: ad campaigns + reputation. Only renders when at
          least one signal exists — otherwise the card looks balanced
          against siblings that DO have footers. */}
      {hasFooter ? (
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
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }
  // Compact rounded monogram. Previously a 56px-wide black slab took
  // the entire card height and dominated the layout — the brutalist
  // letter blocks were the loudest thing on the dashboard.
  return (
    <div
      className="relative h-9 w-9 shrink-0 grid place-items-center rounded-md border border-border"
      style={{
        backgroundColor: accent
          ? `${accent}14`
          : "hsl(var(--muted))",
      }}
      aria-hidden="true"
    >
      <span
        className="text-sm font-semibold tracking-tight"
        style={{ color: accent ?? "hsl(var(--foreground))" }}
      >
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
