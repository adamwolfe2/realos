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
  if (Math.abs(n) >= 1000)
    return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `$${n.toLocaleString()}`;
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
  const end = new Date(snapshot.periodEnd);
  const days = snapshot.kind === "weekly" ? 7 : 28;
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `Trailing ${days} days through ${endLabel}`;
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
    <div className="rounded-[10px] border border-border bg-elevated px-3 py-2.5">
      <div
        className={`text-[19px] font-bold leading-none ${flag ? "text-destructive" : "text-foreground"}`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-medium leading-tight text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-11 items-end gap-[3px]">
      {values.map((v, i) => (
        <span
          key={i}
          className={`min-h-[2px] flex-1 rounded-t-sm ${v === max ? "bg-primary" : "bg-primary/25"}`}
          style={{ height: `${Math.max(2, Math.round((v / max) * 100))}%` }}
        />
      ))}
    </div>
  );
}

// KPI card with optional delta line.
export function KpiCard({
  value,
  label,
  delta,
  deltaRed,
  deltaNeutral,
}: {
  value: string;
  label: string;
  delta?: { up: boolean; text: string };
  deltaRed?: string;
  deltaNeutral?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-elevated px-4 py-3.5">
      <div className="text-[26px] font-bold leading-none tracking-tight">{value}</div>
      <div className="mt-1.5 text-[11px] font-medium text-slate-600">{label}</div>
      {delta ? (
        <div className={`mt-1.5 text-[10px] font-semibold ${delta.up ? "text-green-600" : "text-destructive"}`}>
          {delta.up ? "▲" : "▼"} {delta.text}
        </div>
      ) : deltaRed ? (
        <div className="mt-1.5 text-[10px] font-semibold text-destructive">{deltaRed}</div>
      ) : deltaNeutral ? (
        <div className="mt-1.5 text-[10px] font-medium text-muted-foreground">{deltaNeutral}</div>
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
  return [
    {
      label: "Chatbot leads: live",
      state: (s.chatbotStats?.conversations ?? 0) > 0 ? "live" : "prog",
    },
    {
      label: "Visitor pixel: live",
      state:
        (s.kpis.identifiedVisitors ?? 0) > 0 || (s.trafficTrend?.length ?? 0) > 0
          ? "live"
          : "prog",
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
    { label: "Zillow, Apartments.com: not wired", state: "off" },
  ];
}

export const COVERAGE_DOT: Record<CoverageState, string> = {
  live: "bg-green-600",
  prog: "bg-primary",
  off: "bg-slate-300",
};
