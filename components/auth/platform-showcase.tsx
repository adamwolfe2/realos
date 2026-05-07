"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  Users,
  CalendarCheck,
  DollarSign,
  Sparkles,
  Building2,
  Activity,
  Star,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PlatformShowcase
//
// Right-rail of /sign-in and /sign-up. A composition of animated
// LeaseStack UI fragments — KPI tiles ticking up, sparkline drawing,
// donut chart filling, funnel bars growing, lead cards sliding in,
// activity feed scrolling.
//
// Pure CSS animations + setInterval-driven state ticks so it feels
// alive without React-spring or framer-motion. All numbers are
// fictional but realistic for a student-housing operator like
// Telegraph Commons. Uses brand fonts (Fraunces + Inter) and the
// near-black palette so it reads as the actual platform.
// ---------------------------------------------------------------------------

const NUMBER_FONT = {
  fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
  fontVariantNumeric: "tabular-nums",
} as const;

const SERIF = {
  fontFamily: "var(--font-fraunces, Georgia, 'Times New Roman', serif)",
} as const;

export function PlatformShowcase() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-[#FAFAF6] via-[#F5F4EE] to-[#EFEEE7]">
      {/* Decorative background — subtle cream gradient + grid + soft glow */}
      <div className="absolute inset-0 opacity-[0.025] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div
        aria-hidden="true"
        className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-amber-100/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-0 -left-40 h-96 w-96 rounded-full bg-blue-100/20 blur-3xl"
      />

      {/* Header marketing copy */}
      <div className="relative z-10 px-12 pt-16 pb-8">
        <p className="text-[11px] tracking-[0.18em] uppercase font-semibold text-foreground/60">
          Real estate operator portal
        </p>
        <h2
          className="mt-4 text-[40px] leading-[1.05] font-semibold tracking-tight text-foreground max-w-lg"
          style={SERIF}
        >
          Marketing, leasing, and operations in a single dashboard.
        </h2>
        <p className="mt-3 text-sm text-foreground/65 max-w-md leading-relaxed">
          Live data from AppFolio, GA4, Google Search Console, your
          pixel, and Google &amp; Meta Ads — unified per property.
        </p>
      </div>

      {/* The animated mock dashboard composition */}
      <div className="relative z-10 px-8 pb-8 space-y-3">
        <KpiStrip />
        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-3">
            <FunnelCard />
          </div>
          <div className="col-span-2">
            <LeadSourceDonut />
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-2">
            <PropertyCard />
          </div>
          <div className="col-span-3">
            <ActivityFeed />
          </div>
        </div>
      </div>

      {/* Local style block — keyframes for the animations */}
      <style jsx>{`
        @keyframes ls-shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI strip — 4 tiles with count-up numbers and tiny sparklines
// ---------------------------------------------------------------------------

const KPIS = [
  {
    label: "New leads (28d)",
    target: 247,
    delta: "+18%",
    icon: Users,
    accent: "text-foreground",
    spark: [4, 6, 5, 8, 7, 9, 11, 10, 12, 14, 13, 16, 18, 22],
  },
  {
    label: "Tours scheduled",
    target: 89,
    delta: "+11%",
    icon: CalendarCheck,
    accent: "text-foreground",
    spark: [2, 3, 3, 4, 5, 4, 6, 7, 6, 8, 9, 8, 10, 11],
  },
  {
    label: "Conversion",
    target: 16.6,
    suffix: "%",
    delta: "+2.4pt",
    icon: TrendingUp,
    accent: "text-foreground",
    spark: [10, 12, 11, 13, 14, 12, 13, 15, 14, 15, 16, 16, 17, 17],
    decimal: 1,
  },
  {
    label: "Cost per lead",
    target: 20.8,
    prefix: "$",
    delta: "−$3.2",
    icon: DollarSign,
    accent: "text-foreground",
    spark: [28, 27, 26, 25, 26, 24, 23, 24, 22, 23, 22, 21, 21, 20],
  },
];

function KpiStrip() {
  return (
    <div
      className="rounded-xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] p-3"
      style={{ animationDelay: "0.05s" }}
    >
      <div className="grid grid-cols-4 gap-2">
        {KPIS.map((kpi, idx) => (
          <KpiTile key={kpi.label} kpi={kpi} idx={idx} />
        ))}
      </div>
    </div>
  );
}

function KpiTile({
  kpi,
  idx,
}: {
  kpi: (typeof KPIS)[number];
  idx: number;
}) {
  const Icon = kpi.icon;
  const value = useCountUp(kpi.target, 1400 + idx * 200, kpi.decimal ?? 0);

  return (
    <div className="rounded-lg border border-black/[0.04] bg-[#FAFAF7] p-2.5 relative overflow-hidden">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3 h-3 text-muted-foreground/70" aria-hidden="true" />
        <span className="text-[9px] font-semibold tracking-wider uppercase text-muted-foreground/80">
          {kpi.label}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div
            className={cn("text-xl font-semibold leading-none", kpi.accent)}
            style={NUMBER_FONT}
          >
            {kpi.prefix ?? ""}
            {kpi.decimal ? value.toFixed(kpi.decimal) : Math.round(value).toLocaleString()}
            {kpi.suffix ?? ""}
          </div>
          <div className="mt-1 text-[9px] text-emerald-700 font-semibold tracking-wide">
            {kpi.delta}
          </div>
        </div>
        <Sparkline data={kpi.spark} />
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 56;
  const h = 18;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-foreground/70"
        style={{
          strokeDasharray: 200,
          strokeDashoffset: 200,
          animation: "ls-draw 1.6s ease-out forwards",
          animationDelay: "0.3s",
        }}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Funnel card — bars draw left to right
// ---------------------------------------------------------------------------

const FUNNEL_STAGES = [
  { label: "Visitors", value: 12_480, pct: 100 },
  { label: "Leads", value: 247, pct: 79 },
  { label: "Tours", value: 89, pct: 52 },
  { label: "Apps", value: 41, pct: 28 },
  { label: "Leases", value: 18, pct: 14 },
];

function FunnelCard() {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <TrendingUp
              className="w-3 h-3 text-muted-foreground/80"
              aria-hidden="true"
            />
            <h3 className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/90">
              Conversion funnel
            </h3>
          </div>
          <p className="text-xs text-foreground/80 mt-0.5">Last 28 days</p>
        </div>
        <span className="text-[10px] font-semibold text-emerald-700 tabular-nums bg-emerald-50 px-1.5 py-0.5 rounded">
          14% close
        </span>
      </div>
      <div className="space-y-1.5">
        {FUNNEL_STAGES.map((stage, idx) => (
          <div key={stage.label} className="flex items-center gap-3">
            <span className="text-[10px] font-medium text-muted-foreground w-14 shrink-0">
              {stage.label}
            </span>
            <div className="flex-1 h-5 rounded bg-[#F4F3ED] relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-foreground rounded"
                style={{
                  width: `${stage.pct}%`,
                  animation: `ls-grow 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                  animationDelay: `${0.2 + idx * 0.12}s`,
                  transformOrigin: "left center",
                  transform: "scaleX(0)",
                }}
              />
            </div>
            <span
              className="text-xs font-semibold text-foreground tabular-nums w-14 text-right shrink-0"
              style={NUMBER_FONT}
            >
              {stage.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lead source donut — circular slices animate in
// ---------------------------------------------------------------------------

const SOURCES = [
  { label: "Google", pct: 38, color: "#0A0A0A" },
  { label: "Direct", pct: 24, color: "#3F3F46" },
  { label: "Meta", pct: 18, color: "#71717A" },
  { label: "Reddit", pct: 12, color: "#A1A1AA" },
  { label: "Other", pct: 8, color: "#D4D4D8" },
];

function LeadSourceDonut() {
  const radius = 44;
  const cx = 60;
  const cy = 60;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const segments = SOURCES.map((src, idx) => {
    const length = (src.pct / 100) * circumference;
    const seg = {
      ...src,
      length,
      offset,
      idx,
    };
    offset += length;
    return seg;
  });

  return (
    <div className="rounded-xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] p-4 h-full">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles
          className="w-3 h-3 text-muted-foreground/80"
          aria-hidden="true"
        />
        <h3 className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/90">
          Lead source
        </h3>
      </div>
      <div className="flex items-center gap-3">
        <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="#F4F3ED"
            strokeWidth={strokeWidth}
          />
          {segments.map((s) => (
            <circle
              key={s.label}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${s.length} ${circumference}`}
              strokeDashoffset={-s.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{
                opacity: 0,
                animation: `ls-fade-in 0.5s ease-out forwards`,
                animationDelay: `${0.3 + s.idx * 0.18}s`,
              }}
            />
          ))}
          <text
            x={cx}
            y={cy - 2}
            textAnchor="middle"
            className="fill-foreground"
            style={{ ...NUMBER_FONT, fontSize: "16px", fontWeight: 600 }}
          >
            247
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: "8px", letterSpacing: "0.05em" }}
          >
            LEADS
          </text>
        </svg>
        <ul className="flex-1 space-y-1 min-w-0">
          {SOURCES.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5 text-[10px]">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-muted-foreground truncate">{s.label}</span>
              <span
                className="ml-auto font-semibold text-foreground tabular-nums"
                style={NUMBER_FONT}
              >
                {s.pct}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Property card — Telegraph Commons style hero
// ---------------------------------------------------------------------------

function PropertyCard() {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Hero — gradient placeholder for the property photo */}
      <div className="h-20 bg-gradient-to-br from-amber-200/60 via-amber-100/50 to-stone-200 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.5)_50%,transparent_70%)] bg-[length:200%_100%]"
          style={{ animation: "ls-shimmer 4s linear infinite" }}
        />
        <div className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white px-1.5 py-0.5 text-[9px] font-semibold">
          <span className="h-1 w-1 rounded-full bg-white animate-pulse" />
          LIVE
        </div>
        <Building2
          className="absolute bottom-2 left-2.5 w-4 h-4 text-foreground/60"
          aria-hidden="true"
        />
      </div>
      <div className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground truncate">
            Telegraph Commons
          </h3>
          <span
            className="text-[10px] font-semibold text-foreground tabular-nums"
            style={NUMBER_FONT}
          >
            96%
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground truncate">
          Berkeley, CA · 100 units
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={cn(
                  "w-2.5 h-2.5",
                  i <= 4 ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30",
                )}
              />
            ))}
          </div>
          <span
            className="text-[10px] text-muted-foreground tabular-nums"
            style={NUMBER_FONT}
          >
            4.6
          </span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] text-muted-foreground">49 reviews</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity feed — items appear at intervals
// ---------------------------------------------------------------------------

const ACTIVITY_ITEMS = [
  {
    icon: Users,
    title: "New lead from Google",
    body: "Sarah Chen viewed 2-bed floor plan",
    time: "2m ago",
    accent: "text-foreground",
  },
  {
    icon: CalendarCheck,
    title: "Tour scheduled",
    body: "Marcus L. · Wed Jun 12, 3:00 PM",
    time: "8m ago",
    accent: "text-foreground",
  },
  {
    icon: Activity,
    title: "Pixel event",
    body: "Application started · /apply",
    time: "12m ago",
    accent: "text-foreground",
  },
  {
    icon: Star,
    title: "New Google review",
    body: "★★★★★ — 'Best location near campus'",
    time: "34m ago",
    accent: "text-foreground",
  },
];

function ActivityFeed() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    setVisible(1);
    const interval = setInterval(() => {
      setVisible((v) => {
        if (v >= ACTIVITY_ITEMS.length) return ACTIVITY_ITEMS.length;
        return v + 1;
      });
    }, 700);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] p-3 h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-muted-foreground/80" aria-hidden="true" />
          <h3 className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/90">
            Live activity
          </h3>
        </div>
        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Real-time
        </span>
      </div>
      <ul className="space-y-1.5">
        {ACTIVITY_ITEMS.map((item, idx) => {
          const Icon = item.icon;
          const isVisible = idx < visible;
          return (
            <li
              key={item.title}
              className={cn(
                "flex items-start gap-2 transition-all duration-500",
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2",
              )}
            >
              <div className="mt-0.5 h-5 w-5 rounded-full bg-[#FAFAF7] border border-black/[0.04] flex items-center justify-center shrink-0">
                <Icon
                  className={cn("w-2.5 h-2.5", item.accent)}
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-foreground truncate">
                  {item.title}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {item.body}
                </p>
              </div>
              <span className="text-[9px] text-muted-foreground/70 tabular-nums shrink-0">
                {item.time}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 pt-2 border-t border-black/[0.04] flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {ACTIVITY_ITEMS.length} new events
        </span>
        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-foreground">
          View all <ArrowRight className="w-2.5 h-2.5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// useCountUp — animate a number from 0 to target over `duration` ms
// ---------------------------------------------------------------------------
function useCountUp(target: number, duration: number, decimals = 0): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let startTs: number | null = null;
    let frame: number;
    function tick(ts: number) {
      if (startTs === null) startTs = ts;
      const elapsed = ts - startTs;
      const t = Math.min(elapsed / duration, 1);
      // Ease-out cubic for a natural settle
      const eased = 1 - Math.pow(1 - t, 3);
      const next = eased * target;
      setValue(decimals === 0 ? Math.round(next) : next);
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, decimals]);

  return value;
}
