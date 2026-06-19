import type { ReportSnapshot } from "@/lib/reports/generate";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  BarChart3,
  KeyRound,
  CalendarClock,
  Star,
  Sparkles,
  Lightbulb,
  ChevronRight,
} from "lucide-react";
import {
  type PropertyMeta,
  compactUsd,
  num,
  pct,
  EngineMark,
  engineLabel,
  toMentionSource,
  SourceGlyph,
  SectionHeading,
  Stat,
  Sparkline,
  coverageRows,
  COVERAGE_DOT,
} from "../snapshot-shared";

// ---------------------------------------------------------------------------
// Report dashboard sections. Each domain is one panel rendered from the
// already-loaded ReportSnapshot (no extra queries). Pure presentation; the
// client shell (report-dashboard.tsx) owns tab state + URL sync and passes a
// `navTo` callback so the Overview summary cards deep-link into a section.
// ---------------------------------------------------------------------------

export type SectionId =
  | "overview"
  | "acquisition"
  | "traffic"
  | "ads"
  | "leasing"
  | "renewals"
  | "reputation"
  | "ai-visibility"
  | "insights";

export type NavTo = (id: SectionId) => void;

type SectionDef = {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  available: (s: ReportSnapshot) => boolean;
  render: (s: ReportSnapshot, p: PropertyMeta, navTo: NavTo) => React.ReactNode;
};

// --- local layout helpers ---------------------------------------------------

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">{children}</section>
  );
}

function BarRow({
  label,
  value,
  max,
  trailing,
  glyph,
}: {
  label: string;
  value: number;
  max: number;
  trailing: string;
  glyph?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 text-[12px]">
      {glyph ? (
        <span className="flex h-4 w-4 flex-none items-center justify-center">{glyph}</span>
      ) : null}
      <span className="w-[120px] flex-none truncate font-medium text-slate-600">{label}</span>
      <span className="h-4 flex-1 overflow-hidden rounded bg-muted">
        <span
          className="block h-full rounded bg-primary"
          style={{ width: `${max > 0 ? Math.round((value / max) * 100) : 0}%` }}
        />
      </span>
      <span className="w-16 flex-none text-right font-semibold text-foreground">{trailing}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] text-muted-foreground">{children}</div>;
}

// --- section renderers ------------------------------------------------------

