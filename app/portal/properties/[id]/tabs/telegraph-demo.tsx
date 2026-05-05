"use client";

// ---------------------------------------------------------------------------
// Telegraph Commons demo tabs.
//
// Modern dashboard aesthetic:
//  - Gradient hero KPI (big colorful number for headline metric)
//  - Icon-badge KPI cards with inline sparklines (Reference 1 + 3 style)
//  - Big single-color gradient area chart (Neural Network style)
//  - Pie chart with center text (Device Breakdown style)
//  - Geographic-style horizontal bar lists
//  - Active-items lists with progress bars + arrows
//  - Floating tooltip styling on Recharts
//  - Soft shadows + rounded corners replace harsh borders
//
// Activates when isTelegraphCommons matches the property name/slug.
// ---------------------------------------------------------------------------

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  Eye,
  Globe,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  MousePointerClick,
  Sparkles,
  Star,
  Target,
  Users,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Theme — pulled to a single object so charts + cards share one palette.
// ---------------------------------------------------------------------------

const C = {
  primary: "#1D4ED8",
  primaryMid: "#2563EB",
  primaryLight: "#3B82F6",
  primaryFaint: "#93C5FD",
  primaryGhost: "#DBEAFE",
  indigo: "#4F46E5",
  indigoLight: "#6366F1",
  ink: "#0F172A",
  inkSoft: "#475569",
  muted: "#94A3B8",
  mutedSoft: "#CBD5E1",
  border: "#E5E7EB",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
  amber: "#F59E0B", // reserved for true warning states only
  positive: "#10B981",
  negative: "#EF4444",
  violet: "#8B5CF6",
  cyan: "#06B6D4",
  rose: "#F43F5E",
};

// ---------------------------------------------------------------------------
// Floating tooltip — used by every chart for the hover-modal effect from the
// reference designs. Pure white card, soft drop shadow, no harsh borders.
// ---------------------------------------------------------------------------

function chartTooltipProps() {
  return {
    cursor: { stroke: "#CBD5E1", strokeDasharray: "3 3" },
    contentStyle: {
      fontSize: 11,
      background: "white",
      border: "none",
      borderRadius: 12,
      boxShadow:
        "0 12px 32px -8px rgba(15, 23, 42, 0.18), 0 2px 6px -2px rgba(15, 23, 42, 0.08)",
      padding: "8px 10px",
      outline: "none",
    },
    labelStyle: { color: C.ink, fontWeight: 700, fontSize: 11, marginBottom: 2 },
    itemStyle: { padding: 0, color: C.inkSoft },
  };
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function Card({
  children,
  className = "",
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={
        "rounded-2xl border border-border bg-card transition-shadow " +
        (hover
          ? "shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)] "
          : "shadow-[0_1px_2px_rgba(15,23,42,0.04)] ") +
        className
      }
    >
      {children}
    </div>
  );
}

function CardHead({
  eyebrow,
  title,
  description,
  right,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground mb-1">
            {eyebrow}
          </div>
        ) : null}
        <h2
          className="text-[15px] font-semibold tracking-tight text-foreground leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
            {description}
          </p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function DeltaPill({
  value,
  trend,
  size = "sm",
}: {
  value: string;
  trend: "up" | "down" | "flat";
  size?: "sm" | "xs";
}) {
  const isUp = trend === "up";
  const isDown = trend === "down";
  const tone = isUp
    ? "bg-emerald-50 text-emerald-700"
    : isDown
      ? "bg-rose-50 text-rose-700"
      : "bg-slate-100 text-slate-600";
  const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : null;
  const sz = size === "xs" ? "text-[9px] px-1 py-0.5" : "text-[10px] px-1.5 py-0.5";
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 rounded-md font-bold tabular-nums " +
        tone +
        " " +
        sz
      }
    >
      {Icon ? <Icon className="h-3 w-3" strokeWidth={2.5} /> : null}
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// IconKpi — Reference 1 + 3 style. Icon badge top-left, label,
// big number, delta pill, optional inline sparkline on the right.
// ---------------------------------------------------------------------------

function IconKpi({
  label,
  value,
  delta,
  hint,
  icon,
  iconTone = "primary",
  spark,
  sparkColor = C.primary,
}: {
  label: string;
  value: React.ReactNode;
  delta?: { value: string; trend: "up" | "down" | "flat" };
  hint?: string;
  icon?: React.ReactNode;
  iconTone?: "primary" | "amber" | "violet" | "cyan" | "rose" | "emerald" | "indigo";
  spark?: number[];
  sparkColor?: string;
}) {
  const tones = {
    primary: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    cyan: "bg-cyan-50 text-cyan-600",
    rose: "bg-rose-50 text-rose-600",
    emerald: "bg-emerald-50 text-emerald-600",
    indigo: "bg-indigo-50 text-indigo-600",
  };
  return (
    <Card>
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon ? (
              <span
                className={
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 " +
                  tones[iconTone]
                }
              >
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground truncate">
                {label}
              </p>
            </div>
          </div>
          {delta ? <DeltaPill {...delta} /> : null}
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[24px] font-bold leading-none tracking-tight tabular-nums text-foreground truncate">
              {value}
            </p>
            {hint ? (
              <p className="mt-1.5 text-[10px] text-muted-foreground truncate">
                {hint}
              </p>
            ) : null}
          </div>
          {spark && spark.length > 1 ? (
            <div className="w-[88px] h-7 shrink-0">
              <Sparkline data={spark} color={sparkColor} />
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function Sparkline({
  data,
  color = C.primary,
}: {
  data: number[];
  color?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 28;
  const stepX = w / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y] as const;
  });
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const id = React.useId();
  const gradId = `spark-grad-${id}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={d + ` L ${w},${h} L 0,${h} Z`} fill={`url(#${gradId})`} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// HeroBlock — gradient headline number, date selector. Reference 1 style.
// ---------------------------------------------------------------------------

function HeroBlock({
  label,
  value,
  hint,
  rightActions,
}: {
  label: string;
  value: string;
  hint?: string;
  rightActions?: React.ReactNode;
}) {
  return (
    <Card hover={false}>
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
          <p
            className="mt-1 text-[36px] md:text-[44px] leading-none font-bold tracking-tight tabular-nums truncate"
            style={{
              backgroundImage:
                "linear-gradient(90deg, #1D4ED8 0%, #2563EB 35%, #3B82F6 70%, #60A5FA 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {value}
          </p>
          {hint ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        {rightActions ? (
          <div className="flex items-center gap-2">{rightActions}</div>
        ) : null}
      </div>
    </Card>
  );
}

function PillButton({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {icon}
      {children}
    </button>
  );
}

function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      Live
    </span>
  );
}

function HeroBanner({
  insight,
}: {
  insight: { tone: "alert" | "warn" | "ok"; headline: string; body: string };
}) {
  const tone =
    insight.tone === "alert"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : insight.tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-emerald-200 bg-emerald-50 text-emerald-900";
  return (
    <div
      className={
        "rounded-2xl border px-3.5 py-2.5 flex items-start gap-2.5 " + tone
      }
    >
      <Sparkles className="h-4 w-4 shrink-0 mt-0.5 opacity-80" />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold tracking-tight leading-tight">
          {insight.headline}
        </p>
        <p className="text-[11px] mt-0.5 opacity-90 leading-snug">
          {insight.body}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 28-day series shared across tabs so the story is consistent.
// ---------------------------------------------------------------------------

const DAYS_28 = Array.from({ length: 28 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (27 - i));
  return d.toISOString().slice(5, 10).replace("-", "/");
});

const FUNNEL_DAILY = [
  { d: 0, leads: 4, tours: 1, apps: 0 },
  { d: 1, leads: 6, tours: 2, apps: 1 },
  { d: 2, leads: 5, tours: 1, apps: 0 },
  { d: 3, leads: 9, tours: 3, apps: 1 },
  { d: 4, leads: 7, tours: 2, apps: 1 },
  { d: 5, leads: 11, tours: 4, apps: 2 },
  { d: 6, leads: 9, tours: 3, apps: 1 },
  { d: 7, leads: 8, tours: 3, apps: 1 },
  { d: 8, leads: 6, tours: 2, apps: 1 },
  { d: 9, leads: 12, tours: 4, apps: 2 },
  { d: 10, leads: 8, tours: 3, apps: 1 },
  { d: 11, leads: 13, tours: 5, apps: 2 },
  { d: 12, leads: 9, tours: 3, apps: 1 },
  { d: 13, leads: 14, tours: 5, apps: 2 },
  { d: 14, leads: 11, tours: 4, apps: 2 },
  { d: 15, leads: 16, tours: 6, apps: 3 },
  { d: 16, leads: 14, tours: 5, apps: 2 },
  { d: 17, leads: 18, tours: 6, apps: 3 },
  { d: 18, leads: 15, tours: 5, apps: 2 },
  { d: 19, leads: 19, tours: 7, apps: 3 },
  { d: 20, leads: 16, tours: 6, apps: 3 },
  { d: 21, leads: 21, tours: 8, apps: 3 },
  { d: 22, leads: 17, tours: 6, apps: 3 },
  { d: 23, leads: 22, tours: 8, apps: 4 },
  { d: 24, leads: 18, tours: 7, apps: 3 },
  { d: 25, leads: 24, tours: 9, apps: 4 },
  { d: 26, leads: 19, tours: 7, apps: 3 },
  { d: 27, leads: 27, tours: 10, apps: 5 },
].map((row) => ({ ...row, day: DAYS_28[row.d] }));

const LEAD_SPARK = FUNNEL_DAILY.slice(-14).map((r) => r.leads);
const TOUR_SPARK = FUNNEL_DAILY.slice(-14).map((r) => r.tours);
const APP_SPARK = FUNNEL_DAILY.slice(-14).map((r) => r.apps);

// ---------------------------------------------------------------------------
// Brand logos for Reputation source list. Tiny SVGs, only place we allow
// non-blue chrome (brand colors are the point — they identify the source).
// ---------------------------------------------------------------------------

function GoogleLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Google">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function YelpLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Yelp">
      <path
        fill="#D32323"
        d="M14.05 16.32c.61.51.5 1.51-.21 1.86l-3.49 1.69c-.74.36-1.6-.21-1.55-1.04l.21-3.78c.05-.86 1.03-1.32 1.71-.79l3.33 2.06zm-3.7-3.21l-3.78-1.04c-.81-.22-1.18-1.16-.71-1.85l2.16-3.16c.47-.69 1.51-.61 1.87.13l1.62 3.55c.36.79-.32 1.66-1.16 1.39v.97l-.01.01zm5.7-1.39c-.84.27-1.52-.6-1.16-1.39l1.62-3.55c.36-.74 1.4-.82 1.87-.13l2.16 3.16c.47.69.1 1.63-.71 1.85l-3.78 1.04v-.99zm-.65 5.4c-.55-.65-.07-1.65.78-1.62l3.79.13c.83.03 1.32.93.85 1.62l-2.13 3.13c-.47.69-1.51.6-1.86-.16l-1.43-3.1zm-7.45-7.65c-.55.65-1.59.5-1.94-.27l-1.55-3.42c-.34-.76.2-1.62 1.05-1.65l3.79-.16c.86-.04 1.39.92.91 1.6l-2.26 3.9z"
      />
    </svg>
  );
}

function RedditLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Reddit">
      <circle cx="12" cy="12" r="11" fill="#FF4500" />
      <path
        fill="white"
        d="M19.7 12c0-.94-.76-1.7-1.7-1.7-.46 0-.87.18-1.18.47-1.16-.83-2.74-1.36-4.5-1.42l.77-3.62 2.51.53c.03.64.55 1.16 1.2 1.16.66 0 1.2-.54 1.2-1.2 0-.66-.54-1.2-1.2-1.2-.47 0-.88.27-1.07.67l-2.81-.6c-.08-.02-.16 0-.23.04-.06.04-.11.11-.13.19l-.86 4.06c-1.79.05-3.4.58-4.57 1.42-.31-.29-.72-.47-1.18-.47-.94 0-1.7.76-1.7 1.7 0 .69.41 1.29 1 1.55-.03.17-.04.35-.04.53 0 2.7 3.13 4.88 7 4.88s7-2.18 7-4.88c0-.18-.01-.36-.04-.53.59-.26 1-.86 1-1.55zM8 13.2c0-.66.54-1.2 1.2-1.2.66 0 1.2.54 1.2 1.2 0 .66-.54 1.2-1.2 1.2-.66 0-1.2-.54-1.2-1.2zm6.7 3.2c-.83.83-2.42.89-2.7.89-.28 0-1.87-.06-2.7-.89-.12-.12-.12-.32 0-.45.12-.12.32-.12.45 0 .53.53 1.65.71 2.25.71.6 0 1.72-.18 2.25-.71.12-.12.32-.12.45 0 .12.13.12.33 0 .45zm-.2-2c-.66 0-1.2-.54-1.2-1.2 0-.66.54-1.2 1.2-1.2.66 0 1.2.54 1.2 1.2 0 .66-.54 1.2-1.2 1.2z"
      />
    </svg>
  );
}

function ApartmentLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="ApartmentRatings">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#0EA5E9" />
      <path
        fill="white"
        d="M7 18V9.5L12 6l5 3.5V18h-3.2v-4.5h-3.6V18H7zm3.4-7.6h3.2v-1h-3.2v1z"
      />
    </svg>
  );
}

function NicheLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Niche">
      <rect width="24" height="24" rx="4" fill="#0F172A" />
      <path
        fill="#22D3EE"
        d="M12 6l5 3v6l-5 3-5-3V9l5-3zm0 2.3L9 10.1v3.8l3 1.8 3-1.8v-3.8L12 8.3z"
      />
    </svg>
  );
}

