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
import { Users, Eye, MousePointerClick, BadgeCheck } from "lucide-react";
import { getReverseAttribution, getChannelPipeline } from "@/lib/attribution/reverse";
import { type AttributionFilters } from "@/lib/attribution/queries";
import { fetchGa4SourceLandingVolumes } from "@/lib/attribution/ga4-sources";
import { ReverseAttributionView } from "@/components/portal/attribution/reverse-attribution-view";
import { ChannelPipelineTable } from "@/components/portal/attribution/channel-pipeline-table";
import { RangePresetControl } from "@/components/portal/attribution/range-preset-control";
import { StatusChip } from "@/components/portal/ui/status-chip";
import { getConnectStatusForOrg } from "@/lib/connect/status";

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

  const [reverse, pipeline, connectSources] = await Promise.all([
    (async () => {
      const ga4Landing = await fetchGa4SourceLandingVolumes(
        scope.orgId,
        fromDate,
        toDate,
      );
      return getReverseAttribution(filters, ga4Landing);
    })(),
    getChannelPipeline(filters),
    // Same derivation the Connect hub uses (one integration row with a bound
    // pixel = connected), so the chip below always agrees with /portal/connect.
    getConnectStatusForOrg(scope.orgId),
  ]);

  const pixelConnected =
    connectSources.find((s) => s.id === "cursive_pixel")?.connected ?? false;

  const totalLeads = pipeline.reduce((s, r) => s + r.leads, 0);
  const totalSigned = pipeline.reduce((s, r) => s + r.signed, 0);

  const dayCount = Math.round(
    (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000),
  );

  return (
    <div className="space-y-3 ls-page-fade">
      <PageHeader
        title="Reverse Attribution"
        description="Trace every web visitor back to the site they came from, the page they landed on, and whether they toured, applied, or signed — blended from GA4 + your visitor pixel."
        actions={
          <PropertyMultiSelect properties={properties} orgId={scope.orgId} />
        }
      />

      {/* Shared preset range control — same Carbon chip group as
          /portal/attribution and the dashboard. */}
      <div className="ls-card flex flex-wrap items-center gap-3 p-2.5">
        <RangePresetControl
          basePath="/portal/reverse-attribution"
          activeDays={dayCount}
          properties={params.properties}
        />
      </div>

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

      {/* Identity-resolution state. Previously a dead-end explainer with no
          exit; now an explicit StatusChip + a direct path to /portal/connect. */}
      {!pixelConnected ? (
        <div className="ls-card flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
          <StatusChip
            status="not_connected"
            label="Identity resolution · Not connected"
          />
          <span className="text-[11px] leading-relaxed text-muted-foreground">
            Pixel identity resolution is off for this workspace, so individual
            visits aren&apos;t matched to names yet. Channel-level reverse
            attribution below still works from referrers, UTMs, and PMS-synced
            (AppFolio) leads.
          </span>
          <Link
            href="/portal/connect"
            className="ml-auto text-[11px] font-semibold text-primary underline-offset-2 hover:underline"
          >
            Enable identity resolution
          </Link>
        </div>
      ) : reverse.identifiedCount === 0 ? (
        <div className="ls-card flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
          <StatusChip status="live" label="Identity resolution · Live" />
          <span className="text-[11px] leading-relaxed text-muted-foreground">
            No visits were identified in this window yet. Resolved visitors
            appear here as the pixel matches traffic to people.
          </span>
        </div>
      ) : null}

      <ReverseAttributionView
        sources={reverse.graph.sources}
        landings={reverse.graph.landings}
        outcomes={reverse.graph.outcomes}
        links={reverse.graph.links}
        resolutions={reverse.resolutions}
      />

      <SectionCard
        label="Channel pipeline"
        description={
          <>
            Every lead reverse-attributed to a channel (via referrer, then
            email-matched pixel resolution), with the tour → apply → sign
            funnel by channel. This is how the &ldquo;Other&rdquo; bucket gets
            broken down.
          </>
        }
      >
        <ChannelPipelineTable rows={pipeline} />
      </SectionCard>
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
