import Link from "next/link";
import { format, differenceInDays } from "date-fns";
import { prisma } from "@/lib/db";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { LeaseStatus } from "@prisma/client";
import { Calendar, AlertTriangle, CheckCircle2, DollarSign } from "lucide-react";
import { EmptyState } from "@/components/portal/ui/empty-state";
import { tenantNameFromRaw } from "@/lib/integrations/appfolio-display";

// ---------------------------------------------------------------------------
// Renewals tab — per-property lease renewal pipeline from AppFolio.
// ---------------------------------------------------------------------------

function fmtMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const BUCKETS = [
  { label: "0–30 days", min: 0, max: 30, tone: "border-border bg-muted text-foreground" },
  { label: "31–60 days", min: 31, max: 60, tone: "border-border bg-muted/40 text-foreground" },
  { label: "61–90 days", min: 61, max: 90, tone: "border-primary/30 bg-primary/10 text-primary" },
  { label: "91–120 days", min: 91, max: 120, tone: "border-border bg-card text-foreground" },
] as const;

export async function RenewalsTab({
  orgId,
  propertyId,
}: {
  orgId: string;
  propertyId: string;
}) {
  try {
  const now = new Date();
  const next120 = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);

  const [activeCount, expiredCount, pastDueCount, pastDueBalance, rentRoll, upcoming] =
    await Promise.all([
      prisma.lease.count({ where: { orgId, propertyId, status: LeaseStatus.ACTIVE } }),
      prisma.lease.count({
        where: {
          orgId,
          propertyId,
          endDate: { lt: now, gte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.lease.count({ where: { orgId, propertyId, isPastDue: true } }),
      prisma.lease.aggregate({
        where: { orgId, propertyId, isPastDue: true },
        _sum: { currentBalanceCents: true },
      }),
      prisma.lease.aggregate({
        where: { orgId, propertyId, status: LeaseStatus.ACTIVE },
        _sum: { monthlyRentCents: true },
      }),
      prisma.lease.findMany({
        where: {
          orgId,
          propertyId,
          status: { in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRING] },
          endDate: { gte: now, lte: next120 },
        },
        orderBy: { endDate: "asc" },
        // Pull `raw` so we can fall back to the AppFolio rent_roll
        // tenant display name when no Resident row is linked.
        select: {
          id: true,
          endDate: true,
          monthlyRentCents: true,
          raw: true,
          listing: { select: { id: true, unitNumber: true } },
          resident: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    ]);

  // Bucket by days until expiration
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
      if (days >= BUCKETS[i].min && days <= BUCKETS[i].max) {
        buckets[i].items.push(l);
        break;
      }
    }
  }

  if (activeCount === 0 && upcoming.length === 0) {
    return (
      <EmptyState
        title="No lease data yet"
        body="AppFolio sync will populate lease records from the rent roll report."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="Active leases"
          value={activeCount.toLocaleString()}
          /* Bug #18 — was "Currently in residence" which read like a
             headcount, but lease records ≠ residents (one resident
             can hold multiple historical/co-leased records). The
             Residents tab "Active" KPI is the headcount; this tile
             counts lease rows. Hint clarifies the relationship. */
          hint="Lease records · Residents tab shows headcount"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Expiring (120d)"
          value={upcoming.length.toLocaleString()}
          hint="Need renewal action"
          icon={<Calendar className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Monthly rent roll"
          value={fmtMoney(rentRoll._sum.monthlyRentCents ?? 0)}
          hint="From active leases"
          icon={<DollarSign className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Past-due"
          value={pastDueCount.toLocaleString()}
          hint={`${fmtMoney(pastDueBalance._sum.currentBalanceCents ?? 0)} owed`}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
      </section>

      {upcoming.length > 0 ? (
        <DashboardSection
          title="Renewal pipeline"
          eyebrow="Next 120 days"
          description="Grouped by days until expiration. Act early — 90-day notice windows close fast."
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {buckets.map((b) => (
              <div key={b.label} className={`rounded-lg border ${b.tone} p-2.5`}>
                <div className="flex items-center justify-between gap-2 mb-2 px-1">
                  <span className="text-[10px] tracking-widest uppercase font-semibold">
                    {b.label}
                  </span>
                  <span className="text-xs font-semibold tabular-nums">
                    {b.items.length}
                  </span>
                </div>
                {b.items.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic px-1 py-2">None</p>
                ) : (
                  <ul className="space-y-1.5 max-h-[320px] overflow-y-auto">
                    {b.items.map((l) => {
                      const name =
                        [l.resident?.firstName, l.resident?.lastName]
                          .filter(Boolean)
                          .join(" ") ||
                        tenantNameFromRaw(l.raw) ||
                        l.resident?.email ||
                        "Resident";
                      return (
                        <li key={l.id} className="rounded-md border border-border bg-card px-2 py-1.5">
                          <p className="text-[11px] font-medium text-foreground truncate">{name}</p>
                          <div className="flex items-center justify-between mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                            <span>
                              {l.listing?.unitNumber ? `Unit ${l.listing.unitNumber}` : "—"}
                            </span>
                            <span>{l.endDate ? format(l.endDate, "MMM d") : "—"}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                            {fmtMoney(l.monthlyRentCents)}/mo
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </DashboardSection>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No leases expiring in the next 120 days.
          </p>
        </div>
      )}

      {upcoming.length > 0 ? (
        <DashboardSection title="All upcoming renewals" eyebrow="Sorted by end date">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead className="text-left text-[10px] tracking-widest uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 font-medium">Resident</th>
                  <th className="px-2 py-2 font-medium">Unit</th>
                  <th className="px-2 py-2 font-medium text-right">Rent</th>
                  <th className="px-2 py-2 font-medium">End date</th>
                  <th className="px-2 py-2 font-medium text-right">Days left</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((l) => {
                  const name =
                    [l.resident?.firstName, l.resident?.lastName]
                      .filter(Boolean)
                      .join(" ") ||
                    tenantNameFromRaw(l.raw) ||
                    l.resident?.email ||
                    "Resident";
                  const days = l.endDate ? differenceInDays(l.endDate, now) : null;
                  const tone =
                    days != null && days <= 30
                      ? "text-foreground font-bold"
                      : days != null && days <= 60
                        ? "text-foreground font-semibold"
                        : "text-foreground";
                  return (
                    <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="py-2 text-foreground">
                        {name}
                        {l.resident?.email ? (
                          <p className="text-[10px] text-muted-foreground">{l.resident.email}</p>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {l.listing?.unitNumber ? `Unit ${l.listing.unitNumber}` : "—"}
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      ) : null}
    </div>
  );
  } catch (err) {
    console.error("[RenewalsTab] Failed to load AppFolio lease data:", err);
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-6 text-center">
        <p className="text-sm font-semibold text-foreground">Renewal data unavailable</p>
        <p className="mt-1 text-xs text-foreground">
          AppFolio sync may not be configured for this property. Check{" "}
          <a href="/portal/connect" className="underline">Settings → Integrations</a>.
        </p>
      </div>
    );
  }
}
