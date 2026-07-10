import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { ConversionFunnel } from "@/components/portal/dashboard/conversion-funnel";
import { LeadSourceDonut } from "@/components/portal/dashboard/lead-source-donut";
import { getPropertyLeads } from "@/lib/properties/queries";
import { prisma } from "@/lib/db";
import { LeadStatus, ApplicationStatus, type Lead } from "@prisma/client";

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
      {/* Norman 2026-05-21: Acquisition tab was eating ~480px of
          vertical space across two nested grids (5 KPI tiles + 7
          pipeline stage cards). Collapsed into TWO horizontal
          nav-bar-style strips with brand-blue cohesion.
          Strip 1: snapshot KPIs in a single row.
          Strip 2: pipeline stages as a connected flow with chevron
          separators — operator reads it as a funnel left-to-right
          instead of a grid. */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <header className="flex items-baseline justify-between gap-3 px-4 py-2 border-b border-border/60 bg-gradient-to-r from-primary/[0.04] via-card to-card">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
            Acquisition · last 28 days
          </p>
        </header>
        <div className="flex items-stretch divide-x divide-border/60">
          <KpiStripItem label="Leads" value={leadsCount} accent />
          <KpiStripItem label="Tours" value={toursCount} />
          <KpiStripItem label="Applications" value={appsCount} />
          <KpiStripItem
            label="In flight"
            value={totalActive}
            hint="Not signed / lost"
            accent={totalActive > 0}
          />
          <KpiStripItem
            label="Pending apps"
            value={pendingApps}
            hint="Submitted"
          />
        </div>
      </section>

      {/* Pipeline funnel — single horizontal flow with chevron
          separators between stages. Brand-blue pill on non-zero
          stages so the operator's eye lands on where the work is. */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <header className="flex items-baseline justify-between gap-3 px-4 py-2 border-b border-border/60 bg-gradient-to-r from-primary/[0.04] via-card to-card">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
            Active pipeline · {totalActive} in flight
          </p>
          <Link
            href={`/portal/leads?status_in=${ACTIVE_STATUSES.join(",")}&property=${propertyId}`}
            className="text-[10.5px] font-semibold text-primary hover:underline"
          >
            See full pipeline →
          </Link>
        </header>
        <ol className="flex items-stretch overflow-x-auto">
          {pipelineCounts.map((p, i) => (
            <li
              key={p.status}
              className="flex items-stretch flex-1 min-w-[110px]"
            >
              <Link
                href={`/portal/leads?status=${p.status}&property=${propertyId}`}
                className={`group flex-1 px-3 py-2.5 transition-colors ${
                  p.count > 0
                    ? "bg-card hover:bg-primary/[0.04]"
                    : "bg-secondary hover:bg-muted/30"
                }`}
              >
                <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.1em] text-muted-foreground truncate">
                  {STATUS_LABEL[p.status]}
                </p>
                <p
                  className={`mt-0.5 text-[18px] font-display font-medium tabular-nums leading-tight ${
                    p.count > 0
                      ? "text-primary"
                      : "text-muted-foreground/50"
                  }`}
                >
                  {p.count.toLocaleString()}
                </p>
              </Link>
              {i < pipelineCounts.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="flex items-center text-muted-foreground/40 px-0.5"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M3 1L7 5L3 9"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

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
              const name =
                [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() ||
                lead.email ||
                "Anonymous";
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
          <LeadSourceDonut slices={data.sourceBreakdown} />
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
              const name =
                [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() ||
                lead.email ||
                "Anonymous";
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
// KpiStripItem — single cell of the horizontal acquisition strip.
// Brand-blue accent on cells the operator should land on first
// (Leads + non-zero In Flight), neutral for the rest.
// ---------------------------------------------------------------------------
function KpiStripItem({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex-1 px-4 py-2.5 min-w-[120px]">
      <p
        className={`text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] ${
          accent ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-0.5 text-[20px] font-display font-medium tabular-nums leading-none ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value.toLocaleString()}
      </p>
      {hint ? (
        <p className="mt-1 text-[10px] text-muted-foreground leading-tight truncate">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
