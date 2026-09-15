import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { ConversionFunnel } from "@/components/portal/dashboard/conversion-funnel";
import { SourceBars } from "@/components/portal/dashboard/source-bars";
import { getPropertyLeads } from "@/lib/properties/queries";
import { prisma } from "@/lib/db";
import { LeadStatus, ApplicationStatus, type Lead } from "@prisma/client";
import { leadDisplayName } from "@/lib/leads/display-name";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { SectionCard } from "@/components/admin/page-header";

// Bug #30 — Operators reported the leads tab "doesn't show most of the
// active prospects which are in ongoing processes." The 28d funnel
// is a marketing snapshot, but the operator's actual ask is the
// ALL-TIME pipeline state — every prospect not yet signed or lost
// grouped by where they are in the funnel, plus the pending
// applications and recent activity. The two sections added below
// surface that view alongside the existing 28d marketing snapshot.

const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  TOUR_SCHEDULED: "Tour scheduled",
  TOURED: "Toured",
  APPLICATION_SENT: "Application sent",
  APPLIED: "Applied",
  APPROVED: "Approved",
  SIGNED: "Signed",
  LOST: "Lost",
  UNQUALIFIED: "Unqualified",
};

// Statuses that represent active, in-flight prospects (not yet signed
// and not given up on). These build the pipeline view below.
const ACTIVE_STATUSES: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.TOUR_SCHEDULED,
  LeadStatus.TOURED,
  LeadStatus.APPLICATION_SENT,
  LeadStatus.APPLIED,
  LeadStatus.APPROVED,
];

