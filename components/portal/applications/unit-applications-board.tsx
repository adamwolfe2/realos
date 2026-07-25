"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight } from "lucide-react";
import { StatusPill, type StatusTone } from "@/components/portal/ui/status-pill";
import { ApplicationStatus } from "@prisma/client";
import type { UnitGroup, ApplicationGroup } from "@/lib/applications/queries";
import { ApplicantDetailDrawer } from "./applicant-detail-drawer";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  STARTED: "Started",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  DENIED: "Denied",
  WITHDRAWN: "Withdrawn",
};

const STATUS_TONE: Record<ApplicationStatus, StatusTone> = {
  STARTED: "info",
  SUBMITTED: "active",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  DENIED: "danger",
  WITHDRAWN: "neutral",
};

type Selected = {
  group: ApplicationGroup;
  unitName: string;
  propertyName: string;
} | null;

// Dates serialize to ISO strings across the server->client boundary, so the
// runtime value is a string despite the `Date | null` type. Coerce before
// handing to date-fns, which throws on string input.
function toDate(v: Date | string | null): Date | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// One dense table, not a grid of per-unit cards. Unit + property are columns
// on the row rather than a separate nested-card header — "one main surface"
// per DESIGN.md. Units + groups arrive pre-sorted by recency from
// getApplicationsByUnit; flattening here preserves that order.
// ---------------------------------------------------------------------------
export function UnitApplicationsBoard({
  units,
  caption,
}: {
  units: UnitGroup[];
  caption?: string;
}) {
  const [selected, setSelected] = useState<Selected>(null);

  const rows = units.flatMap((unit) =>
    unit.groups.map((group) => ({ unit, group })),
  );

  return (
    <>
      <div className="ls-card overflow-hidden">
        {caption ? (
          <div className="border-b border-[var(--hair)] px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
            {caption}
          </div>
        ) : null}
        <div className="max-h-[560px] overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="sticky top-0 z-[1]">
              <tr className="border-b border-[var(--hair-strong)] bg-secondary text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 text-left">Applicant</th>
                <th className="px-4 py-2.5 text-left">Unit</th>
                <th className="hidden px-4 py-2.5 text-left sm:table-cell">
                  Property
                </th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="hidden px-4 py-2.5 text-right sm:table-cell">
                  Received
                </th>
                <th className="w-8 px-2 py-2.5" aria-hidden="true" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hair)]">
              {rows.map(({ unit, group }) => {
                const ts = toDate(group.receivedAt);
                const coCount = group.applicants.length - 1;
                return (
                  <tr
                    key={group.groupId}
                    onClick={() =>
                      setSelected({
                        group,
                        unitName: unit.unitName,
                        propertyName: unit.propertyName,
                      })
                    }
                    className="h-11 cursor-pointer transition-colors hover:bg-muted/30"
                  >
                    <td className="max-w-[220px] truncate px-4 font-medium text-foreground">
                      {group.primaryName}
                      {coCount > 0 ? (
                        <span className="ml-1.5 font-mono text-[11px] font-normal text-muted-foreground">
                          +{coCount}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[160px] truncate px-4 text-muted-foreground">
                      {unit.unitName}
                    </td>
                    <td className="hidden max-w-[200px] truncate px-4 text-muted-foreground sm:table-cell">
                      {unit.propertyName}
                    </td>
                    <td className="px-4">
                      <StatusPill
                        label={STATUS_LABEL[group.status]}
                        tone={STATUS_TONE[group.status]}
                      />
                    </td>
                    <td className="hidden whitespace-nowrap px-4 text-right font-mono text-[12px] text-muted-foreground tabular-nums sm:table-cell">
                      {ts ? formatDistanceToNow(ts, { addSuffix: true }) : "—"}
                    </td>
                    <td className="px-2 text-right">
                      <ChevronRight
                        className="ml-auto h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ApplicantDetailDrawer
        group={selected?.group ?? null}
        unitName={selected?.unitName ?? ""}
        propertyName={selected?.propertyName ?? ""}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
