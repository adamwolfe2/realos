import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, MapPin, User, Clock, CheckCircle2, X } from "lucide-react";
import { format, formatDistanceToNow, startOfWeek, addDays } from "date-fns";
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
import { TourStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Tours" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/tours — Tour pipeline & calendar.
//
// Schema already had Tour rows (status, scheduledAt, lead+property links) but
// no dedicated UI. Operators were expected to find tours via the leads list.
// This page surfaces the full pipeline:
//   - 5 KPI tiles (requested / scheduled this week / completed / no-show / cancelled)
//   - Upcoming 7-day calendar grouped by day
//   - Status kanban for the 30-day window
// All entries link back to the lead detail page.
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<TourStatus, string> = {
  REQUESTED: "Requested",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  NO_SHOW: "No-show",
  CANCELLED: "Cancelled",
};

const STATUS_TONE: Record<TourStatus, StatusTone> = {
  REQUESTED: "info",
  SCHEDULED: "active",
  COMPLETED: "success",
  NO_SHOW: "danger",
  CANCELLED: "neutral",
};

export default async function ToursPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; properties?: string }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;
  const requestedIds = parsePropertyFilter(sp);
  const accessDenied = isAccessDenied(scope, requestedIds);
  // propertyClause filters tour rows by `propertyId` directly (Tour
  // has it on the row). The tenantWhere gate stays on `lead` so a
  // property without leads is still scoped to the org.
  const propertyClause = propertyWhereFragment(scope, requestedIds);
  try {
  const where = tenantWhere(scope);
  const now = new Date();
  const startOfThisWeek = startOfWeek(now, { weekStartsOn: 1 });
  const endOfThisWeek = addDays(startOfThisWeek, 7);
  const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const next7 = addDays(now, 7);

  const [
    requestedCount,
    scheduledThisWeekCount,
    completedCount,
    noShowCount,
    cancelledCount,
    upcoming,
    pipeline,
  ] = await Promise.all([
    prisma.tour.count({
      where: {
        lead: where,
        ...propertyClause,
        status: TourStatus.REQUESTED,
      },
    }),
    prisma.tour.count({
      where: {
        lead: where,
        ...propertyClause,
        status: TourStatus.SCHEDULED,
        scheduledAt: { gte: startOfThisWeek, lt: endOfThisWeek },
      },
    }),
    prisma.tour.count({
      where: {
        lead: where,
        ...propertyClause,
        status: TourStatus.COMPLETED,
        createdAt: { gte: past30 },
      },
    }),
    prisma.tour.count({
      where: {
        lead: where,
        ...propertyClause,
        status: TourStatus.NO_SHOW,
        createdAt: { gte: past30 },
      },
    }),
    prisma.tour.count({
      where: {
        lead: where,
        ...propertyClause,
        status: TourStatus.CANCELLED,
        createdAt: { gte: past30 },
      },
    }),
    prisma.tour.findMany({
      where: {
        lead: where,
        ...propertyClause,
        status: { in: [TourStatus.SCHEDULED, TourStatus.REQUESTED] },
        scheduledAt: { gte: now, lte: next7 },
      },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        tourType: true,
        attendeeCount: true,
        notes: true,
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        property: { select: { id: true, name: true, addressLine1: true, city: true } },
      },
    }),
    prisma.tour.findMany({
      where: { lead: where, ...propertyClause, createdAt: { gte: past30 } },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        tourType: true,
        createdAt: true,
        lead: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        property: { select: { id: true, name: true } },
      },
      take: 200,
    }),
  ]);

  // Group upcoming by day for the calendar strip.
  type UpcomingItem = (typeof upcoming)[number];
  const upcomingByDay = new Map<string, UpcomingItem[]>();
  for (let i = 0; i < 7; i++) {
    const d = addDays(now, i);
    upcomingByDay.set(format(d, "yyyy-MM-dd"), []);
  }
  for (const t of upcoming) {
    if (!t.scheduledAt) continue;
    const key = format(t.scheduledAt, "yyyy-MM-dd");
    if (upcomingByDay.has(key)) {
      upcomingByDay.get(key)!.push(t);
    }
  }

  // Group pipeline by status.
  type PipelineItem = (typeof pipeline)[number];
  const byStatus = new Map<TourStatus, PipelineItem[]>();
  for (const s of Object.values(TourStatus)) byStatus.set(s, []);
  for (const t of pipeline) {
    byStatus.get(t.status)!.push(t);
  }

  const totalScheduled = byStatus.get(TourStatus.SCHEDULED)!.length;
  const completionRate =
    totalScheduled + (byStatus.get(TourStatus.COMPLETED)?.length ?? 0) > 0
      ? Math.round(
          ((byStatus.get(TourStatus.COMPLETED)?.length ?? 0) /
            (totalScheduled + (byStatus.get(TourStatus.COMPLETED)?.length ?? 0))) *
            100
        )
      : null;

  // Load property list for the multi-select dropdown, gated to the
  // user's allowed set (Norman only sees Telegraph Commons here).
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
        title="Tours"
        description="Calendar, pipeline, and outcomes for every property tour. Click any tour to open the lead."
        actions={
          properties.length > 1 ? (
            <PropertyMultiSelect properties={properties} orgId={scope.orgId} />
          ) : null
        }
      />

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiTile
          label="Requested"
          value={requestedCount.toLocaleString()}
          hint="Awaiting scheduling"
          icon={<Clock className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="This week"
          value={scheduledThisWeekCount.toLocaleString()}
          hint="Scheduled tours"
          icon={<Calendar className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Completed (30d)"
          value={completedCount.toLocaleString()}
          hint="Tours actually done"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="No-show (30d)"
          value={noShowCount.toLocaleString()}
          hint="Missed appointments"
          icon={<X className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Cancelled (30d)"
          value={cancelledCount.toLocaleString()}
          hint="Pulled before tour"
          icon={<X className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Completion rate"
          value={completionRate != null ? `${completionRate}%` : "—"}
          hint="Completed vs scheduled"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
      </section>

      {/* 7-day calendar strip */}
      <DashboardSection
        title="Next 7 days"
        eyebrow="Calendar"
        description="Tours scheduled or requested for this week"
      >
        {upcoming.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">
            No upcoming tours in the next 7 days.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
            {Array.from(upcomingByDay.entries()).map(([key, items]) => {
              const date = new Date(`${key}T00:00:00`);
              const isToday = format(now, "yyyy-MM-dd") === key;
              return (
                <div
                  key={key}
                  className={`rounded-lg border ${isToday ? "border-primary/40 bg-primary/5" : "border-border bg-card"} p-2.5 min-h-[120px]`}
                >
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                      {format(date, "EEE")}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-foreground">
                      {format(date, "MMM d")}
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground italic">
                      No tours
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {items.map((t) => (
                        <li key={t.id}>
                          <div className="rounded-md border border-border bg-card hover:border-primary/40 hover:bg-muted/40 transition-colors">
                            <Link
                              href={`/portal/leads/${t.lead.id}`}
                              className="block px-2 pt-1.5 pb-1"
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-[10px] font-semibold text-foreground tabular-nums">
                                  {t.scheduledAt
                                    ? format(t.scheduledAt, "h:mma").toLowerCase()
                                    : "—"}
                                </span>
                                <StatusPill
                                  label={STATUS_LABEL[t.status]}
                                  tone={STATUS_TONE[t.status]}
                                />
                              </div>
                              <p className="text-[11px] font-medium text-foreground truncate mt-0.5">
                                {[t.lead.firstName, t.lead.lastName]
                                  .filter(Boolean)
                                  .join(" ") || t.lead.email || "Anonymous"}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {t.property.name}
                              </p>
                            </Link>
                            {t.scheduledAt ? (
                              <a
                                href={`/api/tenant/tours/${t.id}/ics`}
                                className="block px-2 py-1 border-t border-border text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                title="Download .ics calendar event"
                              >
                                Add to calendar
                              </a>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DashboardSection>

      {/* Status kanban */}
      <DashboardSection
        title="Pipeline (last 30 days)"
        eyebrow="By status"
        description="Every tour created or scheduled in the last 30 days, grouped by status"
      >
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <div className="grid grid-cols-5 gap-3 min-w-[900px] md:min-w-0">
            {Object.values(TourStatus).map((status) => {
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
                      {items.slice(0, 50).map((t) => (
                        <li key={t.id}>
                          <Link
                            href={`/portal/leads/${t.lead.id}`}
                            className="block rounded-md border border-border bg-card hover:border-primary/40 px-2 py-1.5"
                          >
                            <p className="text-[11px] font-medium text-foreground truncate">
                              {[t.lead.firstName, t.lead.lastName]
                                .filter(Boolean)
                                .join(" ") || t.lead.email || "Anonymous"}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <MapPin className="h-2.5 w-2.5" />
                              <span className="truncate">{t.property.name}</span>
                            </div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {t.scheduledAt
                                ? format(t.scheduledAt, "MMM d, h:mma").toLowerCase()
                                : `Created ${formatDistanceToNow(t.createdAt, { addSuffix: true })}`}
                              {t.tourType ? ` · ${t.tourType.replace(/_/g, " ")}` : ""}
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
      </DashboardSection>
    </div>
  );
  } catch (err) {
    console.error("[ToursPage] Failed to load tour data:", err);
    return (
      <div className="space-y-4">
        <PageHeader
          title="Tours"
          description="Calendar, pipeline, and outcomes for every property tour."
        />
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Tour data could not be loaded. If this error persists, check{" "}
          <a href="/portal/connect" className="underline font-medium">
            Settings → Integrations
          </a>
          .
        </div>
      </div>
    );
  }
}
