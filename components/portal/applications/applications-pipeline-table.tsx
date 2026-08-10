import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { StatusPill, type StatusTone } from "@/components/portal/ui/status-pill";
import { ApplicationStatus } from "@prisma/client";
import { leadDisplayName } from "@/lib/leads/display-name";

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

export type PipelineRow = {
  id: string;
  status: ApplicationStatus;
  appliedAt: Date | null;
  decidedAt: Date | null;
  createdAt: Date;
  lead: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
  property: { id: string; name: string };
};

// ---------------------------------------------------------------------------
// Flat, single-table pipeline view — replaces the 6-column kanban swimlane.
// Same `apps` rows the page already fetches (last 90 days, most recent
// first); status is a column, not a column-per-status board, so it reads as
// one dense surface instead of a stacked card pile.
// ---------------------------------------------------------------------------
export function ApplicationsPipelineTable({
  apps,
  caption,
}: {
  apps: PipelineRow[];
  caption?: string;
}) {
  return (
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
              <th className="hidden px-4 py-2.5 text-left sm:table-cell">
                Property
              </th>
              <th className="px-4 py-2.5 text-left">Status</th>
              <th className="px-4 py-2.5 text-right">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hair)]">
            {apps.map((a) => {
              const name = leadDisplayName(a.lead);
              const ts = a.decidedAt ?? a.appliedAt ?? a.createdAt;
              return (
                <tr key={a.id} className="h-11 transition-colors hover:bg-muted/30">
                  <td className="max-w-[240px] truncate px-4 font-medium">
                    <Link
                      href={`/portal/leads/${a.lead.id}`}
                      className="text-foreground hover:text-primary transition-colors"
                    >
                      {name}
                    </Link>
                  </td>
                  <td className="hidden max-w-[220px] truncate px-4 text-muted-foreground sm:table-cell">
                    {a.property.name}
                  </td>
                  <td className="px-4">
                    <StatusPill label={STATUS_LABEL[a.status]} tone={STATUS_TONE[a.status]} />
                  </td>
                  <td className="whitespace-nowrap px-4 text-right font-mono text-[12px] text-muted-foreground tabular-nums">
                    {formatDistanceToNow(ts, { addSuffix: true })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
