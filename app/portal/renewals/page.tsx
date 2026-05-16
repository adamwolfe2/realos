import type { Metadata } from "next";
import { differenceInDays, formatDistanceToNow as fdtn } from "date-fns";
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
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { getAppFolioStatus } from "@/lib/integrations/appfolio-status";
import { AppFolioStatusBanner } from "@/components/portal/integrations/appfolio-status-banner";
import { RunAppFolioSyncButton } from "@/components/portal/integrations/run-appfolio-sync-button";
import { StaleOnLoadTrigger } from "@/components/portal/sync/stale-on-load-trigger";
import { classifyFreshness } from "@/lib/sync/freshness";
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
  // Marketable filter: dropdown lists ACTIVE properties only (no IMPORTED
  // curation-queue rows, no EXCLUDED parking lots / storage / placeholders).
  // Without this, SG Real Estate's 127 AppFolio rows surfaced in every
  // filter dropdown including this one.
  const allProperties = await prisma.property.findMany({
    where: marketablePropertyWhere(scope.orgId),
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
    appfolioStatus,
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
    getAppFolioStatus(scope.orgId).catch(() => null),
  ]);

  // Freshness classification — tells us whether to auto-trigger a sync on
  // page load. AppFolio's budget is already 1h stale / 24h very_stale
  // (see lib/sync/freshness.ts), which is the right cadence for lease
  // data — operators expect anything older than the hourly cron to
  // self-heal on view.
  const freshness = appfolioStatus
    ? classifyFreshness("appfolio", appfolioStatus.lastSyncAt, {
        syncInProgress: appfolioStatus.state === "syncing",
        hasError: appfolioStatus.state === "failed",
      })
    : null;
  const shouldAutoSync =
    appfolioStatus &&
    (appfolioStatus.state === "synced" ||
      appfolioStatus.state === "never_synced") &&
    (freshness?.shouldAutoTrigger ?? false);

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

  // Concise freshness line for the page header — operators see exactly how
  // current the leases are without having to mentally translate the global
  // chrome strip's "16d ago" into "should I trust this page".
  const lastSyncLabel = appfolioStatus?.lastSyncAt
    ? `Synced ${fdtn(appfolioStatus.lastSyncAt, { addSuffix: true })}`
    : appfolioStatus?.state === "syncing"
      ? "Sync in progress"
      : appfolioStatus?.state === "failed"
        ? "Sync failed — see banner below"
        : "Never synced";

  return (
    <div className="space-y-4">
      {/* Auto-trigger an AppFolio sync if data is stale when the page
          mounts. Operators visiting Renewals expect fresh lease data;
          this short-circuits the wait for the next hourly cron. The
          sessionStorage dedupe key prevents two tabs / two banners on
          the same load from firing redundant syncs. */}
      {shouldAutoSync ? (
        <StaleOnLoadTrigger
          endpoint="/api/tenant/appfolio/sync"
          dedupeKey={`appfolio:renewals:${scope.orgId}`}
        />
      ) : null}

      <PageHeader
        title="Renewals"
        description="Lease expirations from AppFolio. Act on renewals 120 days out so resignation deadlines never slip."
        actions={
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <span className="text-[11px] text-muted-foreground hidden md:inline-block">
              {lastSyncLabel}
            </span>
            <RunAppFolioSyncButton label="Sync now" subtle />
            <PropertyMultiSelect properties={properties} orgId={scope.orgId} />
          </div>
        }
      />

      {/* Per-page AppFolio status banner. Visible only when state is NOT
          a clean "synced + fresh" — i.e. surfaces actively when the
          operator needs to know data isn't current. The banner covers
          syncing / never_synced / failed / stale states with appropriate
          actions (retry, connect, dismiss). */}
      {appfolioStatus &&
      (appfolioStatus.state !== "synced" ||
        appfolioStatus.stale ||
        (appfolioStatus.stats?.warnings?.length ?? 0) > 0) ? (
        <AppFolioStatusBanner
          status={appfolioStatus}
          resourceLabel="leases"
          orgId={scope.orgId}
        />
      ) : null}

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
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
          Renewal data could not be loaded.{" "}
          {err instanceof Error ? err.message : ""}
        </div>
      </div>
    );
  }
}

