import * as React from "react";
import type { ReportSnapshot } from "@/lib/reports/generate";
import { suppressLowSampleDelta } from "@/lib/recency";

// Single source of truth for chart palette so PDFs are predictable.
// Ink (previously near-black #161616) retargets to brand blue so any
// future caller pulling C.ink renders blue-on-white, not black-on-white.
// Keep `text` as the only "actually dark" token for body copy in PDFs.
export const C = {
  primary: "#0f62fe",
  primaryMid: "#4589ff",
  primaryLight: "#78a9ff",
  primaryFaint: "#a6c8ff",
  primaryGhost: "#d0e2ff",
  indigo: "#0f62fe",
  ink: "#0f62fe",
  text: "#161616",
  muted: "#8d8d8d",
  border: "#e0e0e0",
  positive: "#0f62fe",
  negative: "#da1e28",
  amber: "#78a9ff",
  rose: "#002d9c",
  violet: "#4589ff",
};

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function Section({
  title,
  eyebrow,
  className = "",
  children,
}: {
  title: string;
  eyebrow?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={"rounded-[2px] border border-border bg-card " + className}>
      <header className="px-4 pt-4">
        {eyebrow ? (
          <div className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground mb-0.5">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
      </header>
      <div className="p-4 pt-3">{children}</div>
    </section>
  );
}

type IconKpiTone = "primary" | "muted";

export function IconKpi({
  label,
  value,
  deltaPct,
  invertDelta = false,
  tone = "primary",
  glyph,
  currentValue,
}: {
  label: string;
  value: string;
  deltaPct?: number | null;
  invertDelta?: boolean;
  tone?: IconKpiTone;
  glyph?: "target" | "calendar" | "check" | "dollar" | "globe";
  /** Absolute current value — used to suppress noisy deltas on low samples. */
  currentValue?: number | null;
}) {
  const tones: Record<IconKpiTone, string> = {
    primary: "bg-primary/10 text-primary",
    muted: "bg-muted text-foreground",
  };
  return (
    <div className="rounded-[2px] border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {glyph ? (
            <span
              className={"h-7 w-7 rounded-[2px] flex items-center justify-center shrink-0 " + tones[tone]}
              aria-hidden="true"
            >
              <Glyph name={glyph} />
            </span>
          ) : null}
          <p className="text-[10px] tracking-widest uppercase font-bold text-muted-foreground truncate">
            {label}
          </p>
        </div>
        {deltaPct != null ? (
          <DeltaPill
            value={deltaPct}
            invert={invertDelta}
            currentValue={currentValue}
          />
        ) : null}
      </div>
      <p className="mt-2 text-[20px] leading-none font-bold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function Glyph({ name }: { name: "target" | "calendar" | "check" | "dollar" | "globe" }) {
  const stroke = 2;
  const sz = 14;
  const path: Record<typeof name, React.ReactNode> = {
    target: (
      <>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    check: (
      <>
        <polyline points="20 6 9 17 4 12" />
      </>
    ),
    dollar: (
      <>
        <line x1="12" y1="2" x2="12" y2="22" />
        <path d="M17 5H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </>
    ),
  };
  return (
    <svg
      width={sz}
      height={sz}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path[name]}
    </svg>
  );
}

// Bug #112: low-sample delta suppression. "ORGANIC SESSIONS: 1 (-100%)"
// looked broken in client-facing reports — at very low absolute values a
// percentage delta is statistical noise. The shared helper in lib/recency.ts
// renders an em-dash + "Low sample size" tooltip when either current or
// previous is below threshold. Consolidating here so any future tweak (raise
// threshold, change copy) edits one file, not seven inline copies across the
// portal.
export function DeltaPill({
  value,
  invert = false,
  large = false,
  currentValue,
  previousValue,
}: {
  value: number;
  invert?: boolean;
  large?: boolean;
  /**
   * Absolute current value the percentage was computed from. When provided
   * AND below the suppress threshold, we hide the percentage and render an
   * em-dash with a "Low sample size" tooltip. Omit to always render.
   */
  currentValue?: number | null;
  /**
   * Previous-period absolute value. Same suppression rule: if either current
   * or previous is below the threshold, the delta is noise.
   */
  previousValue?: number | null;
}) {
  const sz = large
    ? "px-3 py-1.5 text-[14px]"
    : "px-1.5 py-0.5 text-[10px]";
  // Bug #112: low-sample delta suppression — derive previous from value+current
  // when the caller doesn't pass it explicitly so we can route through the
  // shared helper without changing every call site signature. previous =
  // current / (1 + value/100) is the inverse of the percentage formula.
  const inferredPrevious =
    previousValue != null
      ? previousValue
      : currentValue != null && value !== -100
        ? currentValue / (1 + value / 100)
        : null;
  if (currentValue != null && inferredPrevious != null) {
    const suppressed = suppressLowSampleDelta(currentValue, inferredPrevious);
    if (suppressed.lowSample) {
      return (
        <span
          title="Low sample size"
          className={
            "inline-flex items-center gap-0.5 rounded-[2px] font-bold tabular-nums bg-muted text-muted-foreground " +
            sz
          }
        >
          —
        </span>
      );
    }
  }
  const goodDirection = invert ? value < 0 : value > 0;
  const flat = value === 0;
  const tone = flat
    ? "bg-muted text-muted-foreground"
    : goodDirection
      ? "bg-primary/10 text-primary"
      : "bg-primary text-primary-foreground";
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 rounded-[2px] font-bold tabular-nums " +
        tone +
        " " +
        sz
      }
    >
      {value >= 0 ? "+" : ""}
      {value}%
    </span>
  );
}

