import type { Metadata } from "next";
import Link from "next/link";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import {
  Users,
  Home,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Phone,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
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
import { DataTable, EntityCell } from "@/components/portal/ui/data-table";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { ResidentStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Residents" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/residents — Active resident roster mirrored from AppFolio.
//
// Three views: roster table, "notice given" leaderboard for predictive
// availability, and email/phone hygiene check (residents we can reach
// vs. those we can't).
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<ResidentStatus, string> = {
  ACTIVE: "Active",
  PAST: "Past",
  NOTICE_GIVEN: "Notice given",
  EVICTED: "Evicted",
  APPLICANT: "Applicant",
};

const STATUS_TONE: Record<ResidentStatus, StatusTone> = {
  ACTIVE: "success",
  NOTICE_GIVEN: "warning",
  EVICTED: "danger",
  PAST: "neutral",
  APPLICANT: "active",
};

function fmtMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function ResidentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    property?: string;
    properties?: string;
  }>;
}) {
  const scope = await requireScope();
  try {
  const sp = await searchParams;
  const propertyIds = parsePropertyFilter(sp);
  const where = {
    ...tenantWhere(scope),
    ...propertyWhereFragment(scope, propertyIds),
  };

  const filterStatus = (Object.values(ResidentStatus) as string[]).includes(
    sp.status ?? "",
  )
    ? (sp.status as ResidentStatus)
    : null;

  const baseFilter = {
    ...where,
    ...(filterStatus ? { status: filterStatus } : {}),
    ...(sp.q
      ? {
          OR: [
            { firstName: { contains: sp.q, mode: "insensitive" as const } },
            { lastName: { contains: sp.q, mode: "insensitive" as const } },
            { email: { contains: sp.q, mode: "insensitive" as const } },
            { phone: { contains: sp.q, mode: "insensitive" as const } },
            { unitNumber: { contains: sp.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [
    activeCount,
    noticeCount,
    pastCount,
    withEmailCount,
    withPhoneCount,
    residents,
    properties,
    noticeBoard,
  ] = await Promise.all([
    prisma.resident.count({ where: { ...where, status: ResidentStatus.ACTIVE } }),
    prisma.resident.count({
      where: { ...where, status: ResidentStatus.NOTICE_GIVEN },
    }),
    prisma.resident.count({ where: { ...where, status: ResidentStatus.PAST } }),
    prisma.resident.count({
      where: { ...where, status: ResidentStatus.ACTIVE, email: { not: null } },
    }),
    prisma.resident.count({
      where: { ...where, status: ResidentStatus.ACTIVE, phone: { not: null } },
    }),
    prisma.resident.findMany({
      where: baseFilter,
      orderBy: [{ status: "asc" }, { lastName: "asc" }],
      take: 300,
      include: {
        property: { select: { id: true, name: true } },
        listing: { select: { id: true, unitNumber: true } },
        currentLease: {
          select: {
            id: true,
            endDate: true,
            monthlyRentCents: true,
            isPastDue: true,
            currentBalanceCents: true,
          },
        },
      },
    }),
    prisma.property.findMany({
      // Marketable filter: only ACTIVE properties (no IMPORTED curation
      // queue, no EXCLUDED sub-records). Layered with visibleProperties()
      // below for per-user access gating.
      where: marketablePropertyWhere(scope.orgId),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.resident.findMany({
      where: {
        ...where,
        status: ResidentStatus.NOTICE_GIVEN,
      },
      orderBy: { moveOutDate: "asc" },
      take: 30,
      include: {
        property: { select: { id: true, name: true } },
        listing: { select: { unitNumber: true } },
      },
    }),
  ]);

  const reachableActive = withEmailCount + withPhoneCount > 0 ? activeCount : 0;
  const emailCoveragePct =
    activeCount > 0 ? Math.round((withEmailCount / activeCount) * 100) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Residents"
        description="Active roster mirrored from AppFolio. Source of truth for resident records remains AppFolio; this view is read-only."
        actions={
          <PropertyMultiSelect
            properties={visibleProperties(scope, properties)}
            orgId={scope.orgId}
          />
        }
      />

      {isAccessDenied(scope, propertyIds) ? (
        <PropertyAccessDeniedBanner pathname="/portal/residents" />
      ) : null}

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiTile
          label="Active residents"
          value={activeCount.toLocaleString()}
          hint="Currently in residence"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Notice given"
          value={noticeCount.toLocaleString()}
          hint="Predictive availability"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Email coverage"
          value={emailCoveragePct != null ? `${emailCoveragePct}%` : "—"}
          hint={`${withEmailCount} of ${activeCount} have email`}
          icon={<Mail className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Phone coverage"
          value={
            activeCount > 0
              ? `${Math.round((withPhoneCount / activeCount) * 100)}%`
              : "—"
          }
          hint={`${withPhoneCount} of ${activeCount} have phone`}
          icon={<Phone className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Past residents"
          value={pastCount.toLocaleString()}
          hint="Moved out"
          icon={<Users className="h-3.5 w-3.5" />}
        />
      </section>

      {/* Filters */}
      <form
        action="/portal/residents"
        className="rounded-lg border border-border bg-card p-3 grid grid-cols-1 md:grid-cols-4 gap-3"
      >
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {Object.values(ResidentStatus).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {/* Property filter moved to the page-header PropertyMultiSelect.
            Forwarding the current selection through the form (as a hidden
            field) so submitting status/search filters preserves it. */}
        {sp.properties ? (
          <input type="hidden" name="properties" value={sp.properties} />
        ) : null}
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Name, email, phone, unit"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-3"
        />
        <div className="md:col-span-4 flex gap-2">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary-dark"
          >
            Apply
          </button>
          <Link
            href="/portal/residents"
            className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            Reset
          </Link>
        </div>
      </form>

      {/* Notice given board */}
      {noticeBoard.length > 0 ? (
        <DashboardSection
          title="Notice given — predictive availability"
          eyebrow={`${noticeBoard.length}`}
          description="Units coming open soon. Use these dates to fire up campaigns + AppFolio listings ahead of move-out."
        >
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-xs min-w-[600px]">
              <thead className="text-left text-[10px] tracking-widest uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 md:px-2 py-2 font-medium">Resident</th>
                  <th className="px-2 py-2 font-medium">Property</th>
                  <th className="px-2 py-2 font-medium">Unit</th>
                  <th className="px-2 py-2 font-medium">Move-out</th>
                  <th className="px-2 py-2 font-medium text-right">Days out</th>
                </tr>
              </thead>
              <tbody>
                {noticeBoard.map((r) => {
                  const name =
                    [r.firstName, r.lastName].filter(Boolean).join(" ") ||
                    r.email ||
                    "Resident";
                  const days = r.moveOutDate
                    ? differenceInDays(r.moveOutDate, new Date())
                    : null;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-border last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 md:px-2 py-2 text-foreground">{name}</td>
                      <td className="px-2 py-2 text-foreground">
                        <Link
                          href={`/portal/properties/${r.property.id}`}
                          className="hover:text-primary"
                        >
                          {r.property.name}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {r.unitNumber ?? r.listing?.unitNumber ?? "—"}
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {r.moveOutDate ? format(r.moveOutDate, "MMM d, yyyy") : "—"}
                      </td>
                      <td
                        className={`px-2 py-2 text-right tabular-nums ${days != null && days <= 30 ? "text-foreground font-semibold" : "text-foreground"}`}
                      >
                        {days != null ? `${days}d` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      ) : null}

      {/* Roster table — Twenty-style DataTable */}
      <div>
        <div className="flex items-baseline justify-between mb-2 px-1">
          <div>
            <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
              {residents.length} of all matching
            </p>
            <h2 className="text-[15px] font-medium tracking-tight text-foreground">
              Roster
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Read-only mirror · edit in AppFolio
          </p>
        </div>
        {residents.length === 0 ? (
          <EmptyState
            title="No residents match these filters."
            body="Try clearing the status filter or widening the property selection."
          />
        ) : (
          <DataTable
            rows={residents}
            getRowKey={(r) => r.id}
            getRowHref={(r) =>
              r.leadId
                ? `/portal/leads/${r.leadId}`
                : `/portal/properties/${r.property.id}`
            }
            columns={[
              {
                key: "name",
                header: "Resident",
                accessor: (r) => {
                  const name =
                    [r.firstName, r.lastName].filter(Boolean).join(" ") ||
                    r.email ||
                    "Resident";
                  // Avatars hidden on this roster: AppFolio's resident
                  // sync writes the LLC / client name as firstName for
                  // most rows ("SG Client: 1044 C STREET, LLC"), which
                  // collapses every monogram to the same "S" with
                  // randomized blue backgrounds — pure visual noise. The
                  // leads CRM keeps its avatars because lead names are
                  // real human first/last names with variety.
                  return (
                    <EntityCell
                      name={name}
                      seed={r.id}
                      secondary={r.email ?? r.phone ?? null}
                      hideAvatar
                    />
                  );
                },
              },
              {
                key: "property",
                header: "Property",
                hideOnMobile: true,
                accessor: (r) => (
                  <span className="text-foreground">{r.property.name}</span>
                ),
              },
              {
                key: "unit",
                header: "Unit",
                hideOnMobile: true,
                accessor: (r) =>
                  r.unitNumber ?? r.listing?.unitNumber ?? (
                    <span className="text-muted-foreground">—</span>
                  ),
              },
              {
                key: "status",
                header: "Status",
                accessor: (r) => (
                  <span className="inline-flex items-center gap-1.5">
                    <StatusPill
                      label={STATUS_LABEL[r.status]}
                      tone={STATUS_TONE[r.status]}
                    />
                    {r.currentLease?.isPastDue ? (
                      <span className="text-[10px] text-foreground font-semibold">
                        past-due
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                key: "rent",
                header: "Rent",
                align: "right",
                accessor: (r) =>
                  fmtMoney(
                    r.currentLease?.monthlyRentCents ?? r.monthlyRentCents,
                  ),
              },
              {
                key: "movein",
                header: "Move-in",
                hideOnMobile: true,
                accessor: (r) =>
                  r.moveInDate ? (
                    <span className="text-[11px] tabular-nums">
                      {format(r.moveInDate, "MMM yyyy")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  ),
              },
              {
                key: "leaseEnd",
                header: "Lease end",
                hideOnMobile: true,
                accessor: (r) =>
                  r.currentLease?.endDate ? (
                    <span className="text-[11px] tabular-nums">
                      {format(r.currentLease.endDate, "MMM d, yyyy")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  ),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
  } catch (err) {
    console.error("[residents] Failed to load AppFolio data:", err);
    return (
      <div className="space-y-4">
        <PageHeader
          title="Residents"
          description="Active roster mirrored from AppFolio. Source of truth for resident records remains AppFolio; this view is read-only."
        />
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Resident data could not be loaded.{" "}
          {err instanceof Error ? err.message : ""}
        </div>
      </div>
    );
  }
}
