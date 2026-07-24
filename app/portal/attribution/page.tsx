import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { requireModule } from "@/lib/portal/module-gate";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  effectivePropertyIds,
  parsePropertyFilter,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { SourceDonut } from "@/components/portal/attribution/donut";
import { TrendChart } from "@/components/portal/attribution/trend-chart";
import {
  getAttributionHeadline,
  getLeadFlow,
  getLeadsPerCity,
  getLeadsPerModuleTrend,
  getLeadsPerTouchFrequency,
  type AttributionFilters,
} from "@/lib/attribution/queries";
import { fetchGa4SourceVolumes } from "@/lib/attribution/ga4-sources";
import { LeadFlowDiagram } from "@/components/portal/attribution/lead-flow-diagram";
import { SourceLogo } from "@/components/portal/attribution/source-logo";
import { RangePresetControl } from "@/components/portal/attribution/range-preset-control";
import { StatusChip } from "@/components/portal/ui/status-chip";
import { getConnectStatusForOrg } from "@/lib/connect/status";
import { Users, Eye, MousePointerClick, BarChart3 } from "lucide-react";

export const metadata: Metadata = { title: "Attribution" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/attribution — direct competitor surface to Clarity Attribution.
//
// Mirrors the seven charts Clarity charges $5–10k/property/month for, but
// pulls every value from real LeaseStack data — VisitorSession utm /
// referrer parsing, Lead.source enum, AL enrichment for city, userAgent
// for device. No mocks, no seeds. Empty windows render honest empty
// states.
//
// Filters: ?from=YYYY-MM-DD&to=YYYY-MM-DD&property=<id>. Defaults to the
// trailing 30 days across all properties. Date-range parser is
// permissive — bad input falls back to defaults.
// ---------------------------------------------------------------------------

export default async function AttributionPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    property?: string;
    properties?: string;
  }>;
}) {
  const gate = await requireModule("moduleAttribution");
  if (gate) return gate;

  const scope = await requireScope();
  const params = await searchParams;

  const { fromDate, toDate, fromIso, toIso } = parseDateRange(
    params.from,
    params.to
  );
  const requestedIds = await parsePropertyFilter(params, scope.orgId);

  const allProperties = await prisma.property.findMany({
    where: marketablePropertyWhere(scope.orgId),
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const properties = visibleProperties(scope, allProperties);

  // Two-step gate:
  //   1. Drop any requested id that doesn't belong to this tenant
  //      (defense against URL-tampered ids from another org).
  //   2. Intersect with the user's allowed property set via
  //      effectivePropertyIds(); restricted users get their full
  //      allowed list as the default, not the org's full set.
  //
  // Critical: a restricted user whose URL gates to an empty set must
  // fall back to their FULL allowed set, not null. Passing null to
  // queries.ts would mean "no filter" = see every property in the org,
  // which would defeat the entire access gate.
  const tenantValid = (requestedIds ?? []).filter((id) =>
    allProperties.some((p) => p.id === id)
  );
  const gatedIds = effectivePropertyIds(
    scope,
    tenantValid.length > 0 ? tenantValid : null,
  );
  const activePropertyIds =
    gatedIds && gatedIds.length > 0
      ? gatedIds
      : scope.allowedPropertyIds && scope.allowedPropertyIds.length > 0
        ? scope.allowedPropertyIds
        : null;

  const filters: AttributionFilters = {
    orgId: scope.orgId,
    propertyIds: activePropertyIds,
    fromDate,
    toDate,
  };

  const [headline, leadFlow, citySplit, moduleTrend, touchFreq, connectSources] =
    await Promise.all([
      getAttributionHeadline(filters),
      // Flow hero — folds in GA4 source volumes (best-effort; null if GA4 isn't
      // connected or slow, in which case it degrades to pixel-only).
      (async () => {
        const ga4Sessions = await fetchGa4SourceVolumes(
          scope.orgId,
          fromDate,
          toDate,
        );
        return getLeadFlow(filters, ga4Sessions);
      })(),
      getLeadsPerCity(filters),
      getLeadsPerModuleTrend(filters),
      getLeadsPerTouchFrequency(filters),
      // Feed-state chips — same derivation the Connect hub uses (one
      // integration row = connected), so "Live" here always agrees with
      // /portal/connect.
      getConnectStatusForOrg(scope.orgId),
    ]);

  const ga4Connected =
    connectSources.find((s) => s.id === "ga4")?.connected ?? false;
  const pixelConnected =
    connectSources.find((s) => s.id === "cursive_pixel")?.connected ?? false;

  // Used in the page header description. When exactly one property is
  // selected we name it; when multiple are selected we just say how many.
  const activeProperty =
    activePropertyIds && activePropertyIds.length === 1
      ? properties.find((p) => p.id === activePropertyIds[0]) ?? null
      : null;

  const dayCount = Math.round(
    (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)
  );

  // Build the trend chart series from the per-day buckets. Limit to the
  // top 5 sources so the line chart stays readable; everything else
  // collapses into "Other".
  const moduleSeries = buildModuleSeries(moduleTrend, 5);
  const moduleDates = moduleTrend.map((p) => p.date);

  return (
    <div className="space-y-3 ls-page-fade">
      <PageHeader
        title="Attribution"
        description={`Lead and session attribution across every connected channel.${
          activeProperty
            ? ` Filtered to ${activeProperty.name}.`
            : activePropertyIds
              ? ` Filtered to ${activePropertyIds.length} properties.`
              : ""
        }`}
        actions={
          <PropertyMultiSelect properties={properties} orgId={scope.orgId} />
        }
      />

      {/* Feed-state row — attribution silently degrades when GA4 or the
          visitor pixel is missing (sessions undercount, identities blank).
          Make the state explicit instead of letting charts read as broken. */}
      <div className="ls-card flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        <span className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-foreground">
            Google Analytics 4
          </span>
          <StatusChip status={ga4Connected ? "live" : "not_connected"} />
        </span>
        <span aria-hidden="true" className="h-4 w-px bg-border" />
        <span className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-foreground">
            Visitor pixel
          </span>
          <StatusChip status={pixelConnected ? "live" : "not_connected"} />
        </span>
        {!ga4Connected || !pixelConnected ? (
          <Link
            href="/portal/connect"
            className="ml-auto text-[11px] font-semibold text-primary underline-offset-2 hover:underline"
          >
            Connect data sources
          </Link>
        ) : null}
      </div>

      {/* Filter bar — shared preset range control (same Carbon chip group as
          the dashboard) + custom date form for non-standard windows. */}
      <div className="ls-card p-2.5 flex flex-wrap items-center gap-3">
        <RangePresetControl
          basePath="/portal/attribution"
          activeDays={dayCount}
          properties={params.properties}
        />

        {/* Divider */}
        <span aria-hidden="true" className="h-4 w-px bg-border" />

        {/* Custom date form — for non-standard windows */}
        <form
          action="/portal/attribution"
          className="flex flex-wrap items-center gap-2"
        >
          {params.properties ? (
            <input type="hidden" name="properties" value={params.properties} />
          ) : null}
          <label className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold tracking-widest uppercase text-muted-foreground shrink-0">
              From
            </span>
            <input
              type="date"
              name="from"
              defaultValue={fromIso}
              className="rounded-[2px] border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold tracking-widest uppercase text-muted-foreground shrink-0">
              To
            </span>
            <input
              type="date"
              name="to"
              defaultValue={toIso}
              className="rounded-[2px] border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-none bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            Apply
          </button>
        </form>
      </div>

      {/* Headline KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        <KpiTile
          label="Total leads"
          value={headline.totalLeads.toLocaleString()}
          hint={`${leadFlow.totalLeads.toLocaleString()} attributed · ${leadFlow.imported.leads.toLocaleString()} imported`}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Sessions"
          value={leadFlow.totalSessions.toLocaleString()}
          hint="GA4 + visitor pixel"
          icon={<MousePointerClick className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Identified visitors"
          value={headline.identifiedVisitors.toLocaleString()}
          hint="Resolved by name"
          icon={<Eye className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Source channels"
          value={leadFlow.sources.length.toLocaleString()}
          hint="Distinct traffic sources"
          icon={<BarChart3 className="h-3.5 w-3.5" />}
        />
      </section>

      {/* Flow hero — the headline visualization: where leads flow in from. */}
      <LeadFlowDiagram
        sources={leadFlow.sources}
        stages={leadFlow.stages}
        totalLeads={leadFlow.totalLeads}
        totalSessions={leadFlow.totalSessions}
        imported={leadFlow.imported}
      />

      {/* Traffic & lead sources — the GA4-driven logo board. Real platform
          logos, sessions blended from GA4 + pixel, leads, and conversion. This
          replaces the old wall of look-alike donuts. */}
      {leadFlow.sources.length > 0 ? (
        <SectionCard
          label="Traffic & lead sources"
          description="The sites visitors came from before yours. Sessions blended from GA4 + visitor pixel · conversion = leads ÷ sessions."
          action={
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0 pl-3">
              {leadFlow.sources.length} channels
            </span>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0.5">
            {leadFlow.sources.slice(0, 12).map((s) => {
              const max = Math.max(
                1,
                ...leadFlow.sources.map((x) => Math.max(x.leads, x.sessions)),
              );
              const barVal = Math.max(s.leads, s.sessions);
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0"
                >
                  <SourceLogo logo={s.id} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-foreground truncate">
                        {s.label}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground shrink-0">
                        {s.sessions > 0
                          ? `${s.sessions.toLocaleString()} sess`
                          : ""}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-muted overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${Math.max((barVal / max) * 100, barVal > 0 ? 3 : 0)}%`,
                          background: s.color,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0 w-16">
                    <div className="font-mono text-sm font-semibold tabular-nums text-foreground leading-none">
                      {s.leads.toLocaleString()}
                    </div>
                    <div className="font-mono text-[10px] tabular-nums text-muted-foreground mt-0.5">
                      {s.conversionRate !== null
                        ? `${(s.conversionRate * 100).toFixed(1)}%`
                        : "leads"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      ) : null}

      {/* Capture surface + nurture depth — two purposeful breakdowns. */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SourceDonut
          title="Leads by capture surface"
          description="Which LeaseStack surface created each lead — chatbot, form, ads, referral. Imported/unattributed excluded."
          palette="emerald"
          slices={headline.modules
            .filter((m) => !["Other", "Manual entry"].includes(m.label))
            .map((m) => ({
              label: m.label,
              value: m.count,
            }))}
          totalLabel={`${leadFlow.totalLeads.toLocaleString()} leads`}
          emptyMessage="No attributed leads in this window."
        />
        <SourceDonut
          title="Touch frequency"
          description="How many sessions each lead had before converting. Higher = more nurture needed."
          palette="amber"
          slices={touchFreq
            .filter((b) => b.count > 0)
            .map((b) => ({
              label: `${b.bucket} ${b.bucket === "1" ? "touch" : "touches"}`,
              value: b.count,
            }))}
          totalLabel={`${headline.totalLeads.toLocaleString()} leads`}
          emptyMessage="No leads in this window."
        />
      </section>

      {/* Trends + geography. */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TrendChart
          title="Leads by source — daily"
          description="Daily lead volume by channel. Top 5 shown, rest collapsed into Other."
          dates={moduleDates}
          series={moduleSeries}
          totalEntries={headline.totalLeads}
          emptyMessage="No leads in this window."
        />
        <SourceDonut
          title="Leads by city"
          description="Lead's resolved city from pixel enrichment (when available)."
          palette="violet"
          slices={citySplit.slice(0, 8).map((c) => ({
            label: c.city,
            value: c.count,
          }))}
          totalLabel={`${citySplit.reduce((s, c) => s + c.count, 0).toLocaleString()} located`}
          emptyMessage="No city-resolved leads yet. Enrichment fills this in as visitors are identified."
        />
      </section>

    </div>
  );
}

// Pulls top N sources from the per-day trend points and collapses the
// rest into "Other" so the line chart doesn't render 12 colors.
function buildModuleSeries(
  trend: Array<{ date: string; bySource: Record<string, number> }>,
  topN: number
): Array<{ label: string; values: number[] }> {
  // Compute totals per source across the window so we know which to keep.
  const totals = new Map<string, number>();
  for (const point of trend) {
    for (const [source, count] of Object.entries(point.bySource)) {
      totals.set(source, (totals.get(source) ?? 0) + count);
    }
  }
  const ranked = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([source]) => source);
  const kept = new Set(ranked.slice(0, topN));
  const collapsed = ranked.slice(topN);

  const series: Array<{ label: string; values: number[] }> = [];
  for (const source of kept) {
    series.push({
      label: source,
      values: trend.map((p) => p.bySource[source] ?? 0),
    });
  }
  if (collapsed.length > 0) {
    series.push({
      label: "Other",
      values: trend.map((p) =>
        collapsed.reduce((sum, s) => sum + (p.bySource[s] ?? 0), 0),
      ),
    });
  }
  return series;
}

// Date-range parser. Permissive: bad input → trailing-30-day default
// instead of throwing. Always returns dates in UTC midnight so the day
// buckets line up across timezones.
function parseDateRange(
  fromRaw?: string,
  toRaw?: string
): { fromDate: Date; toDate: Date; fromIso: string; toIso: string } {
  const today = new Date();
  const defaultFrom = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const from = parseIsoDate(fromRaw) ?? defaultFrom;
  const to = parseIsoDate(toRaw) ?? today;

  // Clamp to ≤ 365 days so the queries don't blow out on accidental input.
  const maxRange = 365 * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxRange) {
    return parseDateRange(undefined, undefined);
  }
  // Set to UTC midnight for the day buckets.
  const fromUtc = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  );
  const toUtc = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 23, 59, 59)
  );
  return {
    fromDate: fromUtc,
    toDate: toUtc,
    fromIso: toIsoDay(fromUtc),
    toIso: toIsoDay(toUtc),
  };
}

function parseIsoDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function toIsoDay(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
