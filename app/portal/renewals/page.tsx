import type { Metadata } from "next";
import { differenceInDays } from "date-fns";
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Clock,
} from "lucide-react";
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
import { tenantNameFromRaw } from "@/lib/integrations/appfolio-display";
import { LeaseStatus } from "@prisma/client";
import {
  RenewalsClient,
  type RenewalLease,
  type RenewalBucket,
} from "./renewals-client";

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

// All buckets share the neutral card surface. Urgency is conveyed by the
// dot color on the bucket's StatusPill header, not by full-card tinting —
// keeps the page from looking like a traffic light.
const BUCKETS = [
  { label: "0–30 days", min: 0, max: 30, tone: "danger" as const },
  { label: "31–60 days", min: 31, max: 60, tone: "warning" as const },
  { label: "61–90 days", min: 61, max: 90, tone: "active" as const },
  { label: "91–120 days", min: 91, max: 120, tone: "neutral" as const },
] as const;

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams: Promise<{ properties?: string; property?: string }>;
}) {
  const scope = await requireScope();
  try {
  const sp = await searchParams;
  const propertyIds = parsePropertyFilter(sp);
  // Fetch all properties for the org, then narrow to the ones this user
  // is allowed to see (via UserPropertyAccess). The dropdown should
  // never show options the user can't pick.
  const allProperties = await prisma.property.findMany({
    where: { orgId: scope.orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const properties = visibleProperties(scope, allProperties);
  // The where clause composes tenant gate + property gate (which itself
  // intersects URL selection with the user's allowed set).
  const where = {
    ...tenantWhere(scope),
    ...propertyWhereFragment(scope, propertyIds),
  };
  const now = new Date();
  const next120 = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);

  const [
    activeCount,
    expiringCount,
    expiredCount,
    pastDueCount,
    pastDueBalance,
    upcoming,
    rentRollTotal,
  ] = await Promise.all([
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
      // `raw` carries the original AppFolio rent_roll row. We read
      // `raw.tenant` as a fallback display name because tenant_directory
      // and rent_roll keyed off different IDs at sync time, leaving most
      // leases without a linked Resident row.
      select: {
        id: true,
        endDate: true,
        monthlyRentCents: true,
        raw: true,
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

  // Project the Prisma row shape into a flat, JSON-safe RenewalLease so
  // we can hand it to a client component without dragging Prisma's Date
  // and JsonValue types across the boundary. tenantNameFromRaw stays on
  // the server because it reads the AppFolio raw blob.
  const upcomingRows: RenewalLease[] = upcoming.map((l) => {
    const residentName =
      [l.resident?.firstName, l.resident?.lastName].filter(Boolean).join(" ") ||
      tenantNameFromRaw(l.raw) ||
      l.resident?.email ||
      "Resident";
    return {
      id: l.id,
      endDateIso: l.endDate ? l.endDate.toISOString() : null,
      monthlyRentCents: l.monthlyRentCents,
      propertyId: l.property.id,
      propertyName: l.property.name,
      unitNumber: l.listing?.unitNumber ?? null,
      residentName,
      residentEmail: l.resident?.email ?? null,
      residentPhone: l.resident?.phone ?? null,
    };
  });

  // Bucket leases by days-until-expiration
  const buckets: RenewalBucket[] = BUCKETS.map((b) => ({
    label: b.label,
    tone: b.tone,
    items: [] as RenewalLease[],
  }));
  for (const row of upcomingRows) {
    if (!row.endDateIso) continue;
    const days = differenceInDays(new Date(row.endDateIso), now);
    for (let i = 0; i < BUCKETS.length; i++) {
      const b = BUCKETS[i];
      if (days >= b.min && days <= b.max) {
        buckets[i].items.push(row);
        break;
      }
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Renewals"
        description="Lease expirations from AppFolio. Act on renewals 120 days out so resignation deadlines never slip."
        actions={
          <PropertyMultiSelect properties={properties} orgId={scope.orgId} />
        }
      />

      {isAccessDenied(scope, propertyIds) ? (
        <PropertyAccessDeniedBanner pathname="/portal/renewals" />
      ) : null}

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

      <RenewalsClient buckets={buckets} upcoming={upcomingRows} />
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
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Renewal data could not be loaded.{" "}
          {err instanceof Error ? err.message : ""}
        </div>
      </div>
    );
  }
}

