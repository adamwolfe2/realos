"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Building2, Users, ChevronRight } from "lucide-react";
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

export function UnitApplicationsBoard({ units }: { units: UnitGroup[] }) {
  const [selected, setSelected] = useState<Selected>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {units.map((unit) => (
          <section
            key={unit.unitKey}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3.5 py-2.5">
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground truncate">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {unit.unitName}
                </h3>
                <p className="text-[11px] text-muted-foreground truncate">
                  {unit.propertyName}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                <Users className="h-3 w-3" />
                {unit.applicantCount}
              </span>
            </header>

            <ul className="divide-y divide-border">
              {unit.groups.map((group) => {
                const ts = toDate(group.receivedAt);
                const coCount = group.applicants.length - 1;
                return (
                  <li key={group.groupId}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelected({
                          group,
                          unitName: unit.unitName,
                          propertyName: unit.propertyName,
                        })
                      }
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-foreground truncate">
                          {group.primaryName}
                          {coCount > 0 ? (
                            <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                              +{coCount} co-applicant{coCount === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {ts
                            ? `${format(ts, "MMM d")} · ${formatDistanceToNow(ts, {
                                addSuffix: true,
                              })}`
                            : "No received date"}
                        </p>
                      </div>
                      <StatusPill
                        label={STATUS_LABEL[group.status]}
                        tone={STATUS_TONE[group.status]}
                      />
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
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
