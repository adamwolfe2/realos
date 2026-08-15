import type { ReportSnapshot } from "@/lib/reports/generate";
import { SourceGlyph } from "@/components/audit/mentions/source-glyphs";
import type { AuditMentionSource } from "@/components/audit/mentions/types";
import {
  ChatGPTMark,
  ClaudeMark,
  PerplexityMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";

// ---------------------------------------------------------------------------
// Shared snapshot presentation primitives. Used by BOTH the printable
// PropertyOnePager and the interactive tabbed ReportDashboard so the two
// surfaces never drift. Pure presentation — no hooks, no client state — so a
// client component (the dashboard shell) can import these directly.
// ---------------------------------------------------------------------------

export type PropertyMeta = {
  name: string;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
};

// --- formatting helpers -----------------------------------------------------

export function compactUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs < 10_000) return `$${n.toLocaleString()}`;
  if (abs < 1_000_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${(n / 1_000_000).toFixed(2)}M`;
}

export function num(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

export function pct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${Math.round(n)}%`;
}

export function periodLabel(snapshot: ReportSnapshot): string {
  // Defensive: some legacy/stub snapshots predate periodEnd entirely. Don't
  // let a missing or unparseable date surface as "Invalid Date" in the UI.
  const end = snapshot.periodEnd ? new Date(snapshot.periodEnd) : null;
  const endLabel =
    end && !Number.isNaN(end.getTime())
      ? end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null;

  // weekly/monthly reports always run the fixed rolling window
  // resolvePeriod() produces (7d / 28d) — safe to name the length outright.
  if (snapshot.kind === "weekly") {
    return endLabel ? `Trailing 7 days through ${endLabel}` : "Trailing 7 days";
  }
  if (snapshot.kind === "monthly") {
    return endLabel ? `Trailing 28 days through ${endLabel}` : "Trailing 28 days";
  }

  // "custom" (and any other kind) can carry an arbitrary options.period
  // override — e.g. an all-time report spanning months. Naming a fixed
  // length here would claim a window the numbers don't match (bug: an
  // all-time report reading "Trailing 28 days" while its KPIs cover
  // Mar-Aug). Show the actual range instead.
  const start = snapshot.periodStart ? new Date(snapshot.periodStart) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return endLabel ? `Through ${endLabel}` : "Custom period";
  }
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(start.getFullYear() !== end.getFullYear() ? { year: "numeric" as const } : {}),
  });
  return `${startLabel} – ${endLabel}`;
}

