import type { ReportSnapshot } from "@/lib/reports/generate";
import { LeaseStackWordmark } from "@/components/brand/leasestack-wordmark";
import { SourceGlyph } from "@/components/audit/mentions/source-glyphs";
import type { AuditMentionSource } from "@/components/audit/mentions/types";
import {
  ChatGPTMark,
  ClaudeMark,
  PerplexityMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";

// ---------------------------------------------------------------------------
// PropertyOnePager — a single-page "Marketing & Performance Snapshot" for one
// property, rendered from a ReportSnapshot. Pure presentation: every number
// comes from the snapshot, so the same component works for any property in any
// org. Sections degrade gracefully when their data is absent.
//
// Designed to read as a printable executive one-pager (LeaseStack blue, the
// app's real brand marks, review-source glyphs, and AI-engine logos). Pairs
// with the existing PrintButton for "save as PDF".
// ---------------------------------------------------------------------------

type PropertyMeta = {
  name: string;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
};

type Props = {
  snapshot: ReportSnapshot;
  property: PropertyMeta;
};

// --- formatting helpers -----------------------------------------------------

function compactUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1000)
    return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `$${n.toLocaleString()}`;
}

function num(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

function pct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${Math.round(n)}%`;
}

function periodLabel(snapshot: ReportSnapshot): string {
  const end = new Date(snapshot.periodEnd);
  const days = snapshot.kind === "weekly" ? 7 : 28;
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `Trailing ${days} days through ${endLabel}`;
}

function addressLine(p: PropertyMeta): string | null {
  const parts = [
    p.addressLine1,
    [p.city, p.state].filter(Boolean).join(", ") || null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// --- brand mark mappers -----------------------------------------------------

function EngineMark({ engine }: { engine: string }) {
  const e = engine.toUpperCase();
  if (e.includes("CHATGPT") || e.includes("OPENAI"))
    return <ChatGPTMark size={16} />;
  if (e.includes("CLAUDE") || e.includes("ANTHROPIC"))
    return <ClaudeMark size={16} />;
  if (e.includes("PERPLEXITY")) return <PerplexityMark size={16} />;
  if (e.includes("GEMINI") || e.includes("GOOGLE")) return <GeminiMark size={16} />;
  return null;
}

function engineLabel(engine: string): string {
  const map: Record<string, string> = {
    CHATGPT: "ChatGPT",
    OPENAI: "ChatGPT",
    CLAUDE: "Claude",
    GEMINI: "Gemini",
    PERPLEXITY: "Perplexity",
  };
  return map[engine.toUpperCase()] ?? engine;
}

function toMentionSource(source: string): AuditMentionSource {
  const s = source.toUpperCase();
  if (s.includes("REDDIT")) return "REDDIT";
  if (s.includes("GOOGLE")) return "GOOGLE_REVIEW";
  if (s.includes("FACEBOOK")) return "FACEBOOK";
  if (s.includes("YELP")) return "YELP";
  if (s.includes("BBB")) return "BBB";
  if (s.includes("APART")) return "APARTMENT_RATINGS";
  return "TAVILY_WEB";
}

// --- small building blocks --------------------------------------------------

function SectionHeading({
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

function Stat({
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

function Sparkline({ values }: { values: number[] }) {
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

// --- coverage derivation ----------------------------------------------------

type CoverageState = "live" | "prog" | "off";

function coverageRows(s: ReportSnapshot): Array<{
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

const COVERAGE_DOT: Record<CoverageState, string> = {
  live: "bg-green-600",
  prog: "bg-primary",
  off: "bg-slate-300",
};

// --- main component ---------------------------------------------------------

export function PropertyOnePager({ snapshot, property }: Props) {
  const { kpis, occupancyStats, renewalStats, lifecycleStats, reputationStats, aeoStats, chatbotStatsExtended, leadSources, trafficTrend } =
    snapshot;

  const addr = addressLine(property);
  const sources = leadSources ?? [];
  const monthlySigned = lifecycleStats?.monthlySignedLast12 ?? [];
  const repMaxCount = Math.max(
    1,
    ...(reputationStats?.sourceBreakdown ?? []).map((r) => r.count),
  );

  return (
    <div className="mx-auto w-full max-w-[880px] rounded-2xl border border-border bg-card p-8 text-foreground shadow-sm print:border-0 print:shadow-none">
      {/* Header */}
      <header className="flex items-start justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-[26px] font-bold leading-[1.05] tracking-tight">
            Marketing &amp; Performance Snapshot
          </h1>
          <p className="mt-2 text-[12.5px] font-medium leading-relaxed text-muted-foreground">
            {property.name}
            {addr ? ` · ${addr}` : ""}
            <br />
            {periodLabel(snapshot)} · First-touch attribution
          </p>
        </div>
        <div className="text-right">
          <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Prepared by
          </div>
          <LeaseStackWordmark className="justify-end text-[20px] text-primary" />
        </div>
      </header>

      {/* Headline KPIs */}
      <div className="mt-5 grid grid-cols-4 gap-3">
        <KpiCard
          value={num(kpis.leads)}
          label="New leads"
          delta={
            snapshot.kpiDeltas?.leadsPct != null
              ? { up: snapshot.kpiDeltas.leadsPct >= 0, text: `${snapshot.kpiDeltas.leadsPct >= 0 ? "Up" : "Down"} vs prior period` }
              : undefined
          }
        />
        <KpiCard
          value={num(lifecycleStats?.leasesSignedInPeriod ?? 0)}
          label="Leases signed"
          delta={(() => {
            const cur = lifecycleStats?.leasesSignedInPeriod ?? 0;
            const prior = lifecycleStats?.priorLeasesSignedInPeriod ?? 0;
            return cur === 0 && prior === 0
              ? undefined
              : { up: cur >= prior, text: `From ${prior} prior` };
          })()}
        />
        <KpiCard
          value={occupancyStats?.occupancyPct != null ? pct(occupancyStats.occupancyPct) : "—"}
          label={`Occupancy across ${occupancyStats?.totalUnits ?? 0} units`}
          deltaRed={
            (occupancyStats?.onNotice ?? 0) > 0
              ? `${occupancyStats?.onNotice} residents on notice`
              : undefined
          }
        />
        <KpiCard
          value={compactUsd(occupancyStats?.monthlyRentRollUsd)}
          label="Monthly rent roll"
          deltaNeutral={
            occupancyStats?.avgRentPerUnitUsd != null
              ? `${compactUsd(occupancyStats.avgRentPerUnitUsd)} avg per unit`
              : undefined
          }
        />
      </div>

      {/* Acquisition + Leasing momentum */}
      <div className="mt-6 grid grid-cols-[1.1fr_0.9fr] gap-7">
        <section>
          <SectionHeading meta="first-touch">Lead acquisition</SectionHeading>
          <div className="mb-4 flex flex-col gap-2.5 text-[12.5px]">
            {sources.length === 0 ? (
              <div className="text-muted-foreground">No leads in period.</div>
            ) : (
              sources.map((src) => (
                <div key={src.source} className="flex items-center gap-2.5 font-medium">
                  <span className="h-2 w-2 flex-none rounded-sm bg-primary" />
                  <span>{src.source}</span>
                  <span className="ml-auto font-semibold text-slate-600">
                    {src.count} · {Math.round(src.pct)}%
                  </span>
                </div>
              ))
            )}
            {["Zillow", "Apartments.com"].map((s) => (
              <div key={s} className="flex items-center gap-2.5 font-medium text-muted-foreground">
                <span className="h-2 w-2 flex-none rounded-sm bg-slate-300" />
                <span>{s}</span>
                <span className="ml-auto">not tracked</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Stat value={num(chatbotStatsExtended?.conversations)} label="Chatbot conversations" />
            <Stat value={chatbotStatsExtended?.capturedRatePct != null ? pct(chatbotStatsExtended.capturedRatePct) : "—"} label="Lead capture rate" />
            <Stat value={num(kpis.identifiedVisitors)} label="Identified visitors" />
          </div>
          {trafficTrend?.length ? (
            <>
              <div className="mb-1.5 mt-3.5 text-[10px] font-medium text-muted-foreground">
                Daily site traffic, trailing 28 days
              </div>
              <Sparkline values={trafficTrend} />
            </>
          ) : null}
        </section>

        <section>
          <SectionHeading>Leasing momentum</SectionHeading>
          <div className="grid grid-cols-3 gap-2.5">
            <Stat value={num(lifecycleStats?.leasesSignedLast180d)} label="Signed, last 180 days" />
            <Stat value={num(lifecycleStats?.activeLeases)} label="Active leases" />
            <Stat value={compactUsd(renewalStats?.pastDueBalanceUsd)} label="Past-due balance" />
          </div>
          {monthlySigned.length ? (
            <>
              <div className="mb-1.5 mt-3.5 text-[10px] font-medium text-muted-foreground">
                Leases signed, last 12 months
              </div>
              <Sparkline values={monthlySigned.map((m) => m.count)} />
              <div className="mt-1.5 flex justify-between text-[9px] font-medium text-muted-foreground">
                <span>{monthlySigned[0]?.month}</span>
                <span>{monthlySigned[monthlySigned.length - 1]?.month}</span>
              </div>
            </>
          ) : null}
        </section>
      </div>

      {/* Renewals + Reputation */}
      <div className="mt-6 grid grid-cols-2 gap-7">
        <section>
          <SectionHeading>Renewals at risk</SectionHeading>
          <div className="grid grid-cols-3 gap-2.5">
            <Stat value={num(renewalStats?.expiringNext30)} label="Expiring within 30 days" />
            <Stat value={num(renewalStats?.expiringNext60)} label="Expiring within 60 days" />
            <Stat value={num(renewalStats?.expiringNext120)} label="Expiring within 120 days" />
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <Stat value={compactUsd(renewalStats?.monthlyAtRiskUsd)} label="Monthly revenue at risk, next 120 days" flag />
            </div>
            <Stat value={num(occupancyStats?.onNotice)} label="Residents on notice" />
          </div>
        </section>

        <section>
          <SectionHeading>Online reputation</SectionHeading>
          {reputationStats ? (
            <>
              <div className="mb-3 flex items-baseline gap-2.5">
                <span className="text-[28px] font-bold leading-none">
                  {reputationStats.overallRating != null ? reputationStats.overallRating.toFixed(1) : "—"}
                </span>
                <span className="text-[13px] tracking-wide text-primary">★★★★★</span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {reputationStats.totalReviews} reviews · {reputationStats.positiveCount} positive, {reputationStats.negativeCount} negative
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {reputationStats.sourceBreakdown.slice(0, 4).map((row) => (
                  <div key={row.source} className="flex items-center gap-2.5 text-[12px]">
                    <span className="flex h-4 w-4 flex-none items-center justify-center">
                      <SourceGlyph source={toMentionSource(row.source)} className="h-4 w-4" />
                    </span>
                    <span className="w-[74px] font-medium text-slate-600">{row.source}</span>
                    <span className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                      <span
                        className="block h-full rounded bg-primary"
                        style={{ width: `${Math.round((row.count / repMaxCount) * 100)}%` }}
                      />
                    </span>
                    <span className="w-6 text-right font-bold">{row.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {reputationStats.responseRatePct != null ? (
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10.5px] font-medium ${
                      reputationStats.responseRatePct < 50
                        ? "border-destructive/30 bg-destructive/5 font-semibold text-destructive"
                        : "border-border bg-elevated text-slate-600"
                    }`}
                  >
                    {Math.round(reputationStats.responseRatePct)}% response rate
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <div className="text-[12px] text-muted-foreground">No reputation data yet.</div>
          )}
        </section>
      </div>

      {/* AI search visibility */}
      {aeoStats && aeoStats.totalChecks > 0 ? (
        <section className="mt-6 rounded-2xl border border-border bg-elevated p-5">
          <h2 className="flex items-center gap-2 text-[12.5px] font-bold text-foreground">
            <span className="inline-block h-3.5 w-1 rounded-sm bg-primary" />
            AI search visibility
            <span className="ml-auto rounded-full bg-primary px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-primary-foreground">
              LeaseStack exclusive
            </span>
          </h2>
          <p className="my-3.5 text-[11.5px] leading-relaxed text-slate-600">
            {property.name} was cited in{" "}
            <b className="text-foreground">
              {aeoStats.cited} of {aeoStats.totalChecks}
            </b>{" "}
            AI answers ({pct((aeoStats.cited / aeoStats.totalChecks) * 100)}) across the major engines. Competitor properties appeared in {aeoStats.competitorCited}.
          </p>
          <div className="grid grid-cols-[1.25fr_1fr] gap-7">
            <div>
              <div className="flex flex-col gap-2.5">
                {(aeoStats.byEngine ?? []).map((row) => (
                  <div key={row.engine} className="flex items-center gap-2.5 text-[11.5px]">
                    <span className="flex h-[17px] w-[17px] flex-none items-center justify-center">
                      <EngineMark engine={row.engine} />
                    </span>
                    <span className="w-[74px] font-semibold text-foreground">{engineLabel(row.engine)}</span>
                    <span className="flex h-3 flex-1 overflow-hidden rounded bg-slate-200">
                      <span
                        className="h-full bg-primary"
                        style={{ width: `${row.total ? Math.round((row.cited / row.total) * 100) : 0}%` }}
                      />
                    </span>
                    <span className="w-12 text-right font-semibold text-slate-600">
                      {row.cited} / {row.total}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2.5 flex gap-3.5 text-[9.5px] font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-2 w-2 rounded-sm bg-primary" /> Times cited
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="inline-block h-2 w-2 rounded-sm bg-slate-200" /> Total answers checked
                </span>
              </div>
            </div>
            <div>
              <div className="mb-2.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Who AI recommends instead
              </div>
              <div className="flex flex-col gap-2 text-[11.5px]">
                {aeoStats.topCompetitors.slice(0, 5).map((c) => (
                  <div key={c.name} className="flex justify-between font-medium text-slate-600">
                    <span>{c.name}</span>
                    <b className="font-bold text-foreground">{c.mentions}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Coverage */}
      <div className="mt-6 grid grid-cols-4 gap-x-4 gap-y-2.5 border-t border-border pt-4">
        {coverageRows(snapshot).map((row) => (
          <div key={row.label} className="flex items-center gap-2 text-[10.5px] font-medium text-slate-600">
            <span className={`h-[7px] w-[7px] flex-none rounded-full ${COVERAGE_DOT[row.state]}`} />
            {row.label}
          </div>
        ))}
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
        Cohort report. Reflects leads created in the window and any downstream activity for them, even if it occurs later.{" "}
        <b className="font-semibold text-slate-500">Green</b> data flowing,{" "}
        <b className="font-semibold text-slate-500">blue</b> connected and in progress,{" "}
        <b className="font-semibold text-slate-500">grey</b> not yet integrated.
      </p>
    </div>
  );
}

// KPI card with optional delta line
function KpiCard({
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
