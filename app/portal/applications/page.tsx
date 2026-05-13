import type { Metadata } from "next";
import Link from "next/link";
import { FileText, CheckCircle2, X, Clock, Inbox } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import {
  isAccessDenied,
  parsePropertyFilter,
  propertyWhereFragment,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PropertyAccessDeniedBanner } from "@/components/portal/access-denied-banner";
import { PageHeader } from "@/components/admin/page-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { StatusPill, type StatusTone } from "@/components/portal/ui/status-pill";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { ApplicationStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Applications" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/applications — Application review pipeline.
//
// Applications are stored in the schema (Application + ApplicationStatus enum)
// but had no client-facing UI. Operators had to drop into AppFolio to review.
// This page exposes the pipeline as a kanban so the agency + client can see
// every application from started through approval/denial — and click into the
// originating lead.
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  STARTED: "Started",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  DENIED: "Denied",
  WITHDRAWN: "Withdrawn",
};

const STATUS_TONE: Record<ApplicationStatus, StatusTone> = {
  STARTED: "info",
  SUBMITTED: "active",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  DENIED: "danger",
  WITHDRAWN: "neutral",
};

const STATUS_COLUMN_ORDER: ApplicationStatus[] = [
  ApplicationStatus.STARTED,
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.UNDER_REVIEW,
  ApplicationStatus.APPROVED,
  ApplicationStatus.DENIED,
  ApplicationStatus.WITHDRAWN,
];

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; properties?: string }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;
  const requestedIds = parsePropertyFilter(sp);
  const accessDenied = isAccessDenied(scope, requestedIds);
  const propertyClause = propertyWhereFragment(scope, requestedIds);
  try {
  const where = tenantWhere(scope);
  const last90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    submittedCount,
    underReviewCount,
    approved30dCount,
    denied30dCount,
    totalAll,
    apps,
  ] = await Promise.all([
    prisma.application.count({
      where: { lead: where, ...propertyClause,status: ApplicationStatus.SUBMITTED },
    }),
    prisma.application.count({
      where: { lead: where, ...propertyClause,status: ApplicationStatus.UNDER_REVIEW },
    }),
    prisma.application.count({
      where: {
        lead: where,
        status: ApplicationStatus.APPROVED,
        decidedAt: { gte: last30 },
      },
    }),
    prisma.application.count({
      where: {
        lead: where,
        status: ApplicationStatus.DENIED,
        decidedAt: { gte: last30 },
      },
    }),
    prisma.application.count({ where: { lead: where } }),
    prisma.application.findMany({
      where: { lead: where, ...propertyClause,createdAt: { gte: last90 } },
      orderBy: [{ createdAt: "desc" }],
      take: 300,
      select: {
        id: true,
        status: true,
        appliedAt: true,
        decidedAt: true,
        createdAt: true,
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        property: { select: { id: true, name: true } },
      },
    }),
  ]);

  const totalDecided30d = approved30dCount + denied30dCount;
  const approvalRatePct =
    totalDecided30d > 0
      ? Math.round((approved30dCount / totalDecided30d) * 100)
      : null;

  type AppItem = (typeof apps)[number];
  const byStatus = new Map<ApplicationStatus, AppItem[]>();
  for (const s of Object.values(ApplicationStatus)) byStatus.set(s, []);
  for (const app of apps) byStatus.get(app.status)!.push(app);

  const allProperties = await prisma.property.findMany({
    where: tenantWhere(scope),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const properties = visibleProperties(scope, allProperties);

  return (
    <div className="space-y-4">
      {accessDenied ? <PropertyAccessDeniedBanner /> : null}
      <PageHeader
        title="Applications"
        description="Every lease application from started through decision. Click any card to open the lead and act on it."
        actions={
          properties.length > 1 ? (
            <PropertyMultiSelect properties={properties} orgId={scope.orgId} />
          ) : null
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiTile
          label="Submitted"
          value={submittedCount.toLocaleString()}
          hint="Need review"
          icon={<Inbox className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Under review"
          value={underReviewCount.toLocaleString()}
          hint="Pending decision"
          icon={<Clock className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Approved (30d)"
          value={approved30dCount.toLocaleString()}
          hint="Last 30 days"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Denied (30d)"
          value={denied30dCount.toLocaleString()}
          hint="Last 30 days"
          icon={<X className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Approval rate (30d)"
          value={approvalRatePct != null ? `${approvalRatePct}%` : "—"}
          hint={`${totalAll.toLocaleString()} all-time`}
          icon={<FileText className="h-3.5 w-3.5" />}
        />
      </section>

      <DashboardSection
        title="Pipeline"
        eyebrow="Last 90 days"
        description="Drag-free kanban — click any application to open the lead it came from"
      >
        {apps.length === 0 ? (
          <EmptyState
            title="Once leads start applying, they'll show up here."
            body="Applications come in via your tenant marketing site, AppFolio sync, or manual entry from a lead detail page."
            action={{ label: "Open leads", href: "/portal/leads" }}
          />
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <div className="grid grid-cols-6 gap-3 min-w-[1080px] md:min-w-0">
              {STATUS_COLUMN_ORDER.map((status) => {
                const items = byStatus.get(status) ?? [];
                return (
                  <div
                    key={status}
                    className="rounded-lg border border-border bg-muted/30 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2 px-1">
                      <StatusPill
                        label={STATUS_LABEL[status]}
                        tone={STATUS_TONE[status]}
                      />
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        {items.length}
                      </span>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic px-1 py-2">
                        None
                      </p>
                    ) : (
                      <ul className="space-y-1.5 max-h-[480px] overflow-y-auto">
                        {items.slice(0, 50).map((a) => {
                          const name =
                            [a.lead.firstName, a.lead.lastName]
                              .filter(Boolean)
                              .join(" ") || a.lead.email || "Anonymous";
                          const ts =
                            a.decidedAt ?? a.appliedAt ?? a.createdAt;
                          return (
                            <li key={a.id}>
                              <Link
                                href={`/portal/leads/${a.lead.id}`}
                                className="block rounded-md border border-border bg-card hover:border-primary/40 px-2 py-1.5"
                              >
                                <p className="text-[11px] font-medium text-foreground truncate">
                                  {name}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {a.property.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                                  {format(ts, "MMM d")} ·{" "}
                                  {formatDistanceToNow(ts, { addSuffix: true })}
                                </p>
                              </Link>
                            </li>
                          );
                        })}
                        {items.length > 50 ? (
                          <li className="px-1 text-[10px] text-muted-foreground text-center">
                            +{items.length - 50} more
                          </li>
                        ) : null}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DashboardSection>
    </div>
  );
  } catch (err) {
    console.error("[ApplicationsPage] Failed to load application data:", err);
    return (
      <div className="space-y-4">
        <PageHeader
          title="Applications"
          description="Every lease application from started through decision."
        />
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
          Application data could not be loaded. This usually means AppFolio hasn&apos;t synced yet.{" "}
          <a href="/portal/connect" className="underline font-medium">
            Go to Settings → Integrations
          </a>
        </div>
      </div>
    );
  }
}