export function addressLine(p: PropertyMeta): string | null {
  const parts = [
    p.addressLine1,
    [p.city, p.state].filter(Boolean).join(", ") || null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// --- brand mark mappers -----------------------------------------------------

export function EngineMark({ engine }: { engine: string }) {
  const e = engine.toUpperCase();
  if (e.includes("CHATGPT") || e.includes("OPENAI"))
    return <ChatGPTMark size={16} />;
  if (e.includes("CLAUDE") || e.includes("ANTHROPIC"))
    return <ClaudeMark size={16} />;
  if (e.includes("PERPLEXITY")) return <PerplexityMark size={16} />;
  if (e.includes("GEMINI") || e.includes("GOOGLE")) return <GeminiMark size={16} />;
  return null;
}

export function engineLabel(engine: string): string {
  const map: Record<string, string> = {
    CHATGPT: "ChatGPT",
    OPENAI: "ChatGPT",
    CLAUDE: "Claude",
    GEMINI: "Gemini",
    PERPLEXITY: "Perplexity",
  };
  return map[engine.toUpperCase()] ?? engine;
}

export function toMentionSource(source: string): AuditMentionSource {
  const s = source.toUpperCase();
  if (s.includes("REDDIT")) return "REDDIT";
  if (s.includes("GOOGLE")) return "GOOGLE_REVIEW";
  if (s.includes("FACEBOOK")) return "FACEBOOK";
  if (s.includes("YELP")) return "YELP";
  if (s.includes("BBB")) return "BBB";
  if (s.includes("APART")) return "APARTMENT_RATINGS";
  return "TAVILY_WEB";
}

export { SourceGlyph };

// --- small building blocks --------------------------------------------------

// Mobile 2-up tile grids: an odd tile count leaves the last tile sitting next
// to an empty cell. Stretch a lone last tile across both columns instead.
// Scoped to max-sm so the 3/4-column sm+/print layouts are untouched.
export const TILE_FILL = "max-sm:[&>*:last-child:nth-child(odd)]:col-span-2";

export function SectionHeading({
  children,
  meta,
}: {
  children: React.ReactNode;
  meta?: string;
}) {
  return (
    <h2 className="mb-3.5 flex items-center gap-2 text-[12.5px] font-bold text-foreground">
      <span className="inline-block h-3.5 w-1 rounded-sm bg-primary" />
      {children}
      {meta ? (
        <span className="ml-auto text-[10px] font-medium text-muted-foreground">
          {meta}
        </span>
      ) : null}
    </h2>
  );
}

export function Stat({
  value,
  label,
  flag,
}: {
  value: string;
  label: string;
  flag?: boolean;
}) {
  return (
    <div className="rounded-[2px] border border-border bg-card px-3 py-2 transition-[border-color,transform] duration-[120ms] hover:-translate-y-px hover:border-[#c6c6c6]">
      <div
        className={`font-mono text-[16px] font-semibold leading-none tracking-tight tabular-nums ${flag ? "text-destructive" : "text-foreground"}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] font-medium leading-tight text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

// Star rating that tells the truth: filled stars round to the actual rating,
// the remainder renders hollow. (Previously a literal "★★★★★" string — a 3.1
// property displayed five full stars.) Pure text, so print/PDF safe.
export function Stars({
  rating,
  className,
}: {
  rating: number | null | undefined;
  className?: string;
}) {
  const full =
    rating != null ? Math.max(0, Math.min(5, Math.round(rating))) : 0;
  return (
    <span
      className={`tracking-wide text-primary ${className ?? ""}`}
      aria-label={
        rating != null ? `${rating.toFixed(1)} out of 5 stars` : "No rating yet"
      }
    >
      <span aria-hidden="true">
        {"★".repeat(full)}
        {"☆".repeat(5 - full)}
      </span>
    </span>
  );
}

// Chunk a daily trend into weekly sums when the window is too long to read
// as individual daily bars (~134 thin bars is an unreadable wall). Chunks
// from the newest day backward so the most recent bucket is always a full
// week; any leftover partial week lands at the start (oldest).
export function bucketWeekly(values: number[]): number[] {
  const weeks: number[] = [];
  for (let end = values.length; end > 0; end -= 7) {
    const start = Math.max(0, end - 7);
    weeks.unshift(values.slice(start, end).reduce((sum, v) => sum + v, 0));
  }
  return weeks;
}

export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-11 items-end gap-[3px]">
      {values.map((v, i) => (
        <span
          key={i}
          className={`ls-col-grow min-h-[2px] flex-1 ${v === max ? "bg-primary" : "bg-primary/25"}`}
          style={{
            height: `${Math.max(2, Math.round((v / max) * 100))}%`,
            // Left-to-right cascade; the print/reduced-motion nets render
            // the bars finished because ls-col-in declares only `from`.
            animationDelay: `${i * 25}ms`,
          }}
        />
      ))}
    </div>
  );
}

// KPI card with optional delta line. All four headline KPIs share this one
// component so their number scale, label treatment, and delta styling never
// drift from each other.
export function KpiCard({
  value,
  label,
  delta,
  deltaNeutral,
}: {
  value: string;
  label: string;
  delta?: { up: boolean; text: string };
  deltaNeutral?: string;
}) {
  return (
    <div className="rounded-[2px] border border-border bg-card px-3 py-2.5 transition-[border-color,transform] duration-[120ms] hover:-translate-y-px hover:border-[#c6c6c6]">
      <div className="font-mono text-[20px] font-semibold leading-none tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 truncate text-[10.5px] font-medium text-muted-foreground">{label}</div>
      {delta ? (
        <div className={`mt-1 text-[10px] font-semibold ${delta.up ? "text-green-600" : "text-destructive"}`}>
          {delta.up ? "▲" : "▼"} {delta.text}
        </div>
      ) : deltaNeutral ? (
        <div className="mt-1 truncate text-[10px] font-medium text-muted-foreground">{deltaNeutral}</div>
      ) : null}
    </div>
  );
}

// --- coverage derivation ----------------------------------------------------

export type CoverageState = "live" | "prog" | "off";

export function coverageRows(s: ReportSnapshot): Array<{
  label: string;
  state: CoverageState;
}> {
  const adsLive = (s.adPerformance ?? []).some((a) => (a.spendUsd ?? 0) > 0);
  // Pixel state must come from a PIXEL signal. `trafficTrend` was previously
  // OR'd in here, which made this row structurally incapable of ever saying
  // anything else: bucketDaily() returns `new Array(days).fill(0)`, so every
  // trafficFallback branch yields a NON-EMPTY array and `.length > 0` was
  // unconditionally true on any generated snapshot. The row therefore printed
  // "Visitor pixel: live" with zero pixel installs, zero sessions, zero clicks
  // and zero ad spend. trafficTrend isn't pixel data anyway — generate.ts
  // builds it from GA4 organic sessions, falling back to GSC clicks, falling
  // back to daily ad spend.
  const visitorPixelLive = (s.kpis.identifiedVisitors ?? 0) > 0;
  return [
    {
      label: "Chatbot leads: live",
      state: (s.chatbotStats?.conversations ?? 0) > 0 ? "live" : "prog",
    },
    {
      // Flip the LABEL, not just the dot colour — every other row here that
      // can be inactive says so in words (see the ads row below). Leaving
      // this one hardcoded to "live" meant a report with zero identifications
      // still read "Visitor pixel: live" and relied on a colour swap alone to
      // say otherwise, which print/PDF and colour-blind readers both lose.
      label: visitorPixelLive
        ? "Visitor pixel: live"
        : "Visitor pixel: no identifications yet",
      state: visitorPixelLive ? "live" : "prog",
    },
    {
      label: "Leasing and occupancy: live",
      state: (s.lifecycleStats?.activeLeases ?? 0) > 0 ? "live" : "prog",
    },
    {
      label: "Reputation and AI visibility: live",
      state:
        (s.reputationStats?.totalReviews ?? 0) > 0 ||
        (s.aeoStats?.totalChecks ?? 0) > 0
          ? "live"
          : "prog",
    },
    {
      label: "GA4 and Search Console: indexing",
      state: (s.kpis.organicSessions ?? 0) > 0 ? "live" : "prog",
    },
    {
      label: adsLive ? "Google and Meta ads: live" : "Google and Meta ads: reconnect",
      state: adsLive ? "live" : "prog",
    },
    {
      label: "Tour and application funnel: pending",
      state:
        (s.kpis.tours ?? 0) > 0 || (s.kpis.applications ?? 0) > 0
          ? "live"
          : "prog",
    },
    // Suppressible (2026-08-13): on client-facing reports where these
    // sources were deliberately never wired, "not wired" reads as a gap
    // rather than transparency. Same key as the acquisition-list rows.
    ...(s.hiddenSections?.includes("untracked-sources")
      ? []
      : [{ label: "Zillow, Apartments.com: not wired", state: "off" as const }]),
  ];
}

export const COVERAGE_DOT: Record<CoverageState, string> = {
  live: "bg-green-600",
  prog: "bg-primary",
  off: "bg-slate-300",
};