export function FunnelList({ stages }: { stages: ReportSnapshot["funnel"] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <ul className="space-y-1.5">
      {stages.map((s, i) => {
        const pct = Math.round((s.count / max) * 100);
        return (
          <li key={s.stage} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-xs text-muted-foreground">
              {s.stage}
            </span>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: C.primary,
                  transformOrigin: "left center",
                  transform: "scaleX(0)",
                  animation:
                    "ls-grow 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
                  animationDelay: `${200 + i * 90}ms`,
                }}
              />
            </div>
            <span className="w-10 text-right text-xs font-bold tabular-nums text-foreground">
              {s.count.toLocaleString()}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function SourceList({ sources }: { sources: ReportSnapshot["leadSources"] }) {
  if (sources.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No leads in this period.</p>
    );
  }
  const max = Math.max(1, ...sources.map((s) => s.count));
  return (
    <ul className="space-y-1.5">
      {sources.map((row, i) => {
        const pct = Math.round((row.count / max) * 100);
        return (
          <li key={row.source} className="grid grid-cols-[1fr_auto_30px] gap-2 items-center">
            <div>
              <div className="flex items-baseline justify-between gap-2 text-xs mb-1">
                <span className="text-foreground font-medium truncate">
                  {row.source}
                </span>
                <span className="text-foreground font-bold tabular-nums">
                  {row.count.toLocaleString()}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: C.primary,
                    transformOrigin: "left center",
                    transform: "scaleX(0)",
                    animation:
                      "ls-grow 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
                    animationDelay: `${200 + i * 90}ms`,
                  }}
                />
              </div>
            </div>
            <span />
            <span className="text-xs text-muted-foreground tabular-nums text-right">
              {row.pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Table({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={c}
                className={
                  "text-[10px] tracking-widest uppercase font-bold text-muted-foreground pb-1.5 border-b border-border " +
                  (i === 0 ? "text-left" : "text-right")
                }
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b border-border last:border-0">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={
                    "py-1.5 tabular-nums " +
                    (i === 0
                      ? "text-foreground font-medium text-left"
                      : "text-foreground text-right")
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[2px] border border-border bg-card px-2.5 sm:px-3 py-2 min-w-0">
      <div className="text-[10px] sm:text-[10px] tracking-widest uppercase font-bold text-muted-foreground truncate">
        {label}
      </div>
      <div className="mt-0.5 text-[14px] sm:text-[15px] font-bold tabular-nums text-foreground truncate">
        {value}
      </div>
    </div>
  );
}

export function Donut({
  pct,
  label,
  sublabel,
}: {
  pct: number;
  label: string;
  sublabel?: string;
}) {
  const size = 120;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const fraction = Math.max(0, Math.min(1, pct / 100));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={C.border}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={C.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${fraction * circ} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {sublabel ? (
          <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
            {sublabel}
          </span>
        ) : null}
        <span className="mt-0.5 text-[20px] font-bold tracking-tight text-foreground tabular-nums leading-none">
          {label}
        </span>
      </div>
    </div>
  );
}

export function KvLine({ k, v, dot }: { k: string; v: string; dot: string }) {
  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <span className="flex items-center gap-1.5 min-w-0">
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: dot }}
        />
        <span className="truncate text-foreground">{k}</span>
      </span>
      <span className="tabular-nums font-bold text-foreground shrink-0">
        {v}
      </span>
    </div>
  );
}

export function TrendChart({
  data,
  compact = false,
}: {
  data: number[];
  compact?: boolean;
}) {
  if (data.length < 2) {
    return (
      <p className="text-xs text-muted-foreground">
        Not enough data for a trend chart yet.
      </p>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 800;
  const height = compact ? 60 : 100;
  const stepX = width / (data.length - 1);
  // Smooth via simple cubic interpolation for the polished look.
  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return [x, y] as const;
  });
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const areaPath = d + ` L ${width},${height} L 0,${height} Z`;
  const gradId = `ls-trend-${data.length}-${compact ? "c" : "f"}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={compact ? "w-full h-14" : "w-full h-24"}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.primary} stopOpacity={0.32} />
          <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#${gradId})`}
        // Fade in the gradient fill so the area appears after the
        // stroke draws.
        style={{
          opacity: 0,
          animation: "ls-fade-in 800ms ease-out 700ms forwards",
        }}
      />
      <path
        d={d}
        fill="none"
        stroke={C.primary}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        // Draw the line left-to-right via stroke-dashoffset animation.
        // Uses ls-draw keyframe added to globals.css for the auth
        // showcase — same primitive, so adding it here doesn't ship
        // any new CSS.
        style={{
          strokeDasharray: 2400,
          strokeDashoffset: 2400,
          animation: "ls-draw 1200ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      />
    </svg>
  );
}

export function EmptyTabState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="ls-report-section rounded-[2px] border border-dashed border-border bg-card/40 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
        {body}
      </p>
    </div>
  );
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return path.length > 40 ? `${path.slice(0, 37)}…` : path;
  } catch {
    return url.length > 40 ? `${url.slice(0, 37)}…` : url;
  }
}

export function Card({
  eyebrow,
  value,
  headline,
  sub,
  tone,
}: {
  eyebrow: string;
  value: string;
  headline: string;
  sub: string;
  tone: "good" | "warn" | "neutral";
}) {
  // Norman feedback (May 22): kill the yellow warn tone. All three
  // tones now sit in the brand blue palette — "warn" uses a denser
  // blue gradient so it still pops as the call-to-action tile, "good"
  // is a softer brand tint, neutral stays plain card.
  const isTinted = tone === "warn" || tone === "good";
  const toneCls =
    tone === "warn"
      ? "border-[#a6c8ff]"
      : tone === "good"
        ? "border-primary/20"
        : "border-border bg-card";
  return (
    <div
      className={`rounded-[2px] border ${toneCls} px-4 py-3.5`}
      style={
        isTinted
          ? {
              backgroundColor: tone === "warn" ? "#d0e2ff" : "#edf5ff",
            }
          : undefined
      }
    >
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        {eyebrow}
      </p>
      <p className="mt-0.5 text-[22px] font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-[12px] font-medium text-foreground leading-snug truncate">
        {headline}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
        {sub}
      </p>
    </div>
  );
}

export function prettySource(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
