import * as React from "react";
import Link from "next/link";
import {
  ChevronRight,
  MapPin,
  Megaphone,
  Star,
  AlertTriangle,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PropertyDashboardCard — dense single-row layout used by the
// /portal Properties section.
//
// Earlier this rendered as a 2-column card grid where each tile only showed
// a monogram + leads count, which left enormous empty space on properties
// that had no leads yet. The row layout below replaces it with a compact
// list (Twenty / Linear style):
//
//   [Avatar] Name / address  | Occupancy bar | Units | Ads | Reviews | Leads spark | →
//
// Rows are full-width, ~52px tall, and surface every signal we already have
// — occupancy %, ad activity, reputation mentions, leads sparkline — without
// resorting to color noise. Container should set
// `divide-y divide-border` so rows separate cleanly.
// ---------------------------------------------------------------------------

export type PropertyDashboardCardProps = {
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
  totalUnits,
  availableCount,
  leads28d,
  leadsSpark,
  activeCampaigns,
  accent,
  reputationMentionCount = 0,
  reputationNegativeCount = 0,
  reputationUnreviewedCount = 0,
}: PropertyDashboardCardProps) {
  return (
    <Link
      href={`/portal/properties/${id}`}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5",
        "hover:bg-muted/40 transition-colors",
      )}
    >
      <Thumbnail
        src={thumbnailUrl}
        fallbackLetter={name.slice(0, 1)}
        accent={accent}
      />

      {/* Identity column — flexes to fill */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[13px] text-foreground tracking-tight truncate">
          {name}
        </h3>
        {address ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
            <span className="truncate">{address}</span>
          </p>
        ) : null}
      </div>

      {/* Occupancy — visual bar, hidden on narrow screens */}
      <div className="hidden md:flex w-[120px] shrink-0 flex-col items-end gap-1">
        <OccupancyBar pct={occupancyPct} />
        <span className="text-[10px] text-muted-foreground tabular-nums leading-none">
          {occupancyPct != null ? `${occupancyPct}% full` : "—"}
        </span>
      </div>

      {/* Units */}
      <Stat
        label="Units"
        value={
          totalUnits != null
            ? `${totalUnits - (availableCount ?? 0)}/${totalUnits}`
            : "—"
        }
        hint={
          availableCount != null && availableCount > 0
            ? `${availableCount} open`
            : undefined
        }
        icon={<Users2 className="h-3 w-3" />}
      />

      {/* Active ad campaigns */}
      <Stat
        label="Ads"
        value={activeCampaigns > 0 ? activeCampaigns : "—"}
        valueTone={activeCampaigns > 0 ? "active" : "muted"}
        icon={<Megaphone className="h-3 w-3" />}
      />

      {/* Reputation mentions */}
      <Stat
        label="Reviews"
        value={
          reputationMentionCount > 0 ? reputationMentionCount : "—"
        }
        hint={
          reputationUnreviewedCount > 0
            ? `${reputationUnreviewedCount} new`
            : reputationNegativeCount > 0
              ? `${reputationNegativeCount} neg`
              : undefined
        }
        hintTone={
          reputationUnreviewedCount > 0
            ? "amber"
            : reputationNegativeCount > 0
              ? "rose"
              : "muted"
        }
        icon={<Star className="h-3 w-3" />}
      />

      {/* Leads + sparkline */}
      <div className="flex flex-col items-end gap-1 w-[72px] shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] tracking-widest uppercase font-semibold text-muted-foreground leading-none">
            Leads
          </span>
          <span className="text-[13px] font-semibold tabular-nums text-foreground leading-none">
            {leads28d}
          </span>
        </div>
        <MiniSpark data={leadsSpark} accent={accent} />
      </div>

      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-foreground transition-colors"
        aria-hidden="true"
      />
    </Link>
  );
}