export async function LeadsTab({
  orgId,
  propertyId,
  propertyMeta,
}: {
  orgId: string;
  propertyId: string;
  propertyMeta: { slug: string; name: string };
}) {
  const [data, activePipelineRows, pendingApps, recentActivity] =
    await Promise.all([
      getPropertyLeads(orgId, propertyId, propertyMeta),
      prisma.lead.groupBy({
        by: ["status"],
        where: {
          orgId,
          propertyId,
          status: { in: ACTIVE_STATUSES },
        },
        _count: { _all: true },
      }),
      prisma.application.count({
        where: {
          lead: { orgId, propertyId },
          status: {
            in: [ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW],
          },
        },
      }),
      // Pull the 8 most-recently-updated active leads — anchors the
      // "what's live right now" panel below the funnel.
      prisma.lead.findMany({
        where: {
          orgId,
          propertyId,
          status: { in: ACTIVE_STATUSES },
        },
        orderBy: { lastActivityAt: "desc" },
        take: 8,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          source: true,
          lastActivityAt: true,
          createdAt: true,
        },
      }),
    ]);

  const leadsCount = data.funnel.find((s) => s.label === "Leads")?.value ?? 0;
  const toursCount = data.funnel.find((s) => s.label === "Tours")?.value ?? 0;
  const appsCount = data.funnel.find((s) => s.label === "Applications")?.value ?? 0;

  // Active pipeline counts in display order. Includes statuses with
  // 0 so the operator sees the full shape even when a stage is empty.
  const pipelineCounts = ACTIVE_STATUSES.map((status) => ({
    status,
    count:
      activePipelineRows.find((r) => r.status === status)?._count._all ?? 0,
  }));
  const totalActive = pipelineCounts.reduce((s, p) => s + p.count, 0);

  return (
    <div className="space-y-6">
      {/* Acquisition snapshot. Was a bespoke 5-across strip in a rounded-xl
          card with a mono blue header band; now the same KpiTile the Leasing
          tab and the dashboard use, so a row of stats reads the same way
          everywhere on this page. */}
      <section>
        <p className="ls-eyebrow mb-2">Acquisition · last 28 days</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiTile density="dense" label="Leads" value={leadsCount.toLocaleString()} />
          <KpiTile density="dense" label="Tours" value={toursCount.toLocaleString()} />
          <KpiTile density="dense" label="Applications" value={appsCount.toLocaleString()} />
          <KpiTile
            density="dense"
            label="In flight"
            value={totalActive.toLocaleString()}
            hint="Not signed / lost"
          />
          <KpiTile
            density="dense"
            label="Pending apps"
            value={pendingApps.toLocaleString()}
            hint="Submitted"
          />
        </div>
      </section>

      {/* Pipeline funnel. Stays a left-to-right sequence (a funnel is not a
          KPI row) but speaks the same type language as the strip above:
          .ls-eyebrow labels, .ls-metric figures, hairline dividers. Dropped
          the chevron SVGs, the bg-secondary/bg-card alternation that made
          empty stages look disabled, and the rounded-xl radius. */}
      <SectionCard
        label={`Active pipeline · ${totalActive} in flight`}
        action={
          <Link
            href={`/portal/leads?status_in=${ACTIVE_STATUSES.join(",")}&property=${propertyId}`}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            See full pipeline →
          </Link>
        }
      >
        <ol className="flex items-stretch overflow-x-auto divide-x divide-[var(--hair)]">
          {pipelineCounts.map((p) => (
            <li key={p.status} className="flex-1 min-w-[110px]">
              <Link
                href={`/portal/leads?status=${p.status}&property=${propertyId}`}
                className="group block px-3 py-1 transition-colors hover:bg-[var(--accent-wash)]"
              >
                <p className="ls-eyebrow truncate">{STATUS_LABEL[p.status]}</p>
                <p
                  className={`ls-metric ls-metric-md mt-1 ${
                    p.count > 0 ? "" : "text-muted-foreground/50"
                  }`}
                >
                  {p.count.toLocaleString()}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      </SectionCard>

      {/* Bug #30 — Recent active prospects. Operator wanted to see
          who's actively being worked, not just the marketing intake.
          This panel surfaces the 8 most-recently-active in-flight
          leads with their current stage + contact info, with a
          one-click jump to the lead detail. */}
      {recentActivity.length > 0 ? (
        <DashboardSection
          title="Recent activity — active prospects"
          eyebrow={`Top ${recentActivity.length}`}
          href={`/portal/leads?status_in=${ACTIVE_STATUSES.join(",")}&property=${propertyId}`}
          hrefLabel="See full pipeline"
        >
          <ul className="divide-y divide-border">
            {recentActivity.map((lead: Pick<Lead, "id" | "firstName" | "lastName" | "email" | "phone" | "status" | "source" | "lastActivityAt" | "createdAt">) => {
              const name = leadDisplayName(lead);
              const lastSeenAt = lead.lastActivityAt ?? lead.createdAt;
              return (
                <li key={lead.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    href={`/portal/leads/${lead.id}`}
                    className="flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate group-hover:underline">
                          {name}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground px-1.5 py-0.5 bg-secondary rounded">
                          {STATUS_LABEL[lead.status]}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {[lead.source, lead.email, lead.phone]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDistanceToNow(lastSeenAt, { addSuffix: true })}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </DashboardSection>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DashboardSection
          title="Conversion funnel"
          eyebrow="Last 28 days"
          description="Visitors scoped by URL match on property slug"
        >
          {data.funnel.every((s) => s.value === 0 || s.notApplicable === true) ? (
            <p className="text-xs text-muted-foreground">
              No activity in the last 28 days yet.
            </p>
          ) : (
            <ConversionFunnel stages={data.funnel} />
          )}
        </DashboardSection>

        <DashboardSection
          title="Lead sources"
          eyebrow="Last 28 days"
          description="Where this property's leads originate"
        >
          <SourceBars
            rows={data.sourceBreakdown.map((s) => ({
              label: s.source,
              value: s.count,
            }))}
          />
        </DashboardSection>
      </div>

      <DashboardSection
        title="Recent leads"
        eyebrow="Latest 10"
        href="/portal/leads"
        hrefLabel="All leads"
      >
        {data.recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No leads have been recorded for this property yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.recent.map((lead) => {
              const name = leadDisplayName(lead);
              return (
                <li key={lead.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    href={`/portal/leads/${lead.id}`}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {name}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {lead.source}
                        {lead.email ? ` \u00b7 ${lead.email}` : ""}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(lead.createdAt, { addSuffix: true })}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
