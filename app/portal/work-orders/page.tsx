import type { Metadata } from "next";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { WorkOrderStatus, WorkOrderPriority } from "@prisma/client";

export const metadata: Metadata = { title: "Work orders" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/work-orders — Maintenance pipeline.
//
// AppFolio is the source of truth for work-order state. The operator
// fulfills them in AppFolio (or via vendor), we just surface the queue,
// priorities, and aging so the operator never loses sight of an open
// ticket. Tickets cluster by property to spot building-level problems.
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<WorkOrderStatus, string> = {
  NEW: "New",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  ON_HOLD: "On hold",
};

const STATUS_TONE: Record<WorkOrderStatus, string> = {
  NEW: "bg-rose-50 text-rose-700 border-rose-200",
  SCHEDULED: "bg-blue-50 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-amber-50 text-amber-800 border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-muted text-muted-foreground border-border",
  ON_HOLD: "bg-slate-50 text-slate-700 border-slate-200",
};

const PRIORITY_LABEL: Record<WorkOrderPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

const PRIORITY_TONE: Record<WorkOrderPriority, string> = {
  LOW: "text-muted-foreground",
  NORMAL: "text-foreground",
  HIGH: "text-amber-700 font-semibold",
  URGENT: "text-rose-700 font-bold",
};

const STATUS_COLUMN_ORDER: WorkOrderStatus[] = [
  WorkOrderStatus.NEW,
  WorkOrderStatus.SCHEDULED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.COMPLETED,
  WorkOrderStatus.CANCELLED,
];

function fmtMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function WorkOrdersPage() {
  const scope = await requireScope();
  try {
  const where = tenantWhere(scope);
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const last90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [
    openCount,
    urgentCount,
    completed30dCount,
    avgCloseDays,
    pipelineRows,
    perPropertyTotals,
  ] = await Promise.all([
    prisma.workOrder.count({
      where: {
        ...where,
        status: {
          in: [
            WorkOrderStatus.NEW,
            WorkOrderStatus.SCHEDULED,
            WorkOrderStatus.IN_PROGRESS,
            WorkOrderStatus.ON_HOLD,
          ],
        },
      },
    }),
    prisma.workOrder.count({
      where: {
        ...where,
        priority: WorkOrderPriority.URGENT,
        status: { not: WorkOrderStatus.COMPLETED },
      },
    }),
    prisma.workOrder.count({
      where: {
        ...where,
        status: WorkOrderStatus.COMPLETED,
        completedAt: { gte: last30 },
      },
    }),
    prisma.workOrder.findMany({
      where: {
        ...where,
        status: WorkOrderStatus.COMPLETED,
        completedAt: { gte: last90, not: null },
        reportedAt: { not: null },
      },
      select: { reportedAt: true, completedAt: true },
      take: 500,
    }),
    prisma.workOrder.findMany({
      where: { ...where, createdAt: { gte: last90 } },
      orderBy: [{ priority: "desc" }, { reportedAt: "desc" }],
      take: 400,
      include: {
        property: { select: { id: true, name: true } },
        listing: { select: { id: true, unitNumber: true } },
      },
    }),
    prisma.workOrder.groupBy({
      by: ["propertyId"],
      where: {
        ...where,
        status: { not: WorkOrderStatus.COMPLETED },
      },
      _count: { _all: true },
    }),
  ]);

  // Average close time
  let totalCloseHours = 0;
  let countCloseSamples = 0;
  for (const r of avgCloseDays) {
    if (r.reportedAt && r.completedAt) {
      totalCloseHours +=
        (r.completedAt.getTime() - r.reportedAt.getTime()) / (60 * 60 * 1000);
      countCloseSamples += 1;
    }
  }
  const avgCloseDaysValue =
    countCloseSamples > 0
      ? Math.round((totalCloseHours / countCloseSamples / 24) * 10) / 10
      : null;

  // Property hotspots
  const propertyIdsTouched = perPropertyTotals.map((p) => p.propertyId);
  const propertyDetails = propertyIdsTouched.length
    ? await prisma.property.findMany({
        where: { id: { in: propertyIdsTouched } },
        select: { id: true, name: true },
      })
    : [];
  const propertyNameById = new Map(propertyDetails.map((p) => [p.id, p.name]));
  const hotspots = perPropertyTotals
    .map((row) => ({
      propertyId: row.propertyId,
      name: propertyNameById.get(row.propertyId) ?? "Property",
      open: row._count._all,
    }))
    .sort((a, b) => b.open - a.open)
    .slice(0, 10);

  type WorkOrderRow = (typeof pipelineRows)[number];
  const byStatus = new Map<WorkOrderStatus, WorkOrderRow[]>();
  for (const s of STATUS_COLUMN_ORDER) byStatus.set(s, []);
  for (const w of pipelineRows) byStatus.get(w.status)?.push(w);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Work orders"
        description="Maintenance pipeline mirrored from AppFolio. Operator fulfillment happens in AppFolio; this view keeps you ahead of property issues."
      />

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiTile
          label="Open"
          value={openCount.toLocaleString()}
          hint="Across all statuses except completed/cancelled"
          icon={<Wrench className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Urgent open"
          value={urgentCount.toLocaleString()}
          hint="Stop-the-bleed"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Completed (30d)"
          value={completed30dCount.toLocaleString()}
          hint="Last 30 days"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Avg close time"
          value={avgCloseDaysValue != null ? `${avgCloseDaysValue}d` : "—"}
          hint="Reported → completed (last 90d)"
          icon={<Clock className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Properties affected"
          value={hotspots.length.toLocaleString()}
          hint="With open tickets"
          icon={<Wrench className="h-3.5 w-3.5" />}
        />
      </section>

      {hotspots.length > 0 ? (
        <DashboardSection
          title="Property hotspots"
          eyebrow="Open tickets per property"
          description="Higher counts can signal underlying building issues"
        >
          <ul className="space-y-1.5">
            {hotspots.map((h) => (
              <li key={h.propertyId} className="flex items-center gap-2">
                <Link
                  href={`/portal/properties/${h.propertyId}`}
                  className="flex-1 text-xs text-foreground hover:text-primary truncate"
                >
                  {h.name}
                </Link>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[300px]">
                  <div
                    className="h-full bg-amber-500"
                    style={{
                      width: `${Math.min(100, (h.open / Math.max(...hotspots.map((x) => x.open))) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums text-foreground w-8 text-right">
                  {h.open}
                </span>
              </li>
            ))}
          </ul>
        </DashboardSection>
      ) : null}

      <DashboardSection
        title="Pipeline"
        eyebrow="Last 90 days"
        description="Tickets grouped by status. Click any to open the property."
      >
        {pipelineRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No work orders synced yet. Run AppFolio sync to populate this
              view.
            </p>
          </div>
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
                      <span
                        className={`text-[10px] tracking-widest uppercase font-semibold rounded px-1.5 py-0.5 border ${STATUS_TONE[status]}`}
                      >
                        {STATUS_LABEL[status]}
                      </span>
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
                        {items.slice(0, 50).map((w) => (
                          <li key={w.id}>
                            <Link
                              href={`/portal/properties/${w.property.id}`}
                              className="block rounded-md border border-border bg-card hover:border-primary/40 px-2 py-1.5"
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-[10px] tabular-nums text-muted-foreground">
                                  {w.workOrderNumber ?? "—"}
                                </span>
                                <span
                                  className={`text-[10px] uppercase tracking-wider ${PRIORITY_TONE[w.priority]}`}
                                >
                                  {PRIORITY_LABEL[w.priority]}
                                </span>
                              </div>
                              <p className="text-[11px] font-medium text-foreground truncate mt-0.5">
                                {w.title || w.category || "Maintenance"}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {w.property.name}
                                {w.unitNumber || w.listing?.unitNumber
                                  ? ` · Unit ${w.unitNumber || w.listing?.unitNumber}`
                                  : ""}
                              </p>
                              <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                                <span>
                                  {w.reportedAt
                                    ? formatDistanceToNow(w.reportedAt, {
                                        addSuffix: true,
                                      })
                                    : "—"}
                                </span>
                                <span>{fmtMoney(w.actualCostCents ?? w.estimatedCostCents)}</span>
                              </div>
                            </Link>
                          </li>
                        ))}
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
    console.error("[work-orders] Failed to load AppFolio work order data:", err);
    return (
      <div className="space-y-4">
        <PageHeader
          title="Work orders"
          description="Maintenance pipeline mirrored from AppFolio. Operator fulfillment happens in AppFolio; this view keeps you ahead of property issues."
        />
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Work order data could not be loaded. This usually means AppFolio hasn&apos;t synced yet
          or the integration isn&apos;t configured.{" "}
          <a href="/portal/settings/integrations" className="underline font-medium">
            Go to Settings → Integrations
          </a>{" "}
          to connect AppFolio and run an initial sync.
        </div>
      </div>
    );
  }
}
