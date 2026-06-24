import type { Metadata } from "next";
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
import { PageHeader } from "@/components/admin/page-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { Users, Eye, MousePointerClick, BadgeCheck } from "lucide-react";
import { getReverseAttribution, getChannelPipeline } from "@/lib/attribution/reverse";
import { type AttributionFilters } from "@/lib/attribution/queries";
import { fetchGa4SourceLandingVolumes } from "@/lib/attribution/ga4-sources";
import { ReverseAttributionView } from "@/components/portal/attribution/reverse-attribution-view";
import { ChannelPipelineTable } from "@/components/portal/attribution/channel-pipeline-table";

export const metadata: Metadata = { title: "Reverse Attribution" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/reverse-attribution — full reverse attribution for web traffic.
//   1. Reverse flow graph: source → landing page → outcome (GA4 + pixel)
//   2. Identified-visit resolutions table (Cursive-style)
//   3. Channel pipeline: every lead reverse-attributed to a channel, with the
//      tour → apply → sign funnel bucketed by channel.
// ---------------------------------------------------------------------------

export default async function ReverseAttributionPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    properties?: string;
  }>;
}) {
  const gate = await requireModule("moduleAttribution");
  if (gate) return gate;

  const scope = await requireScope();
  const params = await searchParams;
  const { fromDate, toDate } = parseDateRange(params.from, params.to);
  const requestedIds = await parsePropertyFilter(params, scope.orgId);

  const allProperties = await prisma.property.findMany({
    where: marketablePropertyWhere(scope.orgId),
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const properties = visibleProperties(scope, allProperties);

  const tenantValid = (requestedIds ?? []).filter((id) =>
    allProperties.some((p) => p.id === id),
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

  const [reverse, pipeline] = await Promise.all([
    (async () => {
      const ga4Landing = await fetchGa4SourceLandingVolumes(
        scope.orgId,
        fromDate,
        toDate,
      );
      return getReverseAttribution(filters, ga4Landing);
    })(),
    getChannelPipeline(filters),
  ]);

  const totalLeads = pipeline.reduce((s, r) => s + r.leads, 0);
  const totalSigned = pipeline.reduce((s, r) => s + r.signed, 0);

  return (
    <div className="space-y-3 ls-page-fade">
      <PageHeader
        title="Reverse Attribution"
        description="Trace every web visitor back to the site they came from, the page they landed on, and whether they toured, applied, or signed — blended from GA4 + your visitor pixel."
        actions={
          <PropertyMultiSelect properties={properties} orgId={scope.orgId} />
        }
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        <KpiTile
          label="Tracked sessions"
          value={reverse.totalSessions.toLocaleString()}
          hint="GA4 + visitor pixel"
          icon={<MousePointerClick className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Identified visits"
          value={reverse.identifiedCount.toLocaleString()}
          hint="Resolved by the pixel"
          icon={<Eye className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Attributed leads"
          value={totalLeads.toLocaleString()}
          hint="Matched to a channel"
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Signed"
          value={totalSigned.toLocaleString()}
          hint="Across all channels"
          icon={<BadgeCheck className="h-3.5 w-3.5" />}
        />
      </section>

      <ReverseAttributionView
        sources={reverse.graph.sources}
        landings={reverse.graph.landings}
        outcomes={reverse.graph.outcomes}
        links={reverse.graph.links}
        resolutions={reverse.resolutions}
      />

      <section className="ls-card p-4">
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-foreground">
            Channel pipeline
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every lead reverse-attributed to a channel (via referrer, then
            email-matched pixel resolution), with the tour → apply → sign funnel
            by channel. This is how the &ldquo;Other&rdquo; bucket gets broken
            down.
          </p>
        </div>
        <ChannelPipelineTable rows={pipeline} />
      </section>
    </div>
  );
}

function parseDateRange(
  fromRaw?: string,
  toRaw?: string,
): { fromDate: Date; toDate: Date } {
  const today = new Date();
  const defaultFrom = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = parseIsoDate(fromRaw) ?? defaultFrom;
  const to = parseIsoDate(toRaw) ?? today;
  const maxRange = 365 * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxRange) {
    return { fromDate: defaultFrom, toDate: today };
  }
  const fromUtc = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  const toUtc = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 23, 59, 59),
  );
  return { fromDate: fromUtc, toDate: toUtc };
}

function parseIsoDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}
