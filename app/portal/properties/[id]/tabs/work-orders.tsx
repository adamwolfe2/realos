import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { WorkOrderStatus, WorkOrderPriority } from "@prisma/client";
import { Wrench, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

// ---------------------------------------------------------------------------
// Work Orders tab — per-property maintenance pipeline from AppFolio.
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

const OPEN_STATUSES = [
  WorkOrderStatus.NEW,
  WorkOrderStatus.SCHEDULED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD,
];

const PIPELINE_ORDER: WorkOrderStatus[] = [
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

export async function WorkOrdersTab({
  orgId,
  propertyId,
}: {
  orgId: string;
  propertyId: string;
}) {
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const last90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [openCount, urgentCount, completed30d, avgCloseRows, workOrders] =
    await Promise.all([
      prisma.workOrder.count({
        where: { orgId, propertyId, status: { in: OPEN_STATUSES } },
      }),
      prisma.workOrder.count({
        where: {
          orgId,
          propertyId,
          priority: WorkOrderPriority.URGENT,
          status: { not: WorkOrderStatus.COMPLETED },
        },
      }),
      prisma.workOrder.count({
        where: {
          orgId,
          propertyId,
          status: WorkOrderStatus.COMPLETED,
          completedAt: { gte: last30 },
        },
      }),
      prisma.workOrder.findMany({
        where: {
          orgId,
          propertyId,
          status: WorkOrderStatus.COMPLETED,
          completedAt: { gte: last90, not: null },
          reportedAt: { not: null },
        },
        select: { reportedAt: true, completedAt: true },
        take: 200,
      }),
      prisma.workOrder.findMany({
        where: { orgId, propertyId, createdAt: { gte: last90 } },
        orderBy: [{ priority: "desc" }, { reportedAt: "desc" }],
        take: 300,
        include: {
          listing: { select: { id: true, unitNumber: true } },
        },
      }),
    ]);

  // Average close time
  let totalHours = 0;
  let closeSamples = 0;
  for (const r of avgCloseRows) {
    if (r.reportedAt && r.completedAt) {
      totalHours +=
        (r.completedAt.getTime() - r.reportedAt.getTime()) / (60 * 60 * 1000);
      closeSamples += 1;
    }
  }
  const avgCloseDays =
    closeSamples > 0
      ? Math.round((totalHours / closeSamples / 24) * 10) / 10
      : null;

  type WoRow = (typeof workOrders)[number];
  const byStatus = new Map<WorkOrderStatus, WoRow[]>();
  for (const s of PIPELINE_ORDER) byStatus.set(s, []);
  for (const w of workOrders) byStatus.get(w.status)?.push(w);

  if (workOrders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm font-semibold text-foreground">No work orders yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          AppFolio sync will populate maintenance tickets for this property.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="Open"
          value={openCount.toLocaleString()}
          hint="Across all open statuses"
          icon={<Wrench className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Urgent open"
          value={urgentCount.toLocaleString()}
          hint="Stop-the-bleed tickets"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Completed (30d)"
          value={completed30d.toLocaleString()}
          hint="Last 30 days"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Avg close time"
          value={avgCloseDays != null ? `${avgCloseDays}d` : "—"}
          hint="Reported → completed (90d)"
          icon={<Clock className="h-3.5 w-3.5" />}
        />
      </section>

      <DashboardSection
        title="Pipeline"
        eyebrow="Last 90 days"
        description="Grouped by status. Fulfillment happens in AppFolio."
      >
        <div className="overflow-x-auto">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 min-w-[720px] md:min-w-0">
            {PIPELINE_ORDER.map((status) => {
              const items = byStatus.get(status) ?? [];
              return (
                <div
                  key={status}
                  className="rounded-lg border border-border bg-muted/30 p-2"
                >
                  <div className="flex items-center justify-between gap-1 mb-2 px-0.5">
                    <span
                      className={`text-[9px] tracking-widest uppercase font-semibold rounded px-1.5 py-0.5 border ${STATUS_TONE[status]}`}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground italic px-0.5 py-1">
                      None
                    </p>
                  ) : (
                    <ul className="space-y-1 max-h-[360px] overflow-y-auto">
                      {items.slice(0, 40).map((w) => (
                        <li key={w.id}>
                          <div className="rounded border border-border bg-card px-2 py-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[9px] tabular-nums text-muted-foreground">
                                {w.workOrderNumber ?? "—"}
                              </span>
                              <span
                                className={`text-[9px] uppercase tracking-wider ${PRIORITY_TONE[w.priority]}`}
                              >
                                {PRIORITY_LABEL[w.priority]}
                              </span>
                            </div>
                            <p className="text-[11px] font-medium text-foreground truncate mt-0.5">
                              {w.title || w.category || "Maintenance"}
                            </p>
                            {w.unitNumber || w.listing?.unitNumber ? (
                              <p className="text-[10px] text-muted-foreground">
                                Unit {w.unitNumber || w.listing?.unitNumber}
                              </p>
                            ) : null}
                            <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                              <span>
                                {w.reportedAt
                                  ? formatDistanceToNow(w.reportedAt, { addSuffix: true })
                                  : "—"}
                              </span>
                              <span>
                                {fmtMoney(w.actualCostCents ?? w.estimatedCostCents)}
                              </span>
                            </div>
                          </div>
                        </li>
                      ))}
                      {items.length > 40 ? (
                        <li className="text-[10px] text-muted-foreground text-center py-1">
                          +{items.length - 40} more
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DashboardSection>
    </div>
  );
}
