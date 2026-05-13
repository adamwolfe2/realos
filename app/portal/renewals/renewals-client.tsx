"use client";

import * as React from "react";
import Link from "next/link";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { CheckSquare, Square, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { SideDrawer } from "@/components/portal/ui/side-drawer";
import { BulkActionBar } from "@/components/portal/ui/bulk-action-bar";
import { StatusPill, type StatusTone } from "@/components/portal/ui/status-pill";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";

// ---------------------------------------------------------------------------
// RenewalsClient — wraps the renewals pipeline + actionable list table so
// each bucket card AND each table row open a unified SideDrawer with the
// resident / lease summary. The bottom table also supports row checkboxes
// + a BulkActionBar (Send renewal offer / Mark contacted) so the operator
// can act on a batch without leaving the page.
//
// The server page passes pre-bucketed leases plus the flat upcoming list;
// we keep all rendering identical to the previous server-only implementation
// (StatusPill chrome, KpiTile section above, etc.) so the swap is purely
// additive UX.
// ---------------------------------------------------------------------------

export type RenewalLease = {
  id: string;
  endDateIso: string | null;
  monthlyRentCents: number | null;
  propertyId: string;
  propertyName: string;
  unitNumber: string | null;
  residentName: string;
  residentEmail: string | null;
  residentPhone: string | null;
};

export type RenewalBucket = {
  label: string;
  tone: StatusTone;
  items: RenewalLease[];
};

type Props = {
  buckets: RenewalBucket[];
  upcoming: RenewalLease[];
};

function fmtMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function RenewalsClient({ buckets, upcoming }: Props) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  // Look up the open lease across the flat upcoming list — bucket items
  // are subsets of `upcoming`, so this single source covers both surfaces.
  const openLease = React.useMemo(
    () => upcoming.find((l) => l.id === openId) ?? null,
    [upcoming, openId],
  );

  const allChecked = upcoming.length > 0 && selected.size === upcoming.length;
  const someChecked = selected.size > 0 && !allChecked;

  function toggleAll() {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(upcoming.map((l) => l.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelected(new Set());
  }

  // Stub bulk actions. Both kept as stubs because:
  //  - "Send renewal offer" requires a renewal-email template + Resend
  //    integration that doesn't exist yet (no template under lib/email/).
  //  - "Mark contacted" requires a Resident.lastContactedAt column that
  //    isn't in the Prisma schema today.
  // The toast copy makes that explicit so operators don't think the bulk
  // action silently committed.
  function stubSendRenewalOffer() {
    toast.message("Renewal offer template coming", {
      description: "Track this on the roadmap at /portal/insights.",
    });
    clearSelection();
  }
  function stubMarkContacted() {
    toast.message("Resident contact tracking coming", {
      description: "Track this on the roadmap at /portal/insights.",
    });
    clearSelection();
  }

  const now = new Date();

  return (
    <>
      {/* Bucketed renewal pipeline — bucket cards open the same drawer the
          table rows do, giving the pipeline + actionable list a unified
          detail experience. */}
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
                  className="rounded-lg border border-border bg-card p-2.5"
                >
                  <div className="flex items-center justify-between gap-2 mb-2 px-1">
                    <StatusPill label={b.label} tone={b.tone} />
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
                      {b.items.slice(0, 50).map((l) => (
                        <li key={l.id}>
                          <button
                            type="button"
                            onClick={() => setOpenId(l.id)}
                            className="block w-full text-left rounded-md border border-border bg-card hover:border-primary/40 hover:bg-muted/30 px-2 py-1.5 transition-colors"
                          >
                            <p className="text-[11px] font-medium text-foreground truncate">
                              {l.residentName}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {l.propertyName}
                              {l.unitNumber ? ` · Unit ${l.unitNumber}` : ""}
                            </p>
                            <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                              <span>
                                {l.endDateIso
                                  ? format(new Date(l.endDateIso), "MMM d")
                                  : "—"}
                              </span>
                              <span>{fmtMoney(l.monthlyRentCents)}</span>
                            </div>
                          </button>
                        </li>
                      ))}
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
          <div className="space-y-2">
            <BulkActionBar
              count={selected.size}
              onClear={clearSelection}
              noun="resident"
            >
              <button
                type="button"
                onClick={stubSendRenewalOffer}
                className="inline-flex items-center rounded-md bg-primary text-primary-foreground hover:bg-primary-dark px-2.5 py-1 text-xs font-medium transition-colors"
              >
                Send renewal offer
              </button>
              <button
                type="button"
                onClick={stubMarkContacted}
                className="inline-flex items-center rounded-md border border-border bg-background hover:bg-muted px-2.5 py-1 text-xs font-medium transition-colors"
              >
                Mark contacted
              </button>
            </BulkActionBar>

            <div className="overflow-x-auto -mx-4 md:mx-0">
              <table className="w-full text-xs min-w-[760px]">
                <thead className="text-left text-[10px] tracking-widest uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="w-10 px-2 py-2">
                      <button
                        type="button"
                        onClick={toggleAll}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={allChecked ? "Deselect all" : "Select all"}
                      >
                        {allChecked || someChecked ? (
                          <CheckSquare
                            className={cn(
                              "h-3.5 w-3.5",
                              someChecked && "opacity-60",
                            )}
                          />
                        ) : (
                          <Square className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </th>
                    <th className="px-2 py-2 font-medium">Resident</th>
                    <th className="px-2 py-2 font-medium">Property</th>
                    <th className="px-2 py-2 font-medium">Unit</th>
                    <th className="px-2 py-2 font-medium text-right">Rent</th>
                    <th className="px-2 py-2 font-medium">End date</th>
                    <th className="px-2 py-2 font-medium text-right">
                      Days left
                    </th>
                    <th className="px-2 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((l) => {
                    const days = l.endDateIso
                      ? differenceInDays(new Date(l.endDateIso), now)
                      : null;
                    const tone =
                      days != null && days <= 30
                        ? "text-foreground font-bold"
                        : days != null && days <= 60
                          ? "text-foreground font-semibold"
                          : "text-foreground";
                    const isSelected = selected.has(l.id);
                    return (
                      <tr
                        key={l.id}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest("a, button, input, select, label"))
                            return;
                          setOpenId(l.id);
                        }}
                        className={cn(
                          "border-b border-border last:border-0 cursor-pointer transition-colors",
                          isSelected ? "bg-primary/5" : "hover:bg-muted/40",
                        )}
                      >
                        <td className="px-2 py-2 align-middle">
                          <button
                            type="button"
                            onClick={() => toggleOne(l.id)}
                            aria-label={
                              isSelected
                                ? "Deselect resident"
                                : "Select resident"
                            }
                            className={cn(
                              "transition-colors",
                              isSelected
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {isSelected ? (
                              <CheckSquare className="h-3.5 w-3.5" />
                            ) : (
                              <Square className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="px-2 py-2 text-foreground">
                          {l.residentName}
                          {l.residentEmail ? (
                            <p className="text-[10px] text-muted-foreground">
                              {l.residentEmail}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 text-foreground">
                          {l.propertyName}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {l.unitNumber ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {fmtMoney(l.monthlyRentCents)}
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          {l.endDateIso
                            ? format(new Date(l.endDateIso), "MMM d, yyyy")
                            : "—"}
                        </td>
                        <td
                          className={`px-2 py-2 text-right tabular-nums ${tone}`}
                        >
                          {days != null ? `${days}d` : "—"}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Link
                            href={`/portal/properties/${l.propertyId}`}
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
          </div>
        )}
      </DashboardSection>

      <SideDrawer
        open={openLease != null}
        onOpenChange={(o) => setOpenId(o ? openId : null)}
        title={openLease?.residentName ?? ""}
        description={
          openLease
            ? [openLease.propertyName, openLease.unitNumber ? `Unit ${openLease.unitNumber}` : null]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        headerActions={
          openLease ? (
            <Link
              href={`/portal/properties/${openLease.propertyId}`}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background hover:bg-muted px-2 py-1 text-[11px] font-medium text-foreground transition-colors"
            >
              Open property
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          ) : null
        }
        footer={
          openLease ? (
            <>
              <button
                type="button"
                onClick={() => {
                  toast.message("Resident contact tracking coming", {
                    description:
                      "Track this on the roadmap at /portal/insights.",
                  });
                  setOpenId(null);
                }}
                className="inline-flex items-center rounded-md border border-border bg-background hover:bg-muted px-3 py-1.5 text-xs font-medium transition-colors"
              >
                Mark contacted
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.message("Renewal offer template coming", {
                    description:
                      "Track this on the roadmap at /portal/insights.",
                  });
                  setOpenId(null);
                }}
                className="inline-flex items-center rounded-md bg-primary text-primary-foreground hover:bg-primary-dark px-3 py-1.5 text-xs font-medium transition-colors"
              >
                Send renewal offer
              </button>
            </>
          ) : null
        }
      >
        {openLease ? <RenewalDrawerBody lease={openLease} /> : null}
      </SideDrawer>
    </>
  );
}

function RenewalDrawerBody({ lease }: { lease: RenewalLease }) {
  const now = new Date();
  const end = lease.endDateIso ? new Date(lease.endDateIso) : null;
  const days = end ? differenceInDays(end, now) : null;
  return (
    <div className="space-y-4 text-sm">
      <section className="space-y-1.5">
        <h3 className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          Lease
        </h3>
        <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">End date</dt>
          <dd className="col-span-2 text-foreground tabular-nums">
            {end ? format(end, "MMM d, yyyy") : "—"}
          </dd>
          <dt className="text-muted-foreground">Days left</dt>
          <dd className="col-span-2 text-foreground tabular-nums">
            {days != null ? (
              <>
                {days}d{" "}
                <span className="text-muted-foreground">
                  ({end ? formatDistanceToNow(end, { addSuffix: true }) : ""})
                </span>
              </>
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-muted-foreground">Monthly rent</dt>
          <dd className="col-span-2 text-foreground tabular-nums">
            {fmtMoney(lease.monthlyRentCents)}
          </dd>
        </dl>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          Resident
        </h3>
        <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="col-span-2 text-foreground">{lease.residentName}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="col-span-2 text-foreground break-all">
            {lease.residentEmail ?? (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
          <dt className="text-muted-foreground">Phone</dt>
          <dd className="col-span-2 text-foreground">
            {lease.residentPhone ?? (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </dl>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          Unit
        </h3>
        <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">Property</dt>
          <dd className="col-span-2 text-foreground">{lease.propertyName}</dd>
          <dt className="text-muted-foreground">Unit</dt>
          <dd className="col-span-2 text-foreground">
            {lease.unitNumber ?? <span className="text-muted-foreground">—</span>}
          </dd>
        </dl>
      </section>

      <p className="text-[11px] text-muted-foreground">
        Renewal history, payment ledger, and AppFolio raw data live on the
        property page.
      </p>
    </div>
  );
}