// ---------------------------------------------------------------------------

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
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border">
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
  return (
    <div
      className="relative h-10 w-10 shrink-0 grid place-items-center rounded-md border border-border"
      style={{
        backgroundColor: accent ? `${accent}14` : "hsl(var(--muted))",
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

// Mini stat — labelled column used inline. Falls back to em-dash on null
// so absent data doesn't visually skip a slot.
function Stat({
  label,
  value,
  hint,
  hintTone = "muted",
  icon,
  valueTone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  hintTone?: "muted" | "amber" | "rose";
  icon?: React.ReactNode;
  valueTone?: "default" | "active" | "muted";
}) {
  const valueClass = cn(
    "text-[13px] font-semibold tabular-nums leading-none",
    valueTone === "muted" ? "text-muted-foreground/60" : "text-foreground",
  );
  const hintClass = cn(
    "text-[10px] tabular-nums leading-none",
    hintTone === "amber"
      ? "text-amber-700"
      : hintTone === "rose"
        ? "text-muted-foreground"
        : "text-muted-foreground",
  );
  return (
    <div className="hidden lg:flex w-[68px] shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-1 text-[9px] tracking-widest uppercase font-semibold text-muted-foreground leading-none">
        {icon}
        <span>{label}</span>
      </div>
      <div className={valueClass}>{value}</div>
      {hint ? <span className={hintClass}>{hint}</span> : null}
    </div>
  );
}

function OccupancyBar({ pct }: { pct: number | null | undefined }) {
  if (pct == null) {
    return (
      <div
        className="w-full h-1 rounded-full bg-muted"
        aria-hidden="true"
      />
    );
  }
  // Single blue scale — fuller buildings render the deepest blue, lower
  // occupancy fades through brand and pale. No green/amber/red traffic-
  // light, just a magnitude indicator that stays inside the brand palette.
  const clamped = Math.max(0, Math.min(100, pct));
  const tone =
    clamped >= 90
      ? "bg-primary-dark"
      : clamped >= 75
        ? "bg-primary"
        : clamped >= 50
          ? "bg-primary/60"
          : "bg-primary/30";
  return (
    <div
      className="w-full h-1 rounded-full bg-muted overflow-hidden"
      aria-hidden="true"
    >
      <div
        className={cn("h-full", tone)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function MiniSpark({ data, accent }: { data: number[]; accent?: string }) {
  if (data.length < 2 || data.every((v) => v === 0)) {
    // Render a flat baseline so the column doesn't collapse and rows
    // stay visually aligned. Subtle + monochrome — implies "no signal yet".
    return (
      <svg
        viewBox="0 0 56 16"
        className="h-4 w-14"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          x1="0"
          y1="14"
          x2="56"
          y2="14"
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
  const w = 56;
  const h = 16;
  const stepX = w / (data.length - 1);
  const points = data
    .map(
      (v, i) =>
        `${(i * stepX).toFixed(1)},${(h - ((v - min) / range) * (h - 4) - 2).toFixed(1)}`,
    )
    .join(" ");
  // Build an area underlay for a touch of weight.
  const areaPoints = `0,${h} ${points} ${w},${h}`;
  const stroke = accent ?? "#2563EB";
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-4 w-14"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon
        points={areaPoints}
        fill={stroke}
        opacity="0.12"
      />
      <polyline
        points={points}
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

// Optional: tiny inline pill component reused below for activeCampaigns +
// reputation links. Kept for future feature gating; the row layout above
// inlines the data so this no longer needs to render its own footer.
export function PropertyFooterStrip({
  id,
  activeCampaigns,
  reputationMentionCount,
  reputationNegativeCount,
  reputationUnreviewedCount,
}: {
  id: string;
  activeCampaigns: number;
  reputationMentionCount: number;
  reputationNegativeCount: number;
  reputationUnreviewedCount: number;
}) {
  if (activeCampaigns === 0 && reputationMentionCount === 0) return null;
  return (
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
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
      ) : null}
      {reputationMentionCount > 0 ? (
        <Link
          href={`/portal/properties/${id}?tab=reputation`}
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Star className="h-2.5 w-2.5" />
          <span>{reputationMentionCount} mentions</span>
          {reputationNegativeCount > 0 ? (
            <span className="text-muted-foreground">
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
  );
}
