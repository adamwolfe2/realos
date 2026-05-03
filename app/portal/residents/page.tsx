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
import { PageHeader } from "@/components/admin/page-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { AppFolioStatusBanner } from "@/components/portal/integrations/appfolio-status-banner";
import { getAppFolioStatus } from "@/lib/integrations/appfolio-status";
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

const STATUS_TONE: Record<ResidentStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  NOTICE_GIVEN: "bg-amber-50 text-amber-800 border-amber-200",
  EVICTED: "bg-rose-50 text-rose-700 border-rose-200",
  PAST: "bg-muted text-muted-foreground border-border",
  APPLICANT: "bg-blue-50 text-blue-800 border-blue-200",
};

function fmtMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function ResidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; property?: string }>;
}) {
  const scope = await requireScope();
  try {
  const where = tenantWhere(scope);
  const sp = await searchParams;

  const filterStatus = (Object.values(ResidentStatus) as string[]).includes(
    sp.status ?? "",
  )
    ? (sp.status as ResidentStatus)
    : null;

  const baseFilter = {
    ...where,
    ...(filterStatus ? { status: filterStatus } : {}),
    ...(sp.property ? { propertyId: sp.property } : {}),
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
    appfolioStatus,
    activeCount,
    noticeCount,
    pastCount,
    withEmailCount,
    withPhoneCount,
    residents,
    properties,
    noticeBoard,
  ] = await Promise.all([
    getAppFolioStatus(scope.orgId),
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
      where,
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
      />

      <AppFolioStatusBanner status={appfolioStatus} resourceLabel="residents" />

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
        <select
          name="property"
          defaultValue={sp.property ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Name, email, phone, unit"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
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
                        className={`px-2 py-2 text-right tabular-nums ${days != null && days <= 30 ? "text-rose-700 font-semibold" : "text-foreground"}`}
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

      {/* Roster table */}
      <DashboardSection
        title="Roster"
        eyebrow={`${residents.length} of all matching`}
        description="Read-only mirror. Edit a resident in AppFolio; changes sync on next run."
      >
        {residents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No residents match these filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-xs min-w-[800px]">
              <thead className="text-left text-[10px] tracking-widest uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 md:px-2 py-2 font-medium">Resident</th>
                  <th className="px-2 py-2 font-medium">Property</th>
                  <th className="px-2 py-2 font-medium">Unit</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium text-right">Rent</th>
                  <th className="px-2 py-2 font-medium">Move-in</th>
                  <th className="px-2 py-2 font-medium">Lease end</th>
                  <th className="px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {residents.map((r) => {
                  const name =
                    [r.firstName, r.lastName].filter(Boolean).join(" ") ||
                    r.email ||
                    "Resident";
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-border last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 md:px-2 py-2 text-foreground">
                        {name}
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          {r.email ? (
                            <span className="truncate max-w-[140px]">{r.email}</span>
                          ) : null}
                          {r.phone ? <span>{r.phone}</span> : null}
                        </div>
                      </td>
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
                      <td className="px-2 py-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_TONE[r.status]}`}
                        >
                          {STATUS_LABEL[r.status]}
                        </span>
                        {r.currentLease?.isPastDue ? (
                          <span className="ml-1 inline-flex items-center text-[10px] text-rose-700 font-semibold">
                            past-due {fmtMoney(r.currentLease.currentBalanceCents)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {fmtMoney(
                          r.currentLease?.monthlyRentCents ?? r.monthlyRentCents,
                        )}
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {r.moveInDate ? format(r.moveInDate, "MMM yyyy") : "—"}
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {r.currentLease?.endDate
                          ? format(r.currentLease.endDate, "MMM d, yyyy")
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {r.leadId ? (
                          <Link
                            href={`/portal/leads/${r.leadId}`}
                            className="text-[11px] font-medium text-foreground hover:text-primary"
                          >
                            Lead →
                          </Link>
                        ) : null}
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
    console.error("[residents] Failed to load AppFolio data:", err);
    return (
      <div className="space-y-4">
        <PageHeader
          title="Residents"
          description="Active roster mirrored from AppFolio. Source of truth for resident records remains AppFolio; this view is read-only."
        />
        <AppFolioStatusBanner
          status={{
            state: "failed",
            lastSyncAt: null,
            lastError:
              err instanceof Error ? err.message : "Resident data could not be loaded.",
            subdomain: null,
            stale: false,
          }}
          resourceLabel="residents"
        />
      </div>
    );
  }
}
