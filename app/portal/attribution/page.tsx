import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { SourceDonut } from "@/components/portal/attribution/donut";
import { TrendChart } from "@/components/portal/attribution/trend-chart";
import {
  getAttributionHeadline,
  getLeadsPerCity,
  getLeadsPerDeviceTrend,
  getLeadsPerModuleTrend,
  getLeadsPerSourceLastTouch,
  getLeadsPerSourceMultiTouch,
  getLeadsPerTouchFrequency,
  getSessionsPerSource,
  type AttributionFilters,
} from "@/lib/attribution/queries";
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
  searchParams: Promise<{ from?: string; to?: string; property?: string }>;
}) {
  const scope = await requireScope();
  const params = await searchParams;

  const { fromDate, toDate, fromIso, toIso } = parseDateRange(
    params.from,
    params.to
  );
  const propertyId = params.property?.trim() || null;

  const properties = await prisma.property.findMany({
    where: { orgId: scope.orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Validate the requested property belongs to the tenant. Falls back to
  // "all properties" silently if the id is bogus or cross-tenant.
  const activePropertyId =
    propertyId && properties.some((p) => p.id === propertyId)
      ? propertyId
      : null;

  const filters: AttributionFilters = {
    orgId: scope.orgId,
    propertyId: activePropertyId,
    fromDate,
    toDate,
  };

  const [
    headline,
    sessionsPerSource,
    leadsLastTouch,
    leadsMultiTouch,
    citySplit,
    deviceTrend,
    moduleTrend,
    touchFreq,
  ] = await Promise.all([
    getAttributionHeadline(filters),
    getSessionsPerSource(filters),
    getLeadsPerSourceLastTouch(filters),
    getLeadsPerSourceMultiTouch(filters),
    getLeadsPerCity(filters),
    getLeadsPerDeviceTrend(filters),
    getLeadsPerModuleTrend(filters),
    getLeadsPerTouchFrequency(filters),
  ]);

  const activeProperty = activePropertyId
    ? properties.find((p) => p.id === activePropertyId)
    : null;

  const dayCount = Math.round(
    (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)
  );

  // Build the trend chart series from the per-day buckets. Limit to the
  // top 5 sources so the line chart stays readable; everything else
  // collapses into "Other".
  const moduleSeries = buildModuleSeries(moduleTrend, 5);
  const moduleDates = moduleTrend.map((p) => p.date);

  const deviceDates = deviceTrend.map((p) => p.date);
  const deviceSeries = [
    {
      label: "Desktop",
      values: deviceTrend.map((p) => p.desktop),
    },
    {
      label: "Mobile",
      values: deviceTrend.map((p) => p.mobile),
    },
    {
      label: "Tablet",
      values: deviceTrend.map((p) => p.tablet),
    },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Attribution"
        description={`Lead and session attribution across every connected channel. Same surface as Clarity Attribution — included in your LeaseStack subscription.${
          activeProperty ? ` Filtered to ${activeProperty.name}.` : ""
        }`}
      />

      {/* Filter bar — compact inline row. Form-driven so the URL stays
          bookmarkable and the page is fully SSR. */}
      <form
        action="/portal/attribution"
        className="rounded-lg border border-border bg-card p-2 flex flex-wrap items-center gap-2"
      >
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
            From
          </span>
          <input
            type="date"
            name="from"
            defaultValue={fromIso}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
            To
          </span>
          <input
            type="date"
            name="to"
            defaultValue={toIso}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
        </label>
        <label className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground shrink-0">
            Property
          </span>
          <select
            name="property"
            defaultValue={activePropertyId ?? ""}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs min-w-0 flex-1"
          >
            <option value="">All properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-foreground text-background px-3 py-1 text-xs font-semibold hover:opacity-90"
        >
          Apply
        </button>
      </form>

      {/* Headline KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiTile
          label="Total leads"
          value={headline.totalLeads.toLocaleString()}
          hint={`Across ${dayCount} days`}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Sessions"
          value={headline.totalSessions.toLocaleString()}
          hint="From visitor pixel"
          icon={<MousePointerClick className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Identified visitors"
          value={headline.identifiedVisitors.toLocaleString()}
          hint="Resolved by name"
          icon={<Eye className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Unique modules"
          value={headline.modules.length.toLocaleString()}
          hint={`${headline.modules.length} active channels`}
          icon={<BarChart3 className="h-3.5 w-3.5" />}
        />
      </section>

      {/* Row 1: traffic sources */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SourceDonut
          title="Sessions per source"
          description="Where the visits came from. UTM tags first, then referrer hostname, then direct."
          palette="ink"
          slices={sessionsPerSource.map((s) => ({
            label: s.source,
            value: s.count,
          }))}
          totalLabel={`${headline.totalSessions.toLocaleString()} sessions`}
          emptyMessage="No tracked sessions in this window. Verify the visitor pixel is installed."
        />
        <SourceDonut
          title="Leads per source · multi-touch"
          description="Every channel that touched a lead before they converted. A lead seen by both google-ads and direct counts in both."
          palette="blue"
          slices={leadsMultiTouch.map((s) => ({
            label: s.source,
            value: s.count,
          }))}
          totalLabel={`${headline.totalLeads.toLocaleString()} leads`}
          emptyMessage="No leads in this window."
        />
      </section>

      {/* Row 2: lead breakdowns */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SourceDonut
          title="Lead customers per module type"
          description="Which capture surface created each lead — chatbot, form, ads, referral."
          palette="emerald"
          slices={headline.modules.map((m) => ({
            label: m.label,
            value: m.count,
          }))}
          totalLabel={`${headline.totalLeads.toLocaleString()} leads`}
          emptyMessage="No leads in this window."
        />
        <SourceDonut
          title="Leads per touch frequency"
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

      {/* Row 3: trends — side by side to use horizontal space */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TrendChart
          title="Leads per module type — daily"
          description="Daily lead volume by capture surface. Top 5 sources shown, rest collapsed into Other."
          dates={moduleDates}
          series={moduleSeries}
          totalEntries={headline.totalLeads}
          emptyMessage="No leads in this window."
        />
        <TrendChart
          title="Leads per device — daily"
          description="Daily lead volume by device class on the converting visitor's last session."
          dates={deviceDates}
          series={deviceSeries}
          totalEntries={headline.totalLeads}
          emptyMessage="No leads in this window."
        />
      </section>

      {/* Row 4: city split */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SourceDonut
          title="Leads per city · last-touch"
          description="Lead's resolved city from pixel enrichment (when available)."
          palette="violet"
          slices={citySplit.slice(0, 8).map((c) => ({
            label: c.city,
            value: c.count,
          }))}
          totalLabel={`${citySplit.reduce((s, c) => s + c.count, 0).toLocaleString()} located`}
          emptyMessage="No city-resolved leads in this window. Pixel enrichment fills this in as visitors are identified."
        />
        <SourceDonut
          title="Leads per source · last-touch"
          description="Just the final attributed channel — what Clarity calls 'last-touch attribution.'"
          palette="blue"
          slices={leadsLastTouch.map((m) => ({
            label: m.label,
            value: m.count,
          }))}
          totalLabel={`${headline.totalLeads.toLocaleString()} leads`}
          emptyMessage="No leads in this window."
        />
      </section>

      {/* Footer note — explicit positioning vs Clarity. */}
      <section className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2.5">
        <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          What you get with LeaseStack that Clarity can&apos;t deliver
        </p>
        <ul className="mt-1.5 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-foreground">
          <li>
            <Link
              href="/portal/visitors"
              className="font-semibold underline-offset-2 hover:underline"
            >
              Identified visitors →
            </Link>
            <p className="mt-0.5 text-muted-foreground leading-snug">
              Resolve the &ldquo;Direct&rdquo; bucket above into actual people
              with names, companies, and pages viewed.
            </p>
          </li>
          <li>
            <Link
              href="/portal/reputation"
              className="font-semibold underline-offset-2 hover:underline"
            >
              Reputation pulse →
            </Link>
            <p className="mt-0.5 text-muted-foreground leading-snug">
              Real-time scan of Google reviews, Reddit, Yelp so a parking
              complaint doesn&apos;t kill conversion next month.
            </p>
          </li>
          <li>
            <Link
              href="/portal/residents"
              className="font-semibold underline-offset-2 hover:underline"
            >
              Operations layer →
            </Link>
            <p className="mt-0.5 text-muted-foreground leading-snug">
              Residents, leases, work orders mirrored from AppFolio so the
              lead doesn&apos;t disappear at &ldquo;signed.&rdquo;
            </p>
          </li>
        </ul>
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
