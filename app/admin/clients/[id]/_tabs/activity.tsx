import { SectionCard } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDistanceToNow } from "date-fns";
import {
  humanAuditAction,
  humanLeadSource,
  humanLeadStatus,
  leadStatusTone,
} from "@/lib/format";
import type { AuditAction, LeadSource, LeadStatus } from "@prisma/client";

type Audit = {
  id: string;
  action: AuditAction;
  entityType: string | null;
  description: string | null;
  createdAt: Date;
};

type Lead = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  source: LeadSource;
  status: LeadStatus;
};

export function ActivityClientTab({
  recentAudits,
  recentLeads,
}: {
  recentAudits: Audit[];
  recentLeads: Lead[];
}) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <SectionCard
        label="Recent activity"
        description="Last 10 audit events recorded for this client."
      >
        {recentAudits.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {recentAudits.map((a) => (
              <li
                key={a.id}
                className="text-sm flex items-start gap-3 min-w-0"
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-foreground">
                    {humanAuditAction(a.action)}
                    {a.entityType ? (
                      <span className="text-muted-foreground">
                        {" · "}
                        {a.entityType}
                      </span>
                    ) : null}
                  </div>
                  {a.description ? (
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {a.description}
                    </div>
                  ) : null}
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(a.createdAt, { addSuffix: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        label="Recent leads"
        description="Last 10 leads captured for this client."
      >
        {recentLeads.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No leads captured yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {recentLeads.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {l.firstName
                      ? `${l.firstName}${l.lastName ? " " + l.lastName : ""}`
                      : (l.email ?? "Anonymous")}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {humanLeadSource(l.source)}
                  </div>
                </div>
                <StatusBadge tone={leadStatusTone(l.status)}>
                  {humanLeadStatus(l.status)}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </section>
  );
}
