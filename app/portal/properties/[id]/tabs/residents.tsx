import Link from "next/link";
import { format, differenceInDays } from "date-fns";
import { prisma } from "@/lib/db";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { ResidentStatus } from "@prisma/client";
import { Users, AlertTriangle, CheckCircle2, Mail, Phone } from "lucide-react";

// ---------------------------------------------------------------------------
// Residents tab — per-property view of the AppFolio-mirrored resident roster.
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

export async function ResidentsTab({
  orgId,
  propertyId,
}: {
  orgId: string;
  propertyId: string;
}) {
  try {
  const [residents, counts] = await Promise.all([
    prisma.resident.findMany({
      where: { orgId, propertyId },
      orderBy: [{ status: "asc" }, { lastName: "asc" }],
      take: 200,
      include: {
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
    prisma.resident.groupBy({
      by: ["status"],
      where: { orgId, propertyId },
      _count: { _all: true },
    }),
  ]);

  const countByStatus = Object.fromEntries(
    counts.map((c) => [c.status, c._count._all]),
  ) as Partial<Record<ResidentStatus, number>>;

  const activeCount = countByStatus[ResidentStatus.ACTIVE] ?? 0;
  const noticeCount = countByStatus[ResidentStatus.NOTICE_GIVEN] ?? 0;
  const pastCount = countByStatus[ResidentStatus.PAST] ?? 0;

  const withEmail = residents.filter(
    (r) => r.status === ResidentStatus.ACTIVE && r.email,
  ).length;
  const withPhone = residents.filter(
    (r) => r.status === ResidentStatus.ACTIVE && r.phone,
  ).length;

  const noticeBoard = residents.filter(
    (r) => r.status === ResidentStatus.NOTICE_GIVEN,
  );

  if (residents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm font-semibold text-foreground">No residents synced yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          AppFolio sync will populate this tab with the active roster, lease
          data, and notice-given predictive availability.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="Active"
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
          value={activeCount > 0 ? `${Math.round((withEmail / activeCount) * 100)}%` : "—"}
          hint={`${withEmail} of ${activeCount} active`}
          icon={<Mail className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Phone coverage"
          value={activeCount > 0 ? `${Math.round((withPhone / activeCount) * 100)}%` : "—"}
          hint={`${withPhone} of ${activeCount} active`}
          icon={<Phone className="h-3.5 w-3.5" />}
        />
      </section>

      {noticeBoard.length > 0 ? (
        <DashboardSection
          title="Notice given — predictive availability"
          eyebrow={`${noticeBoard.length}`}
          description="Units coming open soon. Fire up campaigns ahead of move-out."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[500px]">
              <thead className="text-left text-[10px] tracking-widest uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 font-medium">Resident</th>
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
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="py-2 text-foreground">{name}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {r.unitNumber ?? r.listing?.unitNumber ?? "—"}
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {r.moveOutDate ? format(r.moveOutDate, "MMM d, yyyy") : "—"}
                      </td>
                      <td
                        className={`px-2 py-2 text-right tabular-nums ${
                          days != null && days <= 30
                            ? "text-rose-700 font-semibold"
                            : "text-foreground"
                        }`}
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

      <DashboardSection
        title="All residents"
        eyebrow={`${residents.length}`}
        description="Read-only mirror from AppFolio. Edit residents in AppFolio; synced on next run."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead className="text-left text-[10px] tracking-widest uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 font-medium">Resident</th>
                <th className="px-2 py-2 font-medium">Unit</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium text-right">Rent</th>
                <th className="px-2 py-2 font-medium">Move-in</th>
                <th className="px-2 py-2 font-medium">Lease end</th>
              </tr>
            </thead>
            <tbody>
              {residents.map((r) => {
                const name =
                  [r.firstName, r.lastName].filter(Boolean).join(" ") ||
                  r.email ||
                  "Resident";
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="py-2 text-foreground">
                      {name}
                      <div className="text-[10px] text-muted-foreground flex gap-2 mt-0.5">
                        {r.email ? (
                          <span className="truncate max-w-[140px]">{r.email}</span>
                        ) : null}
                        {r.phone ? <span>{r.phone}</span> : null}
                      </div>
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
                        <span className="ml-1 text-[10px] text-rose-700 font-semibold">
                          past-due {fmtMoney(r.currentLease.currentBalanceCents)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {fmtMoney(r.currentLease?.monthlyRentCents ?? r.monthlyRentCents)}
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {r.moveInDate ? format(r.moveInDate, "MMM yyyy") : "—"}
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {r.currentLease?.endDate
                        ? format(r.currentLease.endDate, "MMM d, yyyy")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DashboardSection>
    </div>
  );
  } catch (err) {
    console.error("[ResidentsTab] Failed to load AppFolio data:", err);
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm font-semibold text-amber-900">Resident data unavailable</p>
        <p className="mt-1 text-xs text-amber-700">
          AppFolio sync may not be configured for this property. Check{" "}
          <a href="/portal/settings/integrations" className="underline">Settings → Integrations</a>.
        </p>
      </div>
    );
  }
}
