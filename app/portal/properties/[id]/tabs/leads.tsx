import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { getPropertyLeads } from "@/lib/properties/queries";
import { prisma } from "@/lib/db";
import { LeadStatus, type Lead } from "@prisma/client";
import { leadDisplayName } from "@/lib/leads/display-name";
import { SourceList, SourceMark } from "@/components/portal/source-mark";
import { buildSourceFlow } from "@/lib/leads/source-flow";
import { humanLeadSource } from "@/lib/format";
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
}: {
  orgId: string;
  propertyId: string;
}) {
  const since28d = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const [data, activePipelineRows, recentActivity, flowGroups] =
    await Promise.all([
      getPropertyLeads(orgId, propertyId),
      prisma.lead.groupBy({
        by: ["status"],
        where: {
          orgId,
          propertyId,
          status: { in: ACTIVE_STATUSES },
        },
        _count: { _all: true },
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
      prisma.lead.groupBy({
        by: ["source", "status"],
        where: { orgId, propertyId, firstSeenAt: { gte: since28d } },
        _count: { _all: true },
      }),
    ]);
  const flow = buildSourceFlow(
    flowGroups.map((g) => ({ source: g.source, status: g.status, count: g._count._all })),
  );


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
      <section className="ls-card px-5 py-4">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-foreground">Lead sources</h2>
          <p className="text-[12px] text-muted-foreground">Last 28 days</p>
        </div>
        <SourceList rows={flow.rows} />
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
                className="group block px-3 py-1 transition-colors hover:bg-[var(--brand-wash)]"
              >
                <p className="ls-eyebrow truncate">{STATUS_LABEL[p.status]}</p>
                <p
                  className={`ls-metric ls-metric-md mt-1 ${
                    p.count > 0 ? "" : "text-muted-foreground"
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
                    <SourceMark source={lead.source} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate group-hover:underline">
                          {name}
                        </span>
                        <span className="text-[12px] text-muted-foreground">
                          {STATUS_LABEL[lead.status]}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {[humanLeadSource(lead.source), lead.email, lead.phone]
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
                    className="flex items-center justify-between gap-3"
                  >
                    <SourceMark source={lead.source} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">
                        {name}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {humanLeadSource(lead.source)}
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
