import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/admin/page-header";
import { humanAuditAction } from "@/lib/format";
import type { AuditAction } from "@prisma/client";

type AuditRow = {
  id: string;
  action: AuditAction;
  entityType: string | null;
  description: string | null;
  createdAt: Date;
};

type DedupedRow = AuditRow & { count: number };

// Friendlier names for the entity types that show up most often on this
// page. Falls back to inserting spaces before capitals ("AppFolioIntegration"
// → "App Folio Integration") for anything not explicitly mapped.
const ENTITY_LABEL: Record<string, string> = {
  AppFolioIntegration: "AppFolio sync",
  CursiveIntegration: "Cursive pixel",
  Organization: "Client profile",
  Domain: "Domain",
  User: "Team member",
  Property: "Property",
  TenantSiteConfig: "Site settings",
  SeoIntegration: "SEO connection",
  AdAccount: "Ad account",
};

function humanEntity(entityType: string | null): string | null {
  if (!entityType) return null;
  if (ENTITY_LABEL[entityType]) return ENTITY_LABEL[entityType];
  return entityType.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

// Collapse consecutive identical rows (same action + entityType +
// description) into one row with a ×N count. Audit rows arrive newest-first
// already, so the first occurrence encountered keeps the most recent
// timestamp — later duplicates only bump the counter.
function dedupeAudits(events: AuditRow[]): DedupedRow[] {
  const out: DedupedRow[] = [];
  for (const e of events) {
    const last = out[out.length - 1];
    if (
      last &&
      last.action === e.action &&
      last.entityType === e.entityType &&
      last.description === e.description
    ) {
      last.count += 1;
    } else {
      out.push({ ...e, count: 1 });
    }
  }
  return out;
}

export function ActivityTab({ events }: { events: AuditRow[] }) {
  const rows = dedupeAudits(events);

  return (
    <SectionCard label="Activity">
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => {
            // Warnings (e.g. "AppFolio sync completed with warnings: …
            // timeout") get the warning token instead of blending into the
            // same gray as every other row.
            const isWarning =
              a.description?.toLowerCase().includes("warning") ?? false;
            return (
              <li key={a.id} className="text-sm flex items-start gap-3 min-w-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1.5 inline-block h-1.5 w-1.5 rounded-full shrink-0",
                    !isWarning && "bg-muted-foreground/40",
                  )}
                  style={isWarning ? { background: "var(--warning)" } : undefined}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-foreground flex items-center gap-1.5 flex-wrap">
                    <span>{humanAuditAction(a.action)}</span>
                    {humanEntity(a.entityType) ? (
                      <span className="text-muted-foreground">
                        · {humanEntity(a.entityType)}
                      </span>
                    ) : null}
                    {a.count > 1 ? (
                      <span className="text-[10px] font-semibold text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 tabular-nums">
                        ×{a.count}
                      </span>
                    ) : null}
                  </div>
                  {a.description ? (
                    <div
                      className={cn(
                        "text-[11px] mt-0.5 truncate",
                        !isWarning && "text-muted-foreground",
                      )}
                      style={isWarning ? { color: "#8a6d00" } : undefined}
                    >
                      {a.description}
                    </div>
                  ) : null}
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(a.createdAt, { addSuffix: true })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