// ===========================================================================
// OVERVIEW
// ===========================================================================

export function TelegraphOverviewDemo() {
  const sources = [
    { name: "Google Ads", value: 84, color: C.primary },
    { name: "Meta Ads", value: 59, color: C.primaryMid },
    { name: "Organic", value: 47, color: C.primaryLight },
    { name: "Chatbot", value: 31, color: C.primaryFaint },
    { name: "Referral", value: 18, color: C.violet },
    { name: "Direct", value: 8, color: "#CBD5E1" },
  ];

  return (
    <div className="space-y-3 ls-page-fade">
      {/* Hero — gradient revenue number */}
      <HeroBlock
        label="Monthly rent roll · Telegraph Commons"
        value="$462,800"
        hint="100 of 100 leased · 14 weeks at full · $4,628 avg / unit"
        rightActions={
          <>
            <PillButton icon={<Calendar className="h-3 w-3" />}>
              Last 28 days
            </PillButton>
            <PillButton icon={<Eye className="h-3 w-3" />}>
              Compare
            </PillButton>
          </>
        }
      />

      <HeroBanner
        insight={{
          tone: "warn",
          headline: "18 leases expire in 30 days — pricing 6% below market",
          body: "Renewal offers should already be sent. Avg rent on the cohort is $4,628; market comp benchmark is $4,920. Push offers + pre-load chatbot scripts.",
        }}
      />

      {/* KPI strip — Reference 1 style with icon badges + sparklines */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <IconKpi
          label="Leads (28d)"
          value="247"
          delta={{ value: "+34%", trend: "up" }}
          hint="vs 184 prior period"
          icon={<Target className="h-4 w-4" strokeWidth={2.25} />}
          spark={LEAD_SPARK}
        />
        <IconKpi
          label="Tours scheduled"
          value="89"
          delta={{ value: "+22%", trend: "up" }}
          hint="36% of leads · +5pts"
          icon={<Calendar className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="violet"
          spark={TOUR_SPARK}
          sparkColor={C.violet}
        />
        <IconKpi
          label="Applications"
          value="41"
          delta={{ value: "+41%", trend: "up" }}
          hint="46% of tours · +11pts"
          icon={<CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="emerald"
          spark={APP_SPARK}
          sparkColor={C.positive}
        />
        <IconKpi
          label="CPL"
          value="$20.80"
          delta={{ value: "-12%", trend: "up" }}
          hint="Best in 6 months"
          icon={<DollarSign className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="indigo"
          spark={[26, 25, 27, 24, 23, 25, 22, 24, 21, 22, 20, 22, 21, 20]}
          sparkColor={C.indigo}
        />
      </section>

      {/* Big gradient pipeline chart + lead source pie with center text */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-3">
        <Card>
          <CardHead
            eyebrow="Last 28 days"
            title="Lead pipeline activity"
            description="Daily leads, tours, applications. Pipeline up 34% week-over-week as Fall 2026 demand accelerates."
            right={
              <div className="flex items-center gap-2">
                <PillButton icon={<Sparkles className="h-3 w-3" />}>
                  Filter
                </PillButton>
                <LivePill />
              </div>
            }
          />
          <div className="px-2 pb-3">
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <AreaChart
                  data={FUNNEL_DAILY}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="ov-leads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.primary} stopOpacity={0.32} />
                      <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ov-tours" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.primaryFaint} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={C.primaryFaint} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: C.muted }}
                    tickLine={false}
                    axisLine={false}
                    interval={6}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: C.muted }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <Tooltip {...chartTooltipProps()} />
                  <Area
                    type="monotone"
                    dataKey="leads"
                    name="Leads"
                    stroke={C.primary}
                    strokeWidth={2.5}
                    fill="url(#ov-leads)"
                  />
                  <Area
                    type="monotone"
                    dataKey="tours"
                    name="Tours"
                    stroke={C.primaryFaint}
                    strokeWidth={2}
                    fill="url(#ov-tours)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead
            eyebrow="28d · 247 total"
            title="Lead sources"
            description="Where this property's leads come from"
          />
          <div className="px-4 pb-4">
            <PieWithCenter
              data={sources}
              centerTop="Google Ads"
              centerBottom="34%"
            />
            <ul className="mt-3 space-y-1.5">
              {sources.map((s) => {
                const total = sources.reduce((a, b) => a + b.value, 0);
                const pct = Math.round((s.value / total) * 100);
                return (
                  <li
                    key={s.name}
                    className="grid grid-cols-[10px_1fr_auto_36px] items-center gap-2 text-[11px]"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="truncate text-foreground">{s.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.value}
                    </span>
                    <span className="text-right tabular-nums text-foreground font-bold">
                      {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
      </section>

      {/* Renewal pipeline + occupancy trend */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
        <Card>
          <CardHead
            eyebrow="Next 120 days"
            title="Renewal pipeline"
            description="70 leases up · ~$326,908/mo at risk if everyone walks"
            right={<MoreHorizontal className="h-4 w-4 text-muted-foreground" />}
          />
          <div className="px-4 pb-4 space-y-2">
            <ActiveItem
              icon="0–30d"
              tone="amber"
              label="18 leases · $84,960/mo"
              sub="Sophia Patel, Emma Johnson, Noah Garcia, +15 others"
              progress={89}
              progressLabel="89% offers sent"
            />
            <ActiveItem
              icon="31–60d"
              tone="amber"
              label="14 leases · $65,492/mo"
              sub="Logan Reed, Aria Singh, Chloe Davis, +11 others"
              progress={64}
              progressLabel="64% offers sent"
            />
            <ActiveItem
              icon="61–90d"
              tone="primary"
              label="22 leases · $102,816/mo"
              sub="Alexandra Chen, Marcus Williams, Daniel Rodriguez, +19 others"
              progress={32}
              progressLabel="32% offers sent"
            />
            <ActiveItem
              icon="91–120d"
              tone="muted"
              label="16 leases · $73,640/mo"
              sub="Olivia Martinez, Liam O'Brien, Ava Thompson, +13 others"
              progress={6}
              progressLabel="6% offers sent"
            />
          </div>
        </Card>

        <Card>
          <CardHead
            eyebrow="Forecast · next 120d"
            title="Predicted outcome"
            description="Based on engagement, market position, prior renewals"
          />
          <div className="px-4 pb-4 space-y-2.5">
            <ForecastRow tone="good" label="Likely renew" count={48} pct={68} note="~$222K/mo locked" />
            <ForecastRow tone="warn" label="At risk" count={14} pct={20} note="Push offers this week" />
            <ForecastRow tone="alert" label="Likely move out" count={8} pct={12} note="Backfill ready" />
          </div>
        </Card>
      </section>

      {/* Operations strip — top channels + reputation snapshot */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr] gap-3">
        <Card>
          <CardHead eyebrow="Performance" title="Top channels (28d)" />
          <div className="px-4 pb-4">
            <ChannelTable
              rows={[
                { name: "Google Ads — Brand", leads: 84, cpl: 15.24, conv: "28%" },
                { name: "Meta Ads — Tour Push", leads: 41, cpl: 20.0, conv: "19%" },
                { name: "Google Ads — Berkeley SH", leads: 36, cpl: 26.11, conv: "22%" },
                { name: "Meta Retargeting", leads: 18, cpl: 26.67, conv: "31%" },
              ]}
            />
          </div>
        </Card>

        <Card>
          <CardHead eyebrow="Live · AppFolio" title="Occupancy" />
          <div className="px-4 pb-4 grid grid-cols-[auto_1fr] items-center gap-3">
            <PieWithCenter
              data={[
                { name: "Leased", value: 100, color: C.primary },
                { name: "On notice", value: 0, color: C.primaryFaint },
              ]}
              centerTop="100%"
              centerBottom="Occupied"
              size={104}
              inner={36}
              outer={48}
              hideTooltip
            />
            <ul className="space-y-1.5 text-[11px] min-w-0">
              <KvLine k="Leased" v="100" tone={C.primary} />
              <KvLine k="Available" v="0" tone={C.primaryFaint} />
              <KvLine k="On notice" v="72" tone={C.muted} />
              <KvLine k="Apps queued" v="23" tone={C.violet} />
            </ul>
          </div>
        </Card>

        <Card>
          <CardHead eyebrow="Across 5 sources" title="Reputation pulse" />
          <div className="px-4 pb-4">
            <div className="flex items-center gap-3 mb-2.5">
              <p className="text-[28px] font-bold leading-none tabular-nums tracking-tight text-foreground">
                4.7
              </p>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-0.5 mb-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="h-3 w-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  269 reviews · <span className="text-emerald-700 font-semibold">+34 in 28d</span>
                </p>
              </div>
              <DeltaPill value="+0.2" trend="up" />
            </div>
            <RatingBars />
          </div>
        </Card>
      </section>
    </div>
  );
}

function ActiveItem({
  icon,
  tone,
  label,
  sub,
  progress,
  progressLabel,
}: {
  icon: string;
  tone: "amber" | "primary" | "muted" | "emerald";
  label: string;
  sub: string;
  progress: number;
  progressLabel: string;
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    primary: "bg-blue-50 text-blue-700 border-blue-200",
    muted: "bg-slate-100 text-slate-700 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  const barColor = tone === "amber" ? "#F59E0B" : tone === "primary" ? C.primary : tone === "emerald" ? C.positive : "#94A3B8";
  return (
    <div className="grid grid-cols-[60px_1fr_auto] items-center gap-3 rounded-xl border border-border bg-card/50 px-3 py-2.5 hover:border-primary/40 transition-colors group">
      <div
        className={
          "h-10 w-14 rounded-lg flex items-center justify-center text-[10px] font-bold uppercase tracking-widest border " +
          tones[tone]
        }
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-foreground truncate">
          {label}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${progress}%`, backgroundColor: barColor }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
            {progressLabel}
          </span>
        </div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
    </div>
  );
}

function ForecastRow({
  tone,
  label,
  count,
  pct,
  note,
}: {
  tone: "good" | "warn" | "alert";
  label: string;
  count: number;
  pct: number;
  note: string;
}) {
  const config = {
    good: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      bar: C.primary,
    },
    warn: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      bar: "#F59E0B",
    },
    alert: {
      bg: "bg-rose-50",
      border: "border-rose-200",
      text: "text-rose-700",
      bar: "#EF4444",
    },
  }[tone];
  return (
    <div className={`rounded-xl p-3 border ${config.bg} ${config.border}`}>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <p className={"text-[11px] font-bold uppercase tracking-widest " + config.text}>
          {label}
        </p>
        <span className={"text-[22px] font-bold tabular-nums leading-none " + config.text}>
          {count}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: config.bar }}
        />
      </div>
      <p className={"mt-1.5 text-[10px] " + config.text + " opacity-90"}>{note}</p>
    </div>
  );
}

function ChannelTable({
  rows,
}: {
  rows: Array<{ name: string; leads: number; cpl: number; conv: string }>;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="text-[9px] tracking-widest uppercase text-muted-foreground">
        <tr className="border-b border-border">
          <th className="text-left font-semibold pb-2">Channel</th>
          <th className="text-right font-semibold pb-2">Leads</th>
          <th className="text-right font-semibold pb-2">CPL</th>
          <th className="text-right font-semibold pb-2">Conv</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((r) => (
          <tr key={r.name} className="hover:bg-muted/30">
            <td className="py-2 text-[11px] text-foreground truncate max-w-[140px]">
              {r.name}
            </td>
            <td className="py-2 text-right tabular-nums text-[11px] font-semibold">
              {r.leads}
            </td>
            <td className="py-2 text-right tabular-nums text-[11px] text-muted-foreground">
              ${r.cpl.toFixed(2)}
            </td>
            <td className="py-2 text-right tabular-nums text-[11px] text-emerald-700 font-bold">
              {r.conv}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PieWithCenter({
  data,
  centerTop,
  centerBottom,
  size = 180,
  inner = 60,
  outer = 84,
  hideTooltip = false,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  centerTop: string;
  centerBottom: string;
  size?: number;
  inner?: number;
  outer?: number;
  hideTooltip?: boolean;
}) {
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          {!hideTooltip ? <Tooltip {...chartTooltipProps()} /> : null}
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={inner}
            outerRadius={outer}
            stroke="white"
            strokeWidth={3}
            paddingAngle={1.5}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          {centerTop}
        </span>
        <span className="text-[22px] font-bold tabular-nums leading-none text-foreground mt-1">
          {centerBottom}
        </span>
      </div>
    </div>
  );
}

function KvLine({ k, v, tone }: { k: string; v: string; tone: string }) {
  return (
    <li className="flex items-center justify-between gap-2 min-w-0">
      <span className="flex items-center gap-1.5 min-w-0">
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: tone }}
        />
        <span className="truncate text-foreground">{k}</span>
      </span>
      <span className="tabular-nums font-semibold text-foreground shrink-0">
        {v}
      </span>
    </li>
  );
}

function RatingBars() {
  const rows = [
    { stars: 5, count: 184, color: C.primary },
    { stars: 4, count: 56, color: C.primaryMid },
    { stars: 3, count: 18, color: C.primaryLight },
    { stars: 2, count: 7, color: C.primaryFaint },
    { stars: 1, count: 4, color: C.muted },
  ];
  const total = rows.reduce((s, r) => s + r.count, 0);
  const max = rows[0].count;
  return (
    <div className="space-y-1">
      {rows.map((r) => {
        const w = Math.max(4, (r.count / max) * 100);
        const pct = Math.round((r.count / total) * 100);
        return (
          <div
            key={r.stars}
            className="grid grid-cols-[24px_1fr_30px] items-center gap-2 text-[11px]"
          >
            <span className="text-foreground font-medium tabular-nums">
              {r.stars}★
            </span>
            <span className="relative h-2 rounded-full bg-muted/60 overflow-hidden">
              <span
                className="absolute left-0 top-0 h-full rounded-full"
                style={{ width: `${w}%`, backgroundColor: r.color }}
              />
            </span>
            <span className="text-right tabular-nums text-muted-foreground">
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ===========================================================================
// TRAFFIC
// ===========================================================================

const TRAFFIC_DAILY = DAYS_28.map((day, i) => {
  const base = 18 + i * 1.6;
  const noise = [0, 4, -2, 5, -1, 7, -3, 4, 1, 6, -2, 4, 3, 8][i % 14];
  const sessions = Math.max(8, Math.round(base + noise));
  const clicks = Math.round(sessions * (0.42 + (i % 4) * 0.03));
  const impressions = Math.round(clicks * (28 + (i % 5) * 3));
  return { day, sessions, clicks, impressions };
});

export function TelegraphTrafficDemo() {
  const queries = [
    { q: "telegraph commons berkeley", clicks: 318, impr: 2840, pos: 1.4, change: 0.2 },
    { q: "telegraph commons apartments", clicks: 244, impr: 1680, pos: 1.8, change: -0.3 },
    { q: "uc berkeley student housing", clicks: 198, impr: 14_200, pos: 4.6, change: 1.2 },
    { q: "telegraph commons reviews", clicks: 142, impr: 920, pos: 2.1, change: 0.0 },
    { q: "luxury student housing berkeley", clicks: 109, impr: 6800, pos: 5.2, change: -0.8 },
    { q: "channing way apartments", clicks: 86, impr: 3110, pos: 6.1, change: 0.6 },
    { q: "berkeley apartments fall 2026", clicks: 64, impr: 8420, pos: 7.4, change: -1.3 },
    { q: "telegraph commons floor plans", clicks: 51, impr: 410, pos: 1.6, change: 0.1 },
  ];

  const pages = [
    { url: "/p/telegraph-commons", sessions: 412, bounce: 21 },
    { url: "/p/telegraph-commons/floor-plans", sessions: 198, bounce: 18 },
    { url: "/p/telegraph-commons/amenities", sessions: 132, bounce: 32 },
    { url: "/p/telegraph-commons/tour", sessions: 89, bounce: 12 },
    { url: "/p/telegraph-commons/availability", sessions: 71, bounce: 28 },
  ];

  return (
    <div className="space-y-3 ls-page-fade">
      <HeroBlock
        label="Organic search visibility"
        value="48,234"
        hint="Total impressions across 127 queries · 28-day window"
        rightActions={
          <>
            <PillButton icon={<Calendar className="h-3 w-3" />}>Last 28 days</PillButton>
            <LivePill />
          </>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <IconKpi
          label="Sessions (28d)"
          value="767"
          delta={{ value: "+22%", trend: "up" }}
          hint="vs 629 prior"
          icon={<Globe className="h-4 w-4" strokeWidth={2.25} />}
          spark={TRAFFIC_DAILY.map((d) => d.sessions)}
        />
        <IconKpi
          label="Clicks"
          value="1,212"
          delta={{ value: "+18%", trend: "up" }}
          hint="From GSC matches"
          icon={<MousePointerClick className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="violet"
          spark={TRAFFIC_DAILY.map((d) => d.clicks)}
          sparkColor={C.violet}
        />
        <IconKpi
          label="Avg position"
          value="3.4"
          delta={{ value: "+0.6", trend: "up" }}
          hint="Lower = better"
          icon={<Target className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="emerald"
          spark={[5.2, 5.0, 4.8, 4.6, 4.5, 4.3, 4.1, 4.0, 3.9, 3.8, 3.7, 3.6, 3.5, 3.4]}
          sparkColor={C.positive}
        />
        <IconKpi
          label="CTR"
          value="8.6%"
          delta={{ value: "+1.2pts", trend: "up" }}
          hint="vs industry 4.2%"
          icon={<Zap className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="indigo"
          spark={[6.8, 6.9, 7.1, 7.4, 7.6, 7.8, 7.9, 8.0, 8.1, 8.3, 8.4, 8.5, 8.5, 8.6]}
          sparkColor={C.indigo}
        />
      </section>

      <Card>
        <CardHead
          eyebrow="GSC + GA4 · last 28 days"
          title="Search performance"
          description="Clicks (left) and impressions (right). Both trending up as the Fall 2026 search wave begins."
          right={
            <div className="flex items-center gap-2">
              <PillButton>Filter</PillButton>
              <LivePill />
            </div>
          }
        />
        <div className="px-2 pb-3">
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <ComposedChart
                data={TRAFFIC_DAILY}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="t-clicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: C.muted }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 10, fill: C.muted }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: C.muted }}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <Tooltip {...chartTooltipProps()} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="clicks"
                  name="Clicks"
                  stroke={C.primary}
                  strokeWidth={2.5}
                  fill="url(#t-clicks)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="impressions"
                  name="Impressions"
                  stroke={C.violet}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <section className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3">
        <Card>
          <CardHead
            eyebrow="Top performers"
            title="Top queries"
            description="Top 8 search queries this property ranks for"
            right={<MoreHorizontal className="h-4 w-4 text-muted-foreground" />}
          />
          <div className="px-4 pb-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[9px] tracking-widest uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left font-semibold pb-2">Query</th>
                  <th className="text-right font-semibold pb-2">Clicks</th>
                  <th className="text-right font-semibold pb-2">CTR</th>
                  <th className="text-right font-semibold pb-2">Impr.</th>
                  <th className="text-right font-semibold pb-2">Pos</th>
                  <th className="text-right font-semibold pb-2">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queries.map((q) => {
                  const ctr = ((q.clicks / q.impr) * 100).toFixed(1);
                  return (
                    <tr key={q.q} className="hover:bg-muted/30">
                      <td className="py-2 text-[11px] truncate max-w-[260px] text-foreground font-medium">
                        {q.q}
                      </td>
                      <td className="py-2 text-right tabular-nums text-[11px] font-bold text-foreground">
                        {q.clicks}
                      </td>
                      <td className="py-2 text-right tabular-nums text-[11px] text-muted-foreground">
                        {ctr}%
                      </td>
                      <td className="py-2 text-right tabular-nums text-[11px] text-muted-foreground">
                        {q.impr.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums text-[11px]">
                        {q.pos.toFixed(1)}
                      </td>
                      <td className="py-2 text-right text-[11px] tabular-nums">
                        {q.change > 0 ? (
                          <DeltaPill value={`+${q.change.toFixed(1)}`} trend="up" size="xs" />
                        ) : q.change < 0 ? (
                          <DeltaPill value={q.change.toFixed(1)} trend="down" size="xs" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHead
            eyebrow="Top landing pages"
            title="Pages by sessions"
            description="GA4 sessions filtered by property slug"
          />
          <div className="px-4 pb-3 space-y-2.5">
            {pages.map((p) => {
              const max = pages[0].sessions;
              const w = Math.round((p.sessions / max) * 100);
              return (
                <div key={p.url} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-[11px]">
                    <span className="truncate text-foreground font-medium">
                      {p.url}
                    </span>
                    <span className="shrink-0 tabular-nums text-foreground font-bold">
                      {p.sessions}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    Bounce {p.bounce}% · 142s avg
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </section>
    </div>
  );
}

// ===========================================================================
// LEADS
// ===========================================================================

export function TelegraphLeadsDemo() {
  const sources = [
    { name: "Google Ads", value: 84, color: C.primary },
    { name: "Meta Ads", value: 59, color: C.primaryMid },
    { name: "Organic", value: 47, color: C.primaryLight },
    { name: "Chatbot", value: 31, color: C.primaryFaint },
    { name: "Referral", value: 18, color: C.violet },
    { name: "Direct", value: 8, color: "#CBD5E1" },
  ];

  const recent = [
    { name: "Jordan Pham", source: "Google Ads", email: "jordan.p@berkeley.edu", when: "12m", score: 94, status: "Tour booked" },
    { name: "Maya Rodriguez", source: "Chatbot", email: "maya.rod@gmail.com", when: "1h", score: 87, status: "Qualified" },
    { name: "Ethan Wong", source: "Organic", email: "ewong@berkeley.edu", when: "3h", score: 81, status: "Replied" },
    { name: "Priya Patel", source: "Meta Ads", email: "priya.patel@gmail.com", when: "5h", score: 78, status: "New" },
    { name: "Carlos Mendez", source: "Referral", email: "carlos.m@berkeley.edu", when: "1d", score: 92, status: "Application" },
    { name: "Sarah Kim", source: "Google Ads", email: "skim@berkeley.edu", when: "1d", score: 75, status: "Replied" },
    { name: "Hannah Li", source: "Organic", email: "hli@berkeley.edu", when: "2d", score: 88, status: "Tour booked" },
  ];

  return (
    <div className="space-y-3 ls-page-fade">
      <HeroBlock
        label="Leads in the pipeline · last 28 days"
        value="247"
        hint="89 tours · 41 applications · 14 signed leases · 16.6% lead → application"
        rightActions={
          <>
            <PillButton icon={<Calendar className="h-3 w-3" />}>Last 28 days</PillButton>
            <PillButton icon={<Users className="h-3 w-3" />}>All leads →</PillButton>
          </>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <IconKpi
          label="Leads (28d)"
          value="247"
          delta={{ value: "+34%", trend: "up" }}
          hint="vs 184 prior"
          icon={<Target className="h-4 w-4" strokeWidth={2.25} />}
          spark={LEAD_SPARK}
        />
        <IconKpi
          label="Tours"
          value="89"
          delta={{ value: "+22%", trend: "up" }}
          hint="36% lead → tour"
          icon={<Calendar className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="violet"
          spark={TOUR_SPARK}
          sparkColor={C.violet}
        />
        <IconKpi
          label="Applications"
          value="41"
          delta={{ value: "+41%", trend: "up" }}
          hint="46% tour → app"
          icon={<CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="emerald"
          spark={APP_SPARK}
          sparkColor={C.positive}
        />
        <IconKpi
          label="Avg lead score"
          value="82"
          delta={{ value: "+6", trend: "up" }}
          hint="Out of 100"
          icon={<Star className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="indigo"
          spark={[72, 74, 75, 73, 76, 78, 77, 79, 80, 79, 81, 80, 82, 82]}
          sparkColor={C.indigo}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
        <Card>
          <CardHead
            eyebrow="Last 28 days"
            title="Lead → tour → application"
            description="Daily volume across the funnel"
            right={
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                <LegendDot color={C.primary} label="Leads" />
                <LegendDot color={C.violet} label="Tours" />
                <LegendDot color={C.positive} label="Apps" />
              </div>
            }
          />
          <div className="px-2 pb-3">
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart
                  data={FUNNEL_DAILY}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                  barCategoryGap={2}
                >
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: C.muted }}
                    tickLine={false}
                    axisLine={false}
                    interval={6}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: C.muted }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <Tooltip {...chartTooltipProps()} />
                  <Bar dataKey="leads" name="Leads" fill={C.primary} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="tours" name="Tours" fill={C.violet} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="apps" name="Apps" fill={C.positive} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead eyebrow="Conversion funnel" title="Drop-off by stage" />
          <div className="px-4 pb-4">
            <RealFunnel
              stages={[
                { label: "Site visitors", value: 4_812 },
                { label: "Leads", value: 247 },
                { label: "Tours", value: 89 },
                { label: "Applications", value: 41 },
                { label: "Signed", value: 14 },
              ]}
            />
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-3">
        <Card>
          <CardHead eyebrow="By source · 28d" title="Where leads come from" />
          <div className="px-4 pb-4">
            <PieWithCenter
              data={sources}
              centerTop="Top source"
              centerBottom="34%"
              size={170}
              inner={56}
              outer={78}
            />
            <ul className="mt-3 space-y-1.5">
              {sources.map((s) => {
                const total = sources.reduce((a, b) => a + b.value, 0);
                const pct = Math.round((s.value / total) * 100);
                return (
                  <li
                    key={s.name}
                    className="grid grid-cols-[10px_1fr_auto_36px] items-center gap-2 text-[11px]"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="truncate text-foreground">{s.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.value}
                    </span>
                    <span className="text-right tabular-nums text-foreground font-bold">
                      {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>

        <Card>
          <CardHead
            eyebrow="Latest 7"
            title="Recent leads"
            right={
              <a
                href="/portal/leads"
                className="text-[11px] font-bold text-primary hover:underline"
              >
                All leads →
              </a>
            }
          />
          <div className="px-2 pb-3">
            <table className="w-full">
              <thead className="text-[9px] tracking-widest uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left font-semibold pb-2 pl-2">Lead</th>
                  <th className="text-left font-semibold pb-2">Source</th>
                  <th className="text-left font-semibold pb-2">Status</th>
                  <th className="text-right font-semibold pb-2">Score</th>
                  <th className="text-right font-semibold pb-2 pr-2">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.map((l) => (
                  <tr key={l.email} className="hover:bg-muted/30">
                    <td className="py-2 pl-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-primary bg-primary/10 shrink-0">
                          {l.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-foreground truncate">
                            {l.name}
                          </p>
                          <p className="text-[9px] text-muted-foreground truncate">
                            {l.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 text-[10px] text-muted-foreground">
                      {l.source}
                    </td>
                    <td className="py-2">
                      <StatusPill status={l.status} />
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={
                          "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums " +
                          (l.score >= 85
                            ? "bg-emerald-50 text-emerald-700"
                            : l.score >= 70
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600")
                        }
                      >
                        {l.score}
                      </span>
                    </td>
                    <td className="py-2 text-right text-[10px] text-muted-foreground tabular-nums pr-2">
                      {l.when}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    "Tour booked": { bg: "bg-blue-50", text: "text-blue-700" },
    "Application": { bg: "bg-violet-50", text: "text-violet-700" },
    "Qualified": { bg: "bg-emerald-50", text: "text-emerald-700" },
    "Replied": { bg: "bg-amber-50", text: "text-amber-700" },
    "New": { bg: "bg-slate-100", text: "text-slate-700" },
  };
  const c = config[status] ?? config["New"];
  return (
    <span className={"inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-md " + c.bg + " " + c.text}>
      {status}
    </span>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// Conversion funnel — each row shows the stage's count plus a bar that
// represents the conversion rate FROM the previous stage. Visiting → Lead is
// 5%, Lead → Tour is 36%, etc. This avoids the unreadable "tiny bars" problem
// that comes from sizing each stage relative to the first one when there's
// a 100x drop-off between stages.
function RealFunnel({
  stages,
}: {
  stages: Array<{ label: string; value: number }>;
}) {
  const colors = [
    C.primaryFaint,
    C.primaryLight,
    C.primaryMid,
    C.primary,
    "#1E40AF",
  ];
  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => {
        const fromPrev =
          i === 0 ? null : (s.value / stages[i - 1].value) * 100;
        const barWidth = i === 0 ? 100 : Math.max(6, fromPrev ?? 0);
        return (
          <div key={s.label}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-[11px] font-semibold text-foreground">
                {s.label}
              </span>
              <span className="text-[11px] tabular-nums">
                <span className="text-foreground font-bold">
                  {s.value.toLocaleString()}
                </span>
                {fromPrev != null ? (
                  <span className="ml-1.5 text-emerald-700 font-semibold">
                    {fromPrev.toFixed(0)}% conv
                  </span>
                ) : null}
              </span>
            </div>
            <div className="relative h-6 bg-slate-100 rounded-md overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full rounded-md transition-all"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: colors[i],
                }}
              />
              {i > 0 ? (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-white/95 mix-blend-luminosity">
                  from {stages[i - 1].label.toLowerCase()}
                </span>
              ) : (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-white/95">
                  total this period
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===========================================================================
// ADS
// ===========================================================================

const AD_DAILY = DAYS_28.map((day, i) => {
  const baseSpend = 100 + i * 4;
  const spend = Math.round(baseSpend + [0, 12, -8, 20, -4, 16, -12, 8, 4, 22, -6, 14, 10, 28][i % 14]);
  const leads = Math.max(1, Math.round(spend / (28 - i * 0.4)));
  return { day, spend, leads };
});

export function TelegraphAdsDemo() {
  const campaigns = [
    { name: "TC – Brand Search · Q2", platform: "Google", status: "ACTIVE", spend: 1_280, leads: 84, tours: 38, cpl: 15.24 },
    { name: "TC – Berkeley Student Housing", platform: "Google", status: "ACTIVE", spend: 940, leads: 36, tours: 14, cpl: 26.11 },
    { name: "TC – Meta · Fall 2026", platform: "Meta", status: "ACTIVE", spend: 820, leads: 41, tours: 18, cpl: 20.0 },
    { name: "TC – Meta Retargeting", platform: "Meta", status: "ACTIVE", spend: 480, leads: 18, tours: 9, cpl: 26.67 },
    { name: "TC – Display · Cal alumni", platform: "Google", status: "PAUSED", spend: 380, leads: 8, tours: 1, cpl: 47.5 },
    { name: "TC – TikTok · Move-in 2026", platform: "TikTok", status: "ACTIVE", spend: 280, leads: 14, tours: 6, cpl: 20.0 },
  ];

  return (
    <div className="space-y-3 ls-page-fade">
      <HeroBlock
        label="Total ad spend · last 28 days"
        value="$4,180"
        hint="201 leads acquired · $20.80 avg CPL · 3.4x ROAS · best 28-day window in 6 months"
        rightActions={
          <>
            <PillButton icon={<Calendar className="h-3 w-3" />}>Last 28 days</PillButton>
            <PillButton icon={<Megaphone className="h-3 w-3" />}>6 active</PillButton>
          </>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <IconKpi
          label="Spend (28d)"
          value="$4,180"
          delta={{ value: "-12%", trend: "up" }}
          hint="Cheaper, not less"
          icon={<DollarSign className="h-4 w-4" strokeWidth={2.25} />}
          spark={AD_DAILY.map((d) => d.spend)}
        />
        <IconKpi
          label="Paid leads"
          value="201"
          delta={{ value: "+24%", trend: "up" }}
          hint="From 6 campaigns"
          icon={<Target className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="violet"
          spark={AD_DAILY.map((d) => d.leads)}
          sparkColor={C.violet}
        />
        <IconKpi
          label="CPL"
          value="$20.80"
          delta={{ value: "-12%", trend: "up" }}
          hint="Best in 6 months"
          icon={<Zap className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="emerald"
          spark={[26.4, 25.8, 25.2, 24.6, 24.0, 23.5, 23.0, 22.5, 22.0, 21.6, 21.2, 21.0, 20.9, 20.8]}
          sparkColor={C.positive}
        />
        <IconKpi
          label="ROAS"
          value="3.4×"
          delta={{ value: "+0.6", trend: "up" }}
          hint="LTV: lease × 12mo"
          icon={<Star className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="indigo"
          spark={[2.6, 2.7, 2.8, 2.8, 2.9, 3.0, 3.0, 3.1, 3.2, 3.2, 3.3, 3.3, 3.4, 3.4]}
          sparkColor={C.indigo}
        />
      </section>

      <Card>
        <CardHead
          eyebrow="Last 28 days"
          title="Spend vs leads"
          description="Daily ad spend (left) plotted against leads acquired (right). Spend dropping while volume rises — campaigns are scaling."
          right={
            <div className="flex items-center gap-2">
              <PillButton>Filter</PillButton>
              <LivePill />
            </div>
          }
        />
        <div className="px-2 pb-3">
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <ComposedChart data={AD_DAILY} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="a-spend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} interval={4} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} width={36} tickFormatter={(v) => `$${v}`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} width={28} />
                <Tooltip {...chartTooltipProps()} />
                <Area yAxisId="left" type="monotone" dataKey="spend" name="Spend" stroke={C.primary} strokeWidth={2.5} fill="url(#a-spend)" />
                <Line yAxisId="right" type="monotone" dataKey="leads" name="Leads" stroke={C.violet} strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          eyebrow="Per campaign · last 28 days"
          title="Top performing campaigns"
          description="6 campaigns running · ranked by spend"
          right={<MoreHorizontal className="h-4 w-4 text-muted-foreground" />}
        />
        <div className="px-4 pb-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[9px] tracking-widest uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left font-semibold pb-2">Campaign</th>
                <th className="text-left font-semibold pb-2">Status</th>
                <th className="text-right font-semibold pb-2">Spend</th>
                <th className="text-right font-semibold pb-2">Leads</th>
                <th className="text-right font-semibold pb-2">Tours</th>
                <th className="text-right font-semibold pb-2">CPL</th>
                <th className="text-right font-semibold pb-2 pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map((c) => (
                <tr key={c.name} className="hover:bg-muted/30">
                  <td className="py-2.5 max-w-[260px]">
                    <p className="text-[12px] font-semibold text-foreground truncate">
                      {c.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{c.platform}</p>
                  </td>
                  <td className="py-2.5">
                    <span
                      className={
                        c.status === "ACTIVE"
                          ? "inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700"
                          : "inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600"
                      }
                    >
                      {c.status === "ACTIVE" ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-[11px] font-bold text-foreground">
                    ${c.spend.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-[11px]">{c.leads}</td>
                  <td className="py-2.5 text-right tabular-nums text-[11px] text-muted-foreground">
                    {c.tours}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-[11px]">
                    ${c.cpl.toFixed(2)}
                  </td>
                  <td className="py-2.5 text-right pr-2">
                    <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ===========================================================================
// CHATBOT
// ===========================================================================

const CHAT_DAILY = DAYS_28.map((day, i) => {
  const base = 12 + i * 0.6;
  const noise = [0, 4, -2, 6, -1, 3, -3, 5, 2, 7, -2, 4, 1, 8][i % 14];
  const conv = Math.max(4, Math.round(base + noise));
  const captured = Math.round(conv * (0.28 + (i % 5) * 0.02));
  return { day, conversations: conv, captured };
});

export function TelegraphChatbotDemo() {
  const topics = [
    { term: "Fall 2026 availability", count: 142 },
    { term: "Pricing & deposits", count: 118 },
    { term: "Parking", count: 96 },
    { term: "Pet policy", count: 84 },
    { term: "Tour scheduling", count: 76 },
    { term: "Amenities", count: 64 },
    { term: "Lease length", count: 51 },
    { term: "Utilities", count: 42 },
  ];

  const recent = [
    { name: "Jordan Pham", msgs: 14, status: "Captured", when: "12m" },
    { name: "Anonymous", msgs: 6, status: "Browsing", when: "32m" },
    { name: "Maya Rodriguez", msgs: 18, status: "Tour booked", when: "1h" },
    { name: "Anonymous", msgs: 4, status: "Bounced", when: "2h" },
    { name: "Ethan Wong", msgs: 11, status: "Captured", when: "3h" },
    { name: "Priya Patel", msgs: 22, status: "Tour booked", when: "5h" },
  ];

  return (
    <div className="space-y-3 ls-page-fade">
      <HeroBlock
        label="Chatbot conversations · last 28 days"
        value="438"
        hint="139 captured leads · 46 tours booked · 1.2s avg response time · 32% capture rate"
        rightActions={
          <>
            <PillButton icon={<Calendar className="h-3 w-3" />}>Last 28 days</PillButton>
            <LivePill />
          </>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <IconKpi
          label="Conversations"
          value="438"
          delta={{ value: "+18%", trend: "up" }}
          hint="vs 371 prior"
          icon={<MessageSquare className="h-4 w-4" strokeWidth={2.25} />}
          spark={CHAT_DAILY.map((d) => d.conversations)}
        />
        <IconKpi
          label="Captured leads"
          value="139"
          delta={{ value: "+24%", trend: "up" }}
          hint="32% capture rate"
          icon={<Target className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="emerald"
          spark={CHAT_DAILY.map((d) => d.captured)}
          sparkColor={C.positive}
        />
        <IconKpi
          label="Tours booked"
          value="46"
          delta={{ value: "+31%", trend: "up" }}
          hint="11% of conversations"
          icon={<Calendar className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="violet"
          spark={[1, 2, 1, 2, 2, 3, 2, 3, 3, 4, 3, 4, 4, 5]}
          sparkColor={C.violet}
        />
        <IconKpi
          label="Avg response"
          value="1.2s"
          delta={{ value: "-18%", trend: "up" }}
          hint="vs 2.1s industry"
          icon={<Zap className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="indigo"
          spark={[1.8, 1.7, 1.6, 1.5, 1.5, 1.4, 1.4, 1.3, 1.3, 1.2, 1.2, 1.2, 1.2, 1.2]}
          sparkColor={C.indigo}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
        <Card>
          <CardHead
            eyebrow="Last 28 days"
            title="Conversations & captures"
            description="Daily chatbot volume · capture rate trending up as the AI improves"
            right={
              <div className="flex items-center gap-2">
                <PillButton>Filter</PillButton>
                <LivePill />
              </div>
            }
          />
          <div className="px-2 pb-3">
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <AreaChart data={CHAT_DAILY} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="c-conv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.primary} stopOpacity={0.32} />
                      <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="c-cap" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.positive} stopOpacity={0.32} />
                      <stop offset="100%" stopColor={C.positive} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip {...chartTooltipProps()} />
                  <Area type="monotone" dataKey="conversations" name="Conversations" stroke={C.primary} strokeWidth={2.5} fill="url(#c-conv)" />
                  <Area type="monotone" dataKey="captured" name="Captured" stroke={C.positive} strokeWidth={2.5} fill="url(#c-cap)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead eyebrow="Outcome funnel" title="From visit to tour" />
          <div className="px-4 pb-4">
            <RealFunnel
              stages={[
                { label: "Conversations", value: 438 },
                { label: "Engaged (>3 msgs)", value: 254 },
                { label: "Captured email", value: 139 },
                { label: "Booked tour", value: 46 },
              ]}
            />
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
        <Card>
          <CardHead
            eyebrow="Top intents"
            title="What residents are asking"
            description="After stopword filter · 28 days"
          />
          <div className="px-2 pb-3">
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart
                  data={topics}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="term"
                    tick={{ fontSize: 11, fill: C.ink, fontWeight: 500 }}
                    tickLine={false}
                    axisLine={false}
                    width={150}
                  />
                  <Tooltip {...chartTooltipProps()} />
                  <Bar dataKey="count" fill={C.primary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead
            eyebrow="Latest 6"
            title="Recent transcripts"
            right={
              <a href="/portal/conversations" className="text-[11px] font-bold text-primary hover:underline">
                All →
              </a>
            }
          />
          <div className="px-4 pb-3">
            <ul className="divide-y divide-border">
              {recent.map((c, i) => (
                <li key={i} className="py-2.5 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="h-8 w-8 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
                      <MessageSquare className="h-3.5 w-3.5 text-primary" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">
                        {c.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{c.msgs} messages</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill status={c.status === "Captured" ? "Replied" : c.status === "Tour booked" ? "Tour booked" : c.status === "Bounced" ? "New" : "New"} />
                    <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">
                      {c.when}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </section>
    </div>
  );
}

// ===========================================================================
// REPUTATION
// ===========================================================================

const REPUTATION_TREND = [
  { m: "Jun", rating: 4.4 },
  { m: "Jul", rating: 4.4 },
  { m: "Aug", rating: 4.5 },
  { m: "Sep", rating: 4.5 },
  { m: "Oct", rating: 4.5 },
  { m: "Nov", rating: 4.6 },
  { m: "Dec", rating: 4.6 },
  { m: "Jan", rating: 4.6 },
  { m: "Feb", rating: 4.7 },
  { m: "Mar", rating: 4.7 },
  { m: "Apr", rating: 4.7 },
  { m: "May", rating: 4.7 },
];

export function TelegraphReputationDemo() {
  const sources = [
    { src: "Google", count: 142, rating: 4.8, Logo: GoogleLogo },
    { src: "Yelp", count: 64, rating: 4.5, Logo: YelpLogo },
    { src: "ApartmentRatings", count: 38, rating: 4.6, Logo: ApartmentLogo },
    { src: "Reddit", count: 18, rating: 4.2, Logo: RedditLogo },
    { src: "Niche", count: 7, rating: 4.7, Logo: NicheLogo },
  ];

  const recent = [
    { author: "Jordan P.", source: "Google", rating: 5, when: "3 days ago", excerpt: "Honestly the cleanest building near campus. Maintenance is on it within hours and the lounge is dead quiet during finals — exactly what I needed." },
    { author: "Maya R.", source: "Yelp", rating: 5, when: "5 days ago", excerpt: "Move-in was effortless, leasing team actually answered the phone, and the gym beats anything on Channing." },
    { author: "Ethan W.", source: "Google", rating: 4, when: "1 week ago", excerpt: "Great location and the rooftop is the move. Knock a star off because the package room got backed up around finals — fixed now per management." },
  ];

  const tags = [
    { t: "Maintenance", n: 84, pos: true },
    { t: "Quiet study spaces", n: 62, pos: true },
    { t: "Gym", n: 51, pos: true },
    { t: "Rooftop", n: 47, pos: true },
    { t: "Location", n: 142, pos: true },
    { t: "Pricing", n: 38, pos: false },
    { t: "Package room", n: 14, pos: false },
    { t: "Wi-Fi", n: 9, pos: false },
  ];

  return (
    <div className="space-y-3 ls-page-fade">
      <HeroBlock
        label="Overall rating · across 5 sources"
        value="4.7 ★"
        hint="269 lifetime reviews · +34 in last 28 days · 92% positive sentiment · 96% response rate"
        rightActions={
          <>
            <PillButton icon={<Calendar className="h-3 w-3" />}>Last 12 months</PillButton>
            <LivePill />
          </>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <IconKpi
          label="Overall rating"
          value="4.7"
          delta={{ value: "+0.2", trend: "up" }}
          hint="269 reviews lifetime"
          icon={<Star className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="indigo"
          spark={REPUTATION_TREND.map((r) => r.rating)}
          sparkColor={C.indigo}
        />
        <IconKpi
          label="New (28d)"
          value="34"
          delta={{ value: "+38%", trend: "up" }}
          hint="22 5★ · 8 4★ · 4 ≤3★"
          icon={<MessageSquare className="h-4 w-4" strokeWidth={2.25} />}
          spark={[18, 21, 19, 24, 22, 26, 25, 28, 27, 30, 29, 32, 31, 34]}
        />
        <IconKpi
          label="Response rate"
          value="96%"
          delta={{ value: "+4pts", trend: "up" }}
          hint="Avg 4.2 hrs to first reply"
          icon={<Zap className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="emerald"
          spark={[88, 89, 90, 90, 91, 92, 93, 93, 94, 94, 95, 95, 96, 96]}
          sparkColor={C.positive}
        />
        <IconKpi
          label="Sentiment"
          value="92%"
          delta={{ value: "+2pts", trend: "up" }}
          hint="Positive · all sources"
          icon={<CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="violet"
          spark={[85, 86, 87, 87, 88, 89, 89, 90, 90, 91, 91, 91, 92, 92]}
          sparkColor={C.violet}
        />
      </section>

      <Card>
        <CardHead
          eyebrow="Last 12 months"
          title="Star rating trend"
          description="Avg star rating month-over-month — trending up since Q3"
          right={
            <div className="flex items-center gap-2">
              <PillButton>Filter</PillButton>
              <LivePill />
            </div>
          }
        />
        <div className="px-2 pb-3">
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <AreaChart data={REPUTATION_TREND} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="r-rating" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} />
                <YAxis domain={[4.0, 5.0]} tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} width={32} />
                <Tooltip {...chartTooltipProps()} formatter={(v: number) => `${Number(v).toFixed(2)}★`} />
                <ReferenceLine y={4.5} stroke={C.muted} strokeDasharray="3 3" label={{ value: "4.5 target", position: "right", fontSize: 10, fill: C.muted }} />
                <Area type="monotone" dataKey="rating" name="Avg rating" stroke={C.primary} strokeWidth={2.5} fill="url(#r-rating)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card>
          <CardHead eyebrow="By source" title="Where reviews land" />
          <div className="px-4 pb-4 space-y-2">
            {sources.map((s) => {
              const Logo = s.Logo;
              return (
                <div
                  key={s.src}
                  className="flex items-center gap-3 rounded-xl border border-border p-2.5 hover:border-primary/40 hover:bg-blue-50/40 transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-white border border-border shrink-0">
                    <Logo className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className="font-semibold text-foreground truncate">
                        {s.src}
                      </span>
                      <span className="tabular-nums text-foreground font-bold">
                        {s.rating.toFixed(1)}★
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                      <span>{s.count} reviews</span>
                      <span>{Math.round((s.count / 269) * 100)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHead eyebrow="All-time" title="Rating breakdown" />
          <div className="px-4 pb-4">
            <RatingBars />
          </div>
        </Card>

        <Card>
          <CardHead eyebrow="Topic mining" title="What residents say" />
          <div className="px-4 pb-4 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag.t}
                className={
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                  (tag.pos
                    ? "bg-blue-50 text-blue-700"
                    : "bg-amber-50 text-amber-700")
                }
              >
                {tag.t}
                <span className="tabular-nums opacity-70">{tag.n}</span>
              </span>
            ))}
          </div>
        </Card>
      </section>

      <Card>
        <CardHead eyebrow="Latest reviews" title="Recent mentions" description="Across all 5 sources" />
        <div className="px-4 pb-4 space-y-2">
          {recent.map((r, i) => (
            <div key={i} className="rounded-xl border border-border bg-card/50 p-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-foreground">{r.author}</span>
                  <span className="text-[10px] text-muted-foreground">· {r.source}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star
                        key={j}
                        className={
                          "h-3 w-3 " +
                          (j < r.rating ? "fill-amber-400 text-amber-400" : "text-muted")
                        }
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{r.when}</span>
                </div>
              </div>
              <p className="text-[12px] text-foreground leading-relaxed">{r.excerpt}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ===========================================================================
// OCCUPANCY
// ===========================================================================

const OCCUPANCY_HISTORY = Array.from({ length: 52 }, (_, i) => {
  const base = 88 + Math.min(12, i * 0.32);
  const noise = [-1, 0, 1, 0, -1, 1, 0][i % 7];
  return {
    w: `W${i + 1}`,
    occupancy: Math.max(85, Math.min(100, Math.round(base + noise))),
    market: 92 + ((i * 2) % 5) - 1,
  };
});

export function TelegraphOccupancyDemo() {
  const beds = [
    { label: "Studio", total: 18, applications: 4, priceMin: 3950, priceMax: 4380 },
    { label: "1 bed", total: 32, applications: 7, priceMin: 4280, priceMax: 4720 },
    { label: "2 bed", total: 36, applications: 9, priceMin: 4680, priceMax: 5240 },
    { label: "3 bed", total: 14, applications: 3, priceMin: 5380, priceMax: 5890 },
  ];

  return (
    <div className="space-y-3 ls-page-fade">
      <HeroBlock
        label="Live occupancy · Telegraph Commons"
        value="100%"
        hint="100 of 100 leased · 14 weeks at full · 72 on notice · 23 apps queued for Fall 2026"
        rightActions={
          <>
            <PillButton icon={<Building2 className="h-3 w-3" />}>AppFolio synced</PillButton>
            <LivePill />
          </>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <IconKpi
          label="Occupancy"
          value="100%"
          delta={{ value: "+2pts", trend: "up" }}
          hint="100 of 100"
          icon={<Building2 className="h-4 w-4" strokeWidth={2.25} />}
          spark={OCCUPANCY_HISTORY.slice(-14).map((h) => h.occupancy)}
        />
        <IconKpi
          label="On notice"
          value="72"
          hint="Predictive availability"
          icon={<Calendar className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="indigo"
          spark={[58, 60, 62, 65, 64, 66, 68, 67, 69, 70, 71, 71, 72, 72]}
          sparkColor={C.indigo}
        />
        <IconKpi
          label="Apps queued"
          value="23"
          delta={{ value: "+8", trend: "up" }}
          hint="Fall 2026 waitlist"
          icon={<Users className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="violet"
          spark={[8, 10, 12, 14, 13, 15, 17, 18, 19, 20, 21, 22, 22, 23]}
          sparkColor={C.violet}
        />
        <IconKpi
          label="Pre-leased Fall '26"
          value="68%"
          delta={{ value: "+9pts", trend: "up" }}
          hint="vs prior year"
          icon={<Target className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="emerald"
          spark={[42, 46, 49, 52, 55, 58, 60, 62, 64, 65, 66, 67, 68, 68]}
          sparkColor={C.positive}
        />
      </section>

      <Card>
        <CardHead
          eyebrow="52 weeks"
          title="Occupancy vs market benchmark"
          description="Telegraph (blue) outpaced the Berkeley student-housing benchmark for 47 of the last 52 weeks"
          right={
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              <LegendDot color={C.primary} label="Telegraph" />
              <LegendDot color={C.muted} label="Market" />
            </div>
          }
        />
        <div className="px-2 pb-3">
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={OCCUPANCY_HISTORY} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="o-tc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="w" tick={{ fontSize: 9, fill: C.muted }} tickLine={false} axisLine={false} interval={7} />
                <YAxis domain={[80, 100]} tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} width={32} tickFormatter={(v) => `${v}%`} />
                <Tooltip {...chartTooltipProps()} formatter={(v: number) => `${v}%`} />
                <Area type="monotone" dataKey="occupancy" name="Telegraph" stroke={C.primary} strokeWidth={2.5} fill="url(#o-tc)" />
                <Line type="monotone" dataKey="market" name="Market" stroke={C.muted} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          eyebrow="Unit configuration"
          title="Listings by bedroom"
          description="100% leased across all bed types · waitlist building for Fall 2026"
        />
        <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {beds.map((b) => (
            <div
              key={b.label}
              className="rounded-xl border border-border bg-card p-3 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                  {b.label}
                </p>
                <p className="text-[20px] leading-none font-bold tabular-nums text-foreground">
                  {b.total}
                </p>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
                  style={{ width: "100%" }}
                />
              </div>
              <div className="mt-2 flex items-baseline justify-between text-[10px]">
                <span className="text-emerald-700 font-bold">
                  {b.applications} apps waiting
                </span>
                <span className="text-muted-foreground tabular-nums">
                  ${b.priceMin.toLocaleString()}–${b.priceMax.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ===========================================================================
// RESIDENTS
// ===========================================================================

export function TelegraphResidentsDemo() {
  const residents = [
    { name: "Alexandra Chen", email: "achen@berkeley.edu", unit: "201", status: "Active", rent: 4180, moveIn: "Aug 2024", end: "Jul 31, 2026" },
    { name: "Marcus Williams", email: "mwilliams@berkeley.edu", unit: "204", status: "Active", rent: 4520, moveIn: "Aug 2024", end: "Jul 31, 2026" },
    { name: "Sophia Patel", email: "spatel@berkeley.edu", unit: "301", status: "Notice", rent: 4280, moveIn: "Aug 2023", end: "Jun 30, 2026" },
    { name: "Daniel Rodriguez", email: "drodriguez@berkeley.edu", unit: "312", status: "Active", rent: 4980, moveIn: "Sep 2024", end: "Aug 31, 2026" },
    { name: "Emma Johnson", email: "ejohnson@berkeley.edu", unit: "318", status: "Notice", rent: 5040, moveIn: "Aug 2023", end: "Jul 15, 2026" },
    { name: "James Park", email: "jpark@berkeley.edu", unit: "404", status: "Active", rent: 4380, moveIn: "Aug 2025", end: "Jul 31, 2027" },
    { name: "Olivia Martinez", email: "omartinez@berkeley.edu", unit: "412", status: "Active", rent: 4080, moveIn: "Aug 2024", end: "Aug 31, 2026" },
    { name: "Noah Garcia", email: "ngarcia@berkeley.edu", unit: "508", status: "Notice", rent: 4480, moveIn: "Aug 2023", end: "Jun 30, 2026" },
    { name: "Isabella Brown", email: "ibrown@berkeley.edu", unit: "601", status: "Active", rent: 5890, moveIn: "Sep 2025", end: "Aug 31, 2027" },
    { name: "Lucas Lee", email: "llee@berkeley.edu", unit: "604", status: "Active", rent: 4720, moveIn: "Aug 2024", end: "Jul 31, 2026" },
  ];

  const tenure = [
    { range: "<1 yr", count: 28, color: C.primaryFaint },
    { range: "1-2 yr", count: 41, color: C.primaryLight },
    { range: "2-3 yr", count: 22, color: C.primaryMid },
    { range: "3+ yr", count: 9, color: C.primary },
  ];

  return (
    <div className="space-y-3 ls-page-fade">
      <HeroBlock
        label="Active residents · Telegraph Commons"
        value="100"
        hint="72 on notice · 100% email coverage · 1.7 yr avg tenure · only 2 past-due ($3,840 owed)"
        rightActions={
          <PillButton icon={<Building2 className="h-3 w-3" />}>AppFolio synced</PillButton>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <IconKpi
          label="Active"
          value="100"
          icon={<Users className="h-4 w-4" strokeWidth={2.25} />}
          hint="Currently in residence"
        />
        <IconKpi
          label="Notice given"
          value="72"
          icon={<Calendar className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="indigo"
          hint="Predictive availability"
        />
        <IconKpi
          label="Past-due"
          value="2"
          icon={<DollarSign className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="rose"
          hint="$3,840 owed · 0.8%"
        />
        <IconKpi
          label="Avg tenure"
          value="1.7yr"
          delta={{ value: "+0.5", trend: "up" }}
          icon={<Star className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="emerald"
          hint="vs 1.2 yr industry"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3">
        <Card>
          <CardHead
            eyebrow="72 on notice"
            title="Notice given — predictive availability"
            description="Backfill campaigns should already be live"
          />
          <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-2">
            {residents.filter((r) => r.status === "Notice").map((r) => (
              <div
                key={r.unit}
                className="rounded-xl border border-amber-200 bg-amber-50/60 p-2.5"
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-[12px] font-semibold text-foreground truncate">
                    {r.name}
                  </p>
                  <span className="text-[10px] font-bold tabular-nums text-amber-800 bg-white border border-amber-200 rounded-md px-1.5 py-0.5">
                    #{r.unit}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Out: <span className="text-foreground font-semibold">{r.end}</span>
                </p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  ${r.rent.toLocaleString()}/mo
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead eyebrow="Tenure mix" title="How long they stay" />
          <div className="px-2 pb-3">
            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer>
                <BarChart data={tenure} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip {...chartTooltipProps()} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {tenure.map((t) => (
                      <Cell key={t.range} fill={t.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </section>

      <Card>
        <CardHead
          eyebrow="Active roster"
          title="All residents"
          description="Showing 10 of 100 · synced from AppFolio"
        />
        <div className="px-4 pb-4 overflow-x-auto">
          <div className="rounded-xl border border-border bg-card overflow-hidden min-w-[760px]">
            <div className="hidden md:grid grid-cols-[minmax(180px,1.6fr)_minmax(160px,1.4fr)_80px_120px_100px_120px] gap-3 px-3 py-2 border-b border-border bg-muted/30 text-[9px] tracking-widest uppercase font-bold text-muted-foreground">
              <div>Resident</div>
              <div>Contact</div>
              <div>Unit</div>
              <div>Status</div>
              <div className="text-right">Rent</div>
              <div>Lease end</div>
            </div>
            <div className="divide-y divide-border">
              {residents.map((r) => (
                <div
                  key={r.email}
                  className="grid grid-cols-[minmax(180px,1.6fr)_minmax(160px,1.4fr)_80px_120px_100px_120px] gap-3 px-3 py-2.5 items-center hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                      {r.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate leading-tight">
                        {r.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate leading-tight">
                        Moved in {r.moveIn}
                      </p>
                    </div>
                  </div>
                  <div className="text-[11px] text-foreground truncate">{r.email}</div>
                  <div>
                    <span className="inline-block rounded-md border border-border bg-muted/40 text-foreground px-1.5 py-0.5 text-[10px] font-bold">
                      #{r.unit}
                    </span>
                  </div>
                  <div>
                    <span
                      className={
                        "inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold " +
                        (r.status === "Notice"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700")
                      }
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="text-right tabular-nums text-[12px] font-bold text-foreground">
                    ${r.rent.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">{r.end}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ===========================================================================
// RENEWALS
// ===========================================================================

const RENEWAL_TIMELINE = [
  { m: "May", signed: 4, expiring: 6, lost: 1 },
  { m: "Jun", signed: 8, expiring: 12, lost: 2 },
  { m: "Jul", signed: 12, expiring: 18, lost: 3 },
  { m: "Aug", signed: 15, expiring: 22, lost: 4 },
  { m: "Sep", signed: 9, expiring: 12, lost: 1 },
];

export function TelegraphRenewalsDemo() {
  const buckets = [
    {
      label: "0–30 days",
      count: 18,
      tone: "urgent" as const,
      items: [
        { name: "Sophia Patel", unit: "301", end: "Jun 30", rent: 4280 },
        { name: "Emma Johnson", unit: "318", end: "Jul 15", rent: 5040 },
        { name: "Noah Garcia", unit: "508", end: "Jun 30", rent: 4480 },
        { name: "Mia Hayes", unit: "212", end: "Jul 1", rent: 4380 },
      ],
    },
    {
      label: "31–60 days",
      count: 14,
      tone: "soon" as const,
      items: [
        { name: "Logan Reed", unit: "418", end: "Jul 28", rent: 4920 },
        { name: "Aria Singh", unit: "502", end: "Aug 4", rent: 5240 },
      ],
    },
    {
      label: "61–90 days",
      count: 22,
      tone: "primary" as const,
      items: [
        { name: "Alexandra Chen", unit: "201", end: "Aug 31", rent: 4180 },
        { name: "Marcus Williams", unit: "204", end: "Aug 31", rent: 4520 },
      ],
    },
    {
      label: "91–120 days",
      count: 16,
      tone: "muted" as const,
      items: [
        { name: "Olivia Martinez", unit: "412", end: "Sep 12", rent: 4080 },
        { name: "Liam O'Brien", unit: "501", end: "Sep 21", rent: 5680 },
      ],
    },
  ];

  return (
    <div className="space-y-3 ls-page-fade">
      <HeroBlock
        label="Predicted renewal revenue · next 90 days"
        value="$1.3M"
        hint="48 likely renew · 14 at risk · 8 likely move out · 62 of 70 offers sent"
        rightActions={
          <>
            <PillButton icon={<Calendar className="h-3 w-3" />}>Next 120 days</PillButton>
            <LivePill />
          </>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <IconKpi
          label="Active leases"
          value="100"
          icon={<CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="emerald"
          hint="Currently in residence"
        />
        <IconKpi
          label="Expiring (120d)"
          value="70"
          icon={<Calendar className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="indigo"
          hint="Need renewal action"
        />
        <IconKpi
          label="Offers sent"
          value="62 / 70"
          delta={{ value: "+8", trend: "up" }}
          icon={<MessageSquare className="h-4 w-4" strokeWidth={2.25} />}
          hint="89% coverage"
        />
        <IconKpi
          label="Predicted rev (90d)"
          value="$1.3M"
          delta={{ value: "+$94K", trend: "up" }}
          icon={<DollarSign className="h-4 w-4" strokeWidth={2.25} />}
          iconTone="violet"
          hint="Locked + likely renew"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3">
        <Card>
          <CardHead
            eyebrow="5-month forecast"
            title="Renewals timeline"
            description="Stacked: signed vs expiring vs lost. Jun–Aug is the busy window"
            right={
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                <LegendDot color={C.primary} label="Signed" />
                <LegendDot color={C.primaryFaint} label="Expiring" />
                <LegendDot color={C.rose} label="Lost" />
              </div>
            }
          />
          <div className="px-2 pb-3">
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={RENEWAL_TIMELINE} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip {...chartTooltipProps()} />
                  <Bar dataKey="signed" name="Signed" stackId="a" fill={C.primary} />
                  <Bar dataKey="expiring" name="Expiring" stackId="a" fill={C.primaryFaint} />
                  <Bar dataKey="lost" name="Lost" stackId="a" fill={C.rose} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead eyebrow="Forecast · next 120d" title="Predicted outcome" />
          <div className="px-4 pb-4 space-y-2.5">
            <ForecastRow tone="good" label="Likely renew" count={48} pct={68} note="~$222K/mo locked" />
            <ForecastRow tone="warn" label="At risk" count={14} pct={20} note="Push offers this week" />
            <ForecastRow tone="alert" label="Likely move out" count={8} pct={12} note="Backfill ready" />
          </div>
        </Card>
      </section>

      <Card>
        <CardHead
          eyebrow="Next 120 days"
          title="Renewal pipeline"
          description="Grouped by days until expiration · prioritize the leftmost column"
        />
        <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          {buckets.map((b) => {
            const tone =
              b.tone === "urgent"
                ? "border-rose-200 bg-rose-50/50"
                : b.tone === "soon"
                  ? "border-blue-200 bg-blue-50/40"
                  : b.tone === "primary"
                    ? "border-blue-300 bg-blue-50/70"
                    : "border-border bg-card";
            const eyebrowTone =
              b.tone === "urgent"
                ? "text-rose-700"
                : b.tone === "soon"
                  ? "text-blue-700"
                  : b.tone === "primary"
                    ? "text-blue-700"
                    : "text-muted-foreground";
            return (
              <div key={b.label} className={`rounded-xl border ${tone} p-2.5`}>
                <div className="flex items-center justify-between gap-2 mb-2 px-1">
                  <span className={"text-[10px] tracking-widest uppercase font-bold " + eyebrowTone}>
                    {b.label}
                  </span>
                  <span className={"text-[18px] font-bold tabular-nums " + eyebrowTone}>
                    {b.count}
                  </span>
                </div>
                <ul className="space-y-1.5 max-h-[280px] overflow-y-auto">
                  {b.items.map((l) => (
                    <li
                      key={l.unit}
                      className="rounded-lg border border-border bg-white px-2 py-1.5"
                    >
                      <p className="text-[11px] font-semibold text-foreground truncate">
                        {l.name}
                      </p>
                      <div className="flex items-center justify-between mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                        <span>#{l.unit}</span>
                        <span>{l.end}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                        ${l.rent.toLocaleString()}/mo
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// Detection helper lives in ./telegraph-detection.ts so the server-component
// page can import it without crossing the "use client" boundary.