function OverviewSection(s: ReportSnapshot, p: PropertyMeta, navTo: NavTo): React.ReactNode {
  const { kpis, occupancyStats, lifecycleStats, renewalStats, reputationStats, aeoStats } = s;
  const cited = aeoStats?.totalChecks ? (aeoStats.cited / aeoStats.totalChecks) * 100 : null;

  const cards: Array<{
    id: SectionId;
    icon: LucideIcon;
    label: string;
    value: string;
    context: string;
    danger?: boolean;
  }> = [
    {
      id: "acquisition",
      icon: Users,
      label: "Lead acquisition",
      value: num(kpis.leads),
      context: `${num(kpis.identifiedVisitors ?? 0)} identified visitors`,
    },
    {
      id: "leasing",
      icon: KeyRound,
      label: "Leasing & occupancy",
      value: occupancyStats?.occupancyPct != null ? pct(occupancyStats.occupancyPct) : num(lifecycleStats?.activeLeases),
      context: `${num(lifecycleStats?.leasesSignedInPeriod ?? 0)} signed this period`,
    },
    {
      id: "renewals",
      icon: CalendarClock,
      label: "Renewals at risk",
      value: compactUsd(renewalStats?.monthlyAtRiskUsd),
      context: `${num(renewalStats?.expiringNext120 ?? 0)} expiring within 120 days`,
      danger: (renewalStats?.monthlyAtRiskUsd ?? 0) > 0,
    },
    {
      id: "reputation",
      icon: Star,
      label: "Online reputation",
      value: reputationStats?.overallRating != null ? reputationStats.overallRating.toFixed(1) : "—",
      context: `${num(reputationStats?.totalReviews ?? 0)} reviews`,
    },
    {
      id: "ai-visibility",
      icon: Sparkles,
      label: "AI search visibility",
      value: cited != null ? pct(cited) : "—",
      context: aeoStats ? `cited in ${aeoStats.cited}/${aeoStats.totalChecks} answers` : "not yet checked",
    },
    {
      id: "traffic",
      icon: TrendingUp,
      label: "Traffic & SEO",
      value: num(kpis.organicSessions),
      context: `${num((s.topQueries ?? []).length)} ranking queries`,
    },
  ];

  return (
    <Panel>
      {/* Headline KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HeroStat value={num(kpis.leads)} label="New leads" delta={s.kpiDeltas?.leadsPct} />
        <HeroStat value={num(lifecycleStats?.leasesSignedInPeriod ?? 0)} label="Leases signed" />
        <HeroStat
          value={occupancyStats?.occupancyPct != null ? pct(occupancyStats.occupancyPct) : "—"}
          label={`Occupancy · ${occupancyStats?.totalUnits ?? 0} units`}
        />
        <HeroStat value={compactUsd(occupancyStats?.monthlyRentRollUsd)} label="Monthly rent roll" />
      </div>

      {/* Clickable section summary cards — each deep-links into its tab */}
      <div>
        <SubHead>Dig deeper</SubHead>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => navTo(c.id)}
                className="group flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-elevated"
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium text-muted-foreground">{c.label}</span>
                  <span className={`block text-[19px] font-bold leading-tight ${c.danger ? "text-destructive" : "text-foreground"}`}>
                    {c.value}
                  </span>
                  <span className="block truncate text-[11px] text-slate-600">{c.context}</span>
                </span>
                <ChevronRight className="h-4 w-4 flex-none text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>

      {/* AI analysis summary */}
      {s.aiAnalysis?.summary ? (
        <Card>
          <SectionHeading meta="AI analysis">Executive summary</SectionHeading>
          <p className="text-[13px] leading-relaxed text-slate-600">{s.aiAnalysis.summary}</p>
          {s.aiAnalysis.actions.length ? (
            <button
              type="button"
              onClick={() => navTo("insights")}
              className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
            >
              {s.aiAnalysis.actions.length} recommended action{s.aiAnalysis.actions.length === 1 ? "" : "s"}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </Card>
      ) : null}

      {/* Coverage strip */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border pt-4 sm:grid-cols-4">
        {coverageRows(s).map((row) => (
          <div key={row.label} className="flex items-center gap-2 text-[10.5px] font-medium text-slate-600">
            <span className={`h-[7px] w-[7px] flex-none rounded-full ${COVERAGE_DOT[row.state]}`} />
            {row.label}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function HeroStat({
  value,
  label,
  delta,
}: {
  value: string;
  label: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-elevated px-4 py-3.5">
      <div className="text-[26px] font-bold leading-none tracking-tight text-foreground">{value}</div>
      <div className="mt-1.5 text-[11px] font-medium text-slate-600">{label}</div>
      {delta != null ? (
        <div className={`mt-1.5 text-[10px] font-semibold ${delta >= 0 ? "text-green-600" : "text-destructive"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs prior
        </div>
      ) : null}
    </div>
  );
}

function AcquisitionSection(s: ReportSnapshot): React.ReactNode {
  const sources = s.leadSources ?? [];
  const maxSrc = Math.max(1, ...sources.map((x) => x.count));
  const funnel = s.funnel ?? [];
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));
  const attribution = s.attributionBySource ?? [];
  const chat = s.chatbotStatsExtended;

  return (
    <Panel>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <SectionHeading meta="first-touch">Lead sources</SectionHeading>
          {sources.length === 0 ? (
            <Empty>No leads in period.</Empty>
          ) : (
            <div className="flex flex-col gap-2.5">
              {sources.map((src) => (
                <BarRow key={src.source} label={src.source} value={src.count} max={maxSrc} trailing={`${src.count} · ${Math.round(src.pct)}%`} />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionHeading>Conversion funnel</SectionHeading>
          {funnel.length === 0 ? (
            <Empty>No funnel activity yet.</Empty>
          ) : (
            <div className="flex flex-col gap-2.5">
              {funnel.map((f) => (
                <BarRow key={f.stage} label={f.stage} value={f.count} max={maxFunnel} trailing={num(f.count)} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionHeading>Chatbot &amp; visitor capture</SectionHeading>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat value={num(chat?.conversations)} label="Conversations" />
          <Stat value={chat?.capturedRatePct != null ? pct(chat.capturedRatePct) : "—"} label="Lead capture rate" />
          <Stat value={num(chat?.capturedConversations)} label="Leads from chat" />
          <Stat value={num(s.kpis.identifiedVisitors)} label="Identified visitors" />
        </div>
      </Card>

      {attribution.length ? (
        <Card>
          <SectionHeading>Attribution by source</SectionHeading>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-[12px]">
              <thead className="bg-elevated text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <Th left>Source</Th><Th>Leads</Th><Th>Tours</Th><Th>Apps</Th><Th>Signed</Th>
                </tr>
              </thead>
              <tbody>
                {attribution.map((r) => (
                  <tr key={r.source} className="border-t border-border">
                    <Td left>{r.source}</Td><Td>{num(r.leads)}</Td><Td>{num(r.tours)}</Td><Td>{num(r.applications)}</Td><Td>{num(r.signed)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </Panel>
  );
}

function TrafficSection(s: ReportSnapshot): React.ReactNode {
  const trend = s.trafficTrend ?? [];
  const pages = s.topPages ?? [];
  const queries = s.topQueries ?? [];

  return (
    <Panel>
      <Card>
        <SectionHeading meta="trailing 28 days">Daily site traffic</SectionHeading>
        {trend.length ? <Sparkline values={trend} /> : <Empty>No traffic data yet.</Empty>}
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Stat value={num(s.kpis.organicSessions)} label="Organic sessions" />
          <Stat value={num(pages.length)} label="Tracked pages" />
          <Stat value={num(queries.length)} label="Ranking queries" />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <SectionHeading>Top pages</SectionHeading>
          {pages.length === 0 ? (
            <Empty>No page data yet.</Empty>
          ) : (
            <div className="flex flex-col gap-2 text-[12px]">
              {pages.slice(0, 8).map((pg) => (
                <div key={pg.url} className="flex items-center gap-2.5">
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-600">{pg.url}</span>
                  <span className="flex-none font-semibold text-foreground">{num(pg.sessions)} sessions</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionHeading>Top search queries</SectionHeading>
          {queries.length === 0 ? (
            <Empty>No query data yet.</Empty>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-[12px]">
                <thead className="bg-elevated text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr><Th left>Query</Th><Th>Clicks</Th><Th>Impr.</Th><Th>Pos.</Th></tr>
                </thead>
                <tbody>
                  {queries.slice(0, 8).map((q) => (
                    <tr key={q.query} className="border-t border-border">
                      <Td left>{q.query}</Td><Td>{num(q.clicks)}</Td><Td>{num(q.impressions)}</Td><Td>{q.position.toFixed(1)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Panel>
  );
}

function AdsSection(s: ReportSnapshot): React.ReactNode {
  const ads = (s.adPerformance ?? []).filter((a) => (a.spendUsd ?? 0) > 0);
  const totalSpend = ads.reduce((t, a) => t + (a.spendUsd ?? 0), 0);
  const totalLeads = ads.reduce((t, a) => t + (a.leads ?? 0), 0);

  return (
    <Panel>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={compactUsd(totalSpend)} label="Total ad spend" />
        <Stat value={num(totalLeads)} label="Ad-sourced leads" />
        <Stat value={totalLeads > 0 ? compactUsd(totalSpend / totalLeads) : "—"} label="Blended cost per lead" />
        <Stat value={num(ads.length)} label="Active platforms" />
      </div>
      <Card>
        <SectionHeading>Platform performance</SectionHeading>
        {ads.length === 0 ? (
          <Empty>No ad spend in period.</Empty>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-[12px]">
              <thead className="bg-elevated text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr><Th left>Platform</Th><Th>Spend</Th><Th>Leads</Th><Th>CPL</Th><Th>Conv.</Th></tr>
              </thead>
              <tbody>
                {ads.map((a) => (
                  <tr key={a.platform} className="border-t border-border">
                    <Td left>{a.platform}</Td>
                    <Td>{compactUsd(a.spendUsd)}</Td>
                    <Td>{num(a.leads)}</Td>
                    <Td>{a.cpl != null ? compactUsd(a.cpl) : "—"}</Td>
                    <Td>{a.conversionRate != null ? pct(a.conversionRate) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Panel>
  );
}

function LeasingSection(s: ReportSnapshot): React.ReactNode {
  const occ = s.occupancyStats;
  const life = s.lifecycleStats;
  const monthly = life?.monthlySignedLast12 ?? [];

  return (
    <Panel>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={occ?.occupancyPct != null ? pct(occ.occupancyPct) : "—"} label={`Occupancy · ${occ?.totalUnits ?? 0} units`} />
        <Stat value={num(occ?.leasedUnits)} label="Leased units" />
        <Stat value={num(occ?.availableUnits)} label="Available units" />
        <Stat value={compactUsd(occ?.monthlyRentRollUsd)} label="Monthly rent roll" />
      </div>

      <Card>
        <SectionHeading>Leasing momentum</SectionHeading>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat value={num(life?.leasesSignedInPeriod)} label="Signed this period" />
          <Stat value={num(life?.leasesSignedLast180d)} label="Signed, last 180 days" />
          <Stat value={num(life?.activeLeases)} label="Active leases" />
          <Stat value={num(life?.applicationsInPeriod)} label="Applications" />
        </div>
        {monthly.length ? (
          <>
            <div className="mb-1.5 mt-4 text-[10px] font-medium text-muted-foreground">
              Leases signed, last 12 months
            </div>
            <Sparkline values={monthly.map((m) => m.count)} />
            <div className="mt-1.5 flex justify-between text-[9px] font-medium text-muted-foreground">
              <span>{monthly[0]?.month}</span>
              <span>{monthly[monthly.length - 1]?.month}</span>
            </div>
          </>
        ) : null}
      </Card>
    </Panel>
  );
}

function RenewalsSection(s: ReportSnapshot): React.ReactNode {
  const r = s.renewalStats;
  const occ = s.occupancyStats;
  return (
    <Panel>
      <div className="grid grid-cols-3 gap-3">
        <Stat value={num(r?.expiringNext30)} label="Expiring within 30 days" />
        <Stat value={num(r?.expiringNext60)} label="Expiring within 60 days" />
        <Stat value={num(r?.expiringNext120)} label="Expiring within 120 days" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={compactUsd(r?.monthlyAtRiskUsd)} label="Monthly revenue at risk" flag={(r?.monthlyAtRiskUsd ?? 0) > 0} />
        <Stat value={num(occ?.onNotice)} label="Residents on notice" />
        <Stat value={num(r?.pastDueCount)} label="Past-due accounts" />
        <Stat value={compactUsd(r?.pastDueBalanceUsd)} label="Past-due balance" flag={(r?.pastDueBalanceUsd ?? 0) > 0} />
      </div>
    </Panel>
  );
}

function ReputationSection(s: ReportSnapshot): React.ReactNode {
  const r = s.reputationStats;
  if (!r) return <Empty>No reputation data yet.</Empty>;
  const maxCount = Math.max(1, ...(r.sourceBreakdown ?? []).map((x) => x.count));
  return (
    <Panel>
      <Card>
        <div className="flex items-baseline gap-2.5">
          <span className="text-[34px] font-bold leading-none text-foreground">
            {r.overallRating != null ? r.overallRating.toFixed(1) : "—"}
          </span>
          <span className="text-[15px] tracking-wide text-primary">★★★★★</span>
          <span className="text-[12px] font-medium text-muted-foreground">
            {num(r.totalReviews)} reviews · {num(r.positiveCount)} positive, {num(r.negativeCount)} negative
          </span>
          {r.responseRatePct != null ? (
            <span className={`ml-auto rounded-full border px-2.5 py-1 text-[10.5px] font-medium ${r.responseRatePct < 50 ? "border-destructive/30 bg-destructive/5 font-semibold text-destructive" : "border-border bg-elevated text-slate-600"}`}>
              {Math.round(r.responseRatePct)}% response rate
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {(r.sourceBreakdown ?? []).slice(0, 6).map((row) => (
            <BarRow
              key={row.source}
              label={row.source}
              value={row.count}
              max={maxCount}
              trailing={`${num(row.count)}${row.rating != null ? ` · ${row.rating.toFixed(1)}★` : ""}`}
              glyph={<SourceGlyph source={toMentionSource(row.source)} className="h-4 w-4" />}
            />
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <SectionHeading>Highlights</SectionHeading>
          <MentionList items={r.highlights ?? []} />
        </Card>
        <Card>
          <SectionHeading>Concerns to address</SectionHeading>
          <MentionList items={r.concerns ?? []} />
        </Card>
      </div>
    </Panel>
  );
}

type Mention = {
  id: string;
  source: string;
  rating: number | null;
  excerpt: string;
  authorName: string | null;
};

function MentionList({ items }: { items: Mention[] }) {
  const list = items;
  if (!list.length) return <Empty>Nothing here for this period.</Empty>;
  return (
    <div className="flex flex-col gap-3">
      {list.slice(0, 4).map((m) => (
        <div key={m.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <SourceGlyph source={toMentionSource(m.source)} className="h-3.5 w-3.5" />
            {m.authorName || m.source}
            {m.rating != null ? <span className="text-primary">{m.rating.toFixed(1)}★</span> : null}
          </div>
          <p className="line-clamp-3 text-[12px] leading-relaxed text-slate-600">{m.excerpt}</p>
        </div>
      ))}
    </div>
  );
}

function AiVisibilitySection(s: ReportSnapshot, p: PropertyMeta): React.ReactNode {
  const a = s.aeoStats;
  if (!a || a.totalChecks === 0) {
    return <Empty>AI search visibility has not been checked for this property yet.</Empty>;
  }
  return (
    <Panel>
      <Card>
        <div className="flex items-center gap-2 text-[12.5px] font-bold text-foreground">
          <span className="inline-block h-3.5 w-1 rounded-sm bg-primary" />
          AI search visibility
          <span className="ml-auto rounded-full bg-primary px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-primary-foreground">
            LeaseStack exclusive
          </span>
        </div>
        <p className="my-3.5 text-[12px] leading-relaxed text-slate-600">
          {p.name} was cited in{" "}
          <b className="text-foreground">{a.cited} of {a.totalChecks}</b> AI answers (
          {pct((a.cited / a.totalChecks) * 100)}) across {a.enginesUsed.length} engines. Competitor properties appeared in {a.competitorCited}.
        </p>
        <div className="flex flex-col gap-2.5">
          {(a.byEngine ?? []).map((row) => (
            <div key={row.engine} className="flex items-center gap-2.5 text-[12px]">
              <span className="flex h-[17px] w-[17px] flex-none items-center justify-center">
                <EngineMark engine={row.engine} />
              </span>
              <span className="w-[80px] flex-none font-semibold text-foreground">{engineLabel(row.engine)}</span>
              <span className="flex h-3 flex-1 overflow-hidden rounded bg-muted">
                <span className="h-full bg-primary" style={{ width: `${row.total ? Math.round((row.cited / row.total) * 100) : 0}%` }} />
              </span>
              <span className="w-14 flex-none text-right font-semibold text-slate-600">{row.cited} / {row.total}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <SectionHeading>Who AI recommends instead</SectionHeading>
          {a.topCompetitors.length === 0 ? (
            <Empty>No competitors named.</Empty>
          ) : (
            <div className="flex flex-col gap-2 text-[12px]">
              {a.topCompetitors.slice(0, 8).map((c) => (
                <div key={c.name} className="flex justify-between font-medium text-slate-600">
                  <span>{c.name}</span>
                  <b className="font-bold text-foreground">{c.mentions}</b>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <SectionHeading>Sample lost queries</SectionHeading>
          {(a.sampleCompetitorQueries ?? []).length === 0 ? (
            <Empty>No sample queries captured.</Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {a.sampleCompetitorQueries.slice(0, 4).map((q, i) => (
                <div key={i} className="border-t border-border pt-3 text-[12px] first:border-0 first:pt-0">
                  <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                    <EngineMark engine={q.engine} />
                    <span className="truncate">{q.prompt}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">Cited: {q.competitors.join(", ")}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Panel>
  );
}

const PRIORITY_STYLE: Record<string, string> = {
  high: "border-destructive/30 bg-destructive/5 text-destructive",
  medium: "border-amber-500/30 bg-amber-500/5 text-amber-600",
  low: "border-border bg-elevated text-slate-600",
};

function InsightsSection(s: ReportSnapshot): React.ReactNode {
  const ai = s.aiAnalysis;
  const insights = s.insights ?? [];
  if (!ai && insights.length === 0) return <Empty>No insights generated for this period.</Empty>;
  return (
    <Panel>
      {ai?.summary ? (
        <Card>
          <SectionHeading meta="AI analysis">Executive summary</SectionHeading>
          <p className="text-[13px] leading-relaxed text-slate-600">{ai.summary}</p>
        </Card>
      ) : null}
      {ai?.actions?.length ? (
        <Card>
          <SectionHeading>Recommended actions</SectionHeading>
          <div className="flex flex-col gap-3">
            {ai.actions.map((act, i) => (
              <div key={i} className="rounded-xl border border-border bg-elevated p-4">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${PRIORITY_STYLE[act.priority] ?? PRIORITY_STYLE.low}`}>
                    {act.priority}
                  </span>
                  <span className="text-[13px] font-semibold text-foreground">{act.title}</span>
                </div>
                <p className="text-[12px] leading-relaxed text-slate-600">{act.observation}</p>
                <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-foreground">→ {act.action}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      {insights.length ? (
        <Card>
          <SectionHeading>Signals</SectionHeading>
          <div className="flex flex-col gap-2.5">
            {insights.map((ins) => (
              <div key={ins.id} className="flex gap-2.5 text-[12px]">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-none text-primary" aria-hidden="true" />
                <div>
                  <span className="font-semibold text-foreground">{ins.title}. </span>
                  <span className="text-slate-600">{ins.body}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </Panel>
  );
}

// --- tiny table cells -------------------------------------------------------

function Th({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return <th className={`px-3 py-2 font-semibold ${left ? "text-left" : "text-right"}`}>{children}</th>;
}
function Td({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return <td className={`px-3 py-2 ${left ? "text-left font-medium text-slate-600" : "text-right font-semibold text-foreground"} ${left ? "max-w-[220px] truncate" : ""}`}>{children}</td>;
}

// --- registry ---------------------------------------------------------------

export const SECTIONS: SectionDef[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    available: () => true,
    render: (s, p, navTo) => OverviewSection(s, p, navTo),
  },
  {
    id: "acquisition",
    label: "Acquisition",
    icon: Users,
    available: (s) =>
      (s.leadSources?.length ?? 0) > 0 ||
      (s.funnel?.length ?? 0) > 0 ||
      (s.chatbotStats?.conversations ?? 0) > 0 ||
      (s.kpis.identifiedVisitors ?? 0) > 0,
    render: (s) => AcquisitionSection(s),
  },
  {
    id: "traffic",
    label: "Traffic & SEO",
    icon: TrendingUp,
    available: (s) =>
      (s.trafficTrend?.length ?? 0) > 0 ||
      (s.topPages?.length ?? 0) > 0 ||
      (s.topQueries?.length ?? 0) > 0 ||
      (s.kpis.organicSessions ?? 0) > 0,
    render: (s) => TrafficSection(s),
  },
  {
    id: "ads",
    label: "Ads",
    icon: BarChart3,
    available: (s) => (s.adPerformance ?? []).some((a) => (a.spendUsd ?? 0) > 0),
    render: (s) => AdsSection(s),
  },
  {
    id: "leasing",
    label: "Leasing & Occupancy",
    icon: KeyRound,
    available: (s) => !!s.occupancyStats || !!s.lifecycleStats,
    render: (s) => LeasingSection(s),
  },
  {
    id: "renewals",
    label: "Renewals",
    icon: CalendarClock,
    available: (s) => {
      const r = s.renewalStats;
      return !!r && (r.expiringNext120 > 0 || r.activeLeases > 0 || r.pastDueCount > 0);
    },
    render: (s) => RenewalsSection(s),
  },
  {
    id: "reputation",
    label: "Reputation",
    icon: Star,
    available: (s) => (s.reputationStats?.totalReviews ?? 0) > 0,
    render: (s) => ReputationSection(s),
  },
  {
    id: "ai-visibility",
    label: "AI Visibility",
    icon: Sparkles,
    available: (s) => (s.aeoStats?.totalChecks ?? 0) > 0,
    render: (s, p) => AiVisibilitySection(s, p),
  },
  {
    id: "insights",
    label: "Insights",
    icon: Lightbulb,
    available: (s) => !!s.aiAnalysis || (s.insights?.length ?? 0) > 0,
    render: (s) => InsightsSection(s),
  },
];
