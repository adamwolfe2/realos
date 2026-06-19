import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { requireModule } from "@/lib/portal/module-gate";
import { parsePropertyFilter, visibleProperties } from "@/lib/tenancy/property-filter";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { getPortfolioFunnel, sourceLabel } from "@/lib/reports/portfolio-funnel";
import { PageHeader } from "@/components/admin/page-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { Users, UserPlus, CalendarCheck, FileText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Portfolio funnel" };
export const dynamic = "force-dynamic";

const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

const STAGE_ICON = {
  traffic: <Users className="h-4 w-4" />,
  leads: <UserPlus className="h-4 w-4" />,
  tours: <CalendarCheck className="h-4 w-4" />,
  applications: <FileText className="h-4 w-4" />,
} as const;

function statusLabel(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}

export default async function PortfolioFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; property?: string; properties?: string }>;
}) {
  const gate = await requireModule("moduleInsights");
  if (gate) return gate;

  const scope = await requireScope();
  const sp = await searchParams;
  const periodDays = PERIODS.some((p) => String(p.days) === sp.days) ? Number(sp.days) : 30;

  const allProperties = await prisma.property.findMany({
    where: marketablePropertyWhere(scope.orgId),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const visible = visibleProperties(scope, allProperties);
  const visibleIds = visible.map((p) => p.id);
  const filter = await parsePropertyFilter(sp, scope.orgId);
  const isFullAccess = visible.length === allProperties.length;

  // Portfolio-wide (org scope, includes unattributed traffic) only when the
  // viewer can see everything AND hasn't narrowed to a property. Otherwise
  // scope to the in-access, in-filter property set.
  const propertyIds: string[] | null =
    filter === null && isFullAccess
      ? null
      : (filter ?? visibleIds).filter((id) => visibleIds.includes(id));

  const funnel = await getPortfolioFunnel({ orgId: scope.orgId, propertyIds, periodDays });
  const { stages, toursCompleted, sources, appStatus, byProperty } = funnel;
  const maxSource = sources[0]?.count ?? 1;
  const hasData = stages.some((s) => s.value > 0);

  const periodQS = (days: number) => {
    const params = new URLSearchParams();
    params.set("days", String(days));
    if (sp.property) params.set("property", sp.property);
    if (sp.properties) params.set("properties", sp.properties);
    return `?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio funnel"
        description="Traffic to applications across every property — the one-page roll-up to share with managers."
        actions={
          <Suspense fallback={<div className="h-9 w-64 animate-pulse rounded bg-neutral-100" />}>
            <PropertyMultiSelect properties={visible} orgId={scope.orgId} />
          </Suspense>
        }
      />

      <div className="flex items-center gap-1.5">
        {PERIODS.map((p) => (
          <Link
            key={p.days}
            href={periodQS(p.days)}
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-semibold ring-1 ring-inset transition",
              p.days === periodDays
                ? "bg-primary text-white ring-primary"
                : "bg-white text-muted-foreground ring-border hover:ring-primary/40",
            )}
          >
            Last {p.label}
          </Link>
        ))}
      </div>

      {/* Funnel strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stages.map((stage, i) => (
          <div key={stage.key} className="relative">
            <KpiTile
              label={stage.label}
              value={stage.value.toLocaleString()}
              hint={
                stage.conversionFromPrev != null
                  ? `${stage.conversionFromPrev}% of ${stages[i - 1].label.toLowerCase()}`
                  : stage.key === "tours" && toursCompleted > 0
                    ? `${toursCompleted.toLocaleString()} completed`
                    : "top of funnel"
              }
              icon={STAGE_ICON[stage.key]}
              variant={i === 0 ? "accent" : "default"}
            />
            {i < stages.length - 1 ? (
              <ChevronRight
                className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 text-muted-foreground/50 lg:block"
                aria-hidden="true"
              />
            ) : null}
          </div>
        ))}
      </div>

      {!hasData ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No funnel activity in this window"
          body="Once traffic, leads, tours, and applications come in, the portfolio roll-up shows up here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
          {/* Lead sources */}
          <section className="ls-card p-5">
            <h2 className="mb-4 text-[13px] font-semibold text-foreground">Leads by source</h2>
            {sources.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">No leads in this window.</p>
            ) : (
              <ul className="space-y-2.5">
                {sources.map((s) => (
                  <li key={s.source} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-[13px] text-foreground">
                      {sourceLabel(s.source)}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/80"
                        style={{ width: `${Math.max(4, (s.count / maxSource) * 100)}%` }}
                      />
                    </div>
                    <span className="ls-metric w-8 shrink-0 text-right text-[12px] text-muted-foreground">
                      {s.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {appStatus.length > 0 ? (
              <>
                <h2 className="mb-3 mt-6 text-[13px] font-semibold text-foreground">
                  Applications by status
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {appStatus.map((a) => (
                    <span
                      key={a.status}
                      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[12px] text-foreground"
                    >
                      {statusLabel(a.status)}
                      <span className="ls-metric text-muted-foreground">{a.count}</span>
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </section>

          {/* Per-property table */}
          <section className="ls-card p-5">
            <h2 className="mb-4 text-[13px] font-semibold text-foreground">By property</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3 font-semibold">Property</th>
                    <th className="pb-2 px-2 text-right font-semibold">Traffic</th>
                    <th className="pb-2 px-2 text-right font-semibold">Leads</th>
                    <th className="pb-2 px-2 text-right font-semibold">Tours</th>
                    <th className="pb-2 pl-2 text-right font-semibold">Apps</th>
                  </tr>
                </thead>
                <tbody>
                  {byProperty.map((row) => (
                    <tr key={row.propertyId} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 font-medium text-foreground">
                        <Link
                          href={`/portal/properties/${row.propertyId}`}
                          className="hover:text-primary hover:underline"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="ls-metric px-2 py-2 text-right text-muted-foreground">{row.visitors}</td>
                      <td className="ls-metric px-2 py-2 text-right text-muted-foreground">{row.leads}</td>
                      <td className="ls-metric px-2 py-2 text-right text-muted-foreground">{row.tours}</td>
                      <td className="ls-metric py-2 pl-2 text-right font-semibold text-foreground">
                        {row.applications}
                      </td>
                    </tr>
                  ))}
                  {byProperty.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-[12px] text-muted-foreground">
                        No per-property activity in this window.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
              Traffic is counted at the portfolio level; visits the pixel hasn’t
              tied to a specific property aren’t split into the rows above, so
              per-property traffic can read lower than the headline total.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
