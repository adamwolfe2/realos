import type { Metadata } from "next";
import Link from "next/link";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Clock,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { PageHeader } from "@/components/admin/page-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { AppFolioStatusBanner } from "@/components/portal/integrations/appfolio-status-banner";
import { getAppFolioStatus } from "@/lib/integrations/appfolio-status";
import { LeaseStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Renewals" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/renewals — Lease renewal pipeline.
//
// Sourced 100% from AppFolio's rent_roll report (mirrored as Lease rows).
// AppFolio remains the source of truth for actual lease state; we just
// surface the upcoming-renewals funnel so the operator can act before
// resignation deadlines slip.
// ---------------------------------------------------------------------------

function fmtMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const BUCKETS = [
  { label: "0–30 days", min: 0, max: 30, tone: "border-rose-200 bg-rose-50" },
  { label: "31–60 days", min: 31, max: 60, tone: "border-amber-200 bg-amber-50" },
  { label: "61–90 days", min: 61, max: 90, tone: "border-blue-200 bg-blue-50" },
  { label: "91–120 days", min: 91, max: 120, tone: "border-slate-200 bg-card" },
] as const;

export default async function RenewalsPage() {
  const scope = await requireScope();
  try {
  const where = tenantWhere(scope);
  const now = new Date();
  const next120 = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);

  const [
    appfolioStatus,
    activeCount,
    expiringCount,
    expiredCount,
    pastDueCount,
    pastDueBalance,
    upcoming,
    rentRollTotal,
  ] = await Promise.all([
    getAppFolioStatus(scope.orgId),
    prisma.lease.count({ where: { ...where, status: LeaseStatus.ACTIVE } }),
    prisma.lease.count({
      where: {
        ...where,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
        endDate: { gte: now, lte: next120 },
      },
    }),
    prisma.lease.count({
      where: {
        ...where,
        endDate: { lt: now, gte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.lease.count({ where: { ...where, isPastDue: true } }),
    prisma.lease.aggregate({
      where: { ...where, isPastDue: true },
      _sum: { currentBalanceCents: true },
    }),
    prisma.lease.findMany({
      where: {
        ...where,
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
        endDate: { gte: now, lte: next120 },
      },
      orderBy: { endDate: "asc" },
      include: {
        property: { select: { id: true, name: true } },
        listing: { select: { id: true, unitNumber: true } },
        resident: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    }),
    prisma.lease.aggregate({
      where: { ...where, status: LeaseStatus.ACTIVE },
      _sum: { monthlyRentCents: true },
    }),
  ]);

  // Bucket leases by days-until-expiration
  type LeaseRow = (typeof upcoming)[number];
  const buckets: Array<{
    label: string;
    tone: string;
    items: LeaseRow[];
  }> = BUCKETS.map((b) => ({ label: b.label, tone: b.tone, items: [] }));
  for (const l of upcoming) {
    if (!l.endDate) continue;
    const days = differenceInDays(l.endDate, now);
    for (let i = 0; i < BUCKETS.length; i++) {
      const b = BUCKETS[i];
      if (days >= b.min && days <= b.max) {
        buckets[i].items.push(l);
        break;
      }
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Renewals"
        description="Lease expirations from AppFolio. Act on renewals 120 days out so resignation deadlines never slip."
      />

      <AppFolioStatusBanner status={appfolioStatus} resourceLabel="leases" />

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiTile
          label="Active leases"
          value={activeCount.toLocaleString()}
          hint="Currently in residence"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Expiring (120d)"
          value={expiringCount.toLocaleString()}
          hint="Need renewal action"
          icon={<Clock className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Expired (60d)"
          value={expiredCount.toLocaleString()}
          hint="Holdover or moved out"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Monthly rent roll"
          value={fmtMoney(rentRollTotal._sum.monthlyRentCents ?? 0)}
          hint="From active leases"
          icon={<DollarSign className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Past-due leases"
          value={pastDueCount.toLocaleString()}
          hint={`${fmtMoney(pastDueBalance._sum.currentBalanceCents ?? 0)} owed`}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Properties"
          value={(
            new Set(upcoming.map((u) => u.property.id)).size
          ).toLocaleString()}
          hint="With expiring leases"
          icon={<Calendar className="h-3.5 w-3.5" />}
        />
      </section>

      {/* Bucketed renewal pipeline */}
      <DashboardSection
        title="Renewal pipeline"
        eyebrow="Next 120 days"
        description="Leases grouped by days-until-expiration. Closest first."
      >
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No leases expiring in the next 120 days.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <div className="grid grid-cols-4 gap-3 min-w-[900px] md:min-w-0">
              {buckets.map((b) => (
                <div
                  key={b.label}
                  className={`rounded-lg border ${b.tone} p-2.5`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2 px-1">
                    <span className="text-[10px] tracking-widest uppercase font-semibold text-foreground">
                      {b.label}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-foreground">
                      {b.items.length}
                    </span>
                  </div>
                  {b.items.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground italic px-1 py-2">
                      None
                    </p>
                  ) : (
                    <ul className="space-y-1.5 max-h-[480px] overflow-y-auto">
                      {b.items.slice(0, 50).map((l) => {
                        const name =
                          [l.resident?.firstName, l.resident?.lastName]
                            .filter(Boolean)
                            .join(" ") ||
                          l.resident?.email ||
                          "Resident";
                        return (
                          <li key={l.id}>
                            <Link
                              href={`/portal/properties/${l.property.id}`}
                              className="block rounded-md border border-border bg-card hover:border-primary/40 px-2 py-1.5"
                            >
                              <p className="text-[11px] font-medium text-foreground truncate">
                                {name}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {l.property.name}
                                {l.listing?.unitNumber
                                  ? ` · Unit ${l.listing.unitNumber}`
                                  : ""}
                              </p>
                              <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                                <span>
                                  {l.endDate
                                    ? format(l.endDate, "MMM d")
                                    : "—"}
                                </span>
                                <span>
                                  {fmtMoney(l.monthlyRentCents)}
                                </span>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                      {b.items.length > 50 ? (
                        <li className="px-1 text-[10px] text-muted-foreground text-center">
                          +{b.items.length - 50} more
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </DashboardSection>

      {/* Detailed table */}
      <DashboardSection
        title="All upcoming renewals"
        eyebrow="Actionable list"
        description="Sorted by lease end date, soonest first"
      >
        {upcoming.length === 0 ? null : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-xs min-w-[720px]">
              <thead className="text-left text-[10px] tracking-widest uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 md:px-2 py-2 font-medium">Resident</th>
                  <th className="px-2 py-2 font-medium">Property</th>
                  <th className="px-2 py-2 font-medium">Unit</th>
                  <th className="px-2 py-2 font-medium text-right">Rent</th>
                  <th className="px-2 py-2 font-medium">End date</th>
                  <th className="px-2 py-2 font-medium text-right">Days left</th>
                  <th className="px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {upcoming.map((l) => {
                  const name =
                    [l.resident?.firstName, l.resident?.lastName]
                      .filter(Boolean)
                      .join(" ") ||
                    l.resident?.email ||
                    "Resident";
                  const days = l.endDate
                    ? differenceInDays(l.endDate, now)
                    : null;
                  const tone =
                    days != null && days <= 30
                      ? "text-rose-700 font-semibold"
                      : days != null && days <= 60
                        ? "text-amber-700 font-semibold"
                        : "text-foreground";
                  return (
                    <tr
                      key={l.id}
                      className="border-b border-border last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 md:px-2 py-2 text-foreground">
                        {name}
                        {l.resident?.email ? (
                          <p className="text-[10px] text-muted-foreground">
                            {l.resident.email}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-foreground">
                        {l.property.name}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {l.listing?.unitNumber ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {fmtMoney(l.monthlyRentCents)}
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {l.endDate ? format(l.endDate, "MMM d, yyyy") : "—"}
                      </td>
                      <td className={`px-2 py-2 text-right tabular-nums ${tone}`}>
                        {days != null ? `${days}d` : "—"}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Link
                          href={`/portal/properties/${l.property.id}`}
                          className="text-[11px] font-medium text-foreground hover:text-primary"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>
    </div>
  );
  } catch (err) {
    console.error("[renewals] Failed to load AppFolio lease data:", err);
    return (
      <div className="space-y-4">
        <PageHeader
          title="Renewals"
          description="Lease expirations from AppFolio. Act on renewals 120 days out so resignation deadlines never slip."
        />
        <AppFolioStatusBanner
          status={{
            state: "failed",
            lastSyncAt: null,
            lastError:
              err instanceof Error ? err.message : "Renewal data could not be loaded.",
            subdomain: null,
            stale: false,
          }}
          resourceLabel="leases"
        />
      </div>
    );
  }
}
