import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Clock, CheckCircle2, Timer } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { requireModule } from "@/lib/portal/module-gate";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  isAccessDenied,
  marketableScopedPropertyClause,
  parsePropertyFilter,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PropertyAccessDeniedBanner } from "@/components/portal/access-denied-banner";
import { PageHeader } from "@/components/admin/page-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { ApplicationStatus } from "@prisma/client";
import { getApplicationsByUnit } from "@/lib/applications/queries";
import { UnitApplicationsBoard } from "@/components/portal/applications/unit-applications-board";
import { ApplicationsPipelineTable } from "@/components/portal/applications/applications-pipeline-table";

export const metadata: Metadata = { title: "Applications" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/applications — Application review pipeline.
//
// Applications are stored in the schema (Application + ApplicationStatus enum)
// but had no client-facing UI. Operators had to drop into AppFolio to review.
// This page exposes the pipeline as a single dense table (by unit, or flat
// pipeline order) so the agency + client can see every application from
// started through approval/denial — and click into the originating lead.
// ---------------------------------------------------------------------------

const PENDING_STATUSES = new Set<ApplicationStatus>([
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.UNDER_REVIEW,
]);

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    property?: string;
    properties?: string;
    view?: string;
  }>;
}) {
  const gate = await requireModule("moduleResidents");
  if (gate) return gate;

  const scope = await requireScope();
  const sp = await searchParams;
  const view = sp.view === "pipeline" ? "pipeline" : "units";
  const requestedIds = await parsePropertyFilter(sp, scope.orgId);
  const accessDenied = isAccessDenied(scope, requestedIds);
  // Default (no selection) scopes to the org's ENABLED properties — not
  // the entire synced AppFolio portfolio. See marketableScopedPropertyClause.
  const propertyClause = await marketableScopedPropertyClause(
    scope,
    requestedIds,
  );
  // Preserve the active property filter when switching views.
  const filterQs =
    sp.properties != null
      ? `&properties=${encodeURIComponent(sp.properties)}`
      : sp.property != null
        ? `&property=${encodeURIComponent(sp.property)}`
        : "";
  try {
  const where = tenantWhere(scope);
  const last90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [submittedCount, underReviewCount, approved30dCount, apps] =
    await Promise.all([
    prisma.application.count({
      where: { lead: where, ...propertyClause,status: ApplicationStatus.SUBMITTED },
    }),
    prisma.application.count({
      where: { lead: where, ...propertyClause,status: ApplicationStatus.UNDER_REVIEW },
    }),
    prisma.application.count({
      where: {
        lead: where,
        ...propertyClause,
        status: ApplicationStatus.APPROVED,
        decidedAt: { gte: last30 },
      },
    }),
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

  // Oldest-waiting age: derived from the already-fetched `apps` rows, not a
  // new query. Note this only sees applications created within the last 90
  // days (the `apps` window) — a pending application older than that would
  // undercount here, but that's an acceptable approximation for an at-a-
  // glance KPI rather than justifying another query.
  const oldestPendingAt = apps.reduce<Date | null>((oldest, a) => {
    if (!PENDING_STATUSES.has(a.status)) return oldest;
    const ts = a.appliedAt ?? a.createdAt;
    if (!oldest || ts < oldest) return ts;
    return oldest;
  }, null);
  const oldestWaitingDays =
    oldestPendingAt != null
      ? Math.max(0, differenceInCalendarDays(new Date(), oldestPendingAt))
      : null;

  const allProperties = await prisma.property.findMany({
    where: marketablePropertyWhere(scope.orgId),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const properties = visibleProperties(scope, allProperties);

  const unitGroups =
    view === "units"
      ? await getApplicationsByUnit(where, propertyClause)
      : [];
  const unitGroupCount = unitGroups.reduce((n, u) => n + u.groups.length, 0);

  return (
    <div className="space-y-3 ls-page-fade">
      <PageHeader
        title="Applications"
        description="Every lease application, from started through decision."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="inline-flex items-center rounded-none border border-[#e0e0e0] bg-white p-0"
              role="group"
              aria-label="View"
            >
              <Link
                href={`/portal/applications?view=units${filterQs}`}
                className={
                  view === "units"
                    ? "px-3 py-1 text-[12px] font-semibold rounded-none bg-[#0f62fe] text-white transition-colors"
                    : "px-3 py-1 text-[12px] font-semibold rounded-none text-[#525252] hover:bg-[#f4f4f4] transition-colors"
                }
              >
                By unit
              </Link>
              <Link
                href={`/portal/applications?view=pipeline${filterQs}`}
                className={
                  view === "pipeline"
                    ? "px-3 py-1 text-[12px] font-semibold rounded-none bg-[#0f62fe] text-white transition-colors"
                    : "px-3 py-1 text-[12px] font-semibold rounded-none text-[#525252] hover:bg-[#f4f4f4] transition-colors"
                }
              >
                Pipeline
              </Link>
            </div>
            {properties.length > 1 ? (
              <PropertyMultiSelect properties={properties} orgId={scope.orgId} />
            ) : null}
          </div>
        }
      />

      {accessDenied ? <PropertyAccessDeniedBanner /> : null}

      <section
        aria-label="Application pipeline at a glance"
        className="grid grid-cols-2 lg:grid-cols-4 gap-2 ls-stagger"
      >
        <KpiTile
          density="dense"
          label="Submitted"
          value={submittedCount.toLocaleString()}
          hint="Awaiting review"
          icon={<Inbox className="h-3.5 w-3.5" />}
        />
        <KpiTile
          density="dense"
          label="Under review"
          value={underReviewCount.toLocaleString()}
          hint="Pending decision"
          icon={<Clock className="h-3.5 w-3.5" />}
        />
        <KpiTile
          density="dense"
          label="Approved (30d)"
          value={approved30dCount.toLocaleString()}
          hint="Last 30 days"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
        <KpiTile
          density="dense"
          label="Oldest waiting"
          value={oldestWaitingDays != null ? `${oldestWaitingDays}d` : "—"}
          hint={
            oldestWaitingDays != null
              ? "Submitted or under review"
              : "Nothing pending"
          }
          icon={<Timer className="h-3.5 w-3.5" />}
        />
      </section>

      {view === "units" ? (
        unitGroups.length === 0 ? (
          <EmptyState
            title="Once leads start applying, they'll show up here."
            body="Applications sync in from AppFolio. Connect it from the Connect hub to populate this view."
            action={{ label: "Open Connect hub", href: "/portal/connect" }}
          />
        ) : (
          <UnitApplicationsBoard
            units={unitGroups}
            caption={`By unit · last 120 days · ${unitGroupCount.toLocaleString()} ${unitGroupCount === 1 ? "application" : "applications"}`}
          />
        )
      ) : apps.length === 0 ? (
        <EmptyState
          title="Once leads start applying, they'll show up here."
          body="Applications sync in from AppFolio. Connect it from the Connect hub to populate this view."
          action={{ label: "Open Connect hub", href: "/portal/connect" }}
        />
      ) : (
        <ApplicationsPipelineTable
          apps={apps}
          caption={`Pipeline · last 90 days · ${apps.length.toLocaleString()} ${apps.length === 1 ? "application" : "applications"}`}
        />
      )}
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
        <div className="rounded-[2px] border border-border bg-secondary px-4 py-3 text-sm text-foreground">
          Application data could not be loaded. This usually means AppFolio hasn&apos;t synced yet.{" "}
          <a href="/portal/connect" className="underline font-medium">
            Go to Data sources
          </a>
        </div>
      </div>
    );
  }
}
