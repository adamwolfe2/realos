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

// Background sync jobs (lib/integrations/appfolio-sync.ts, ads-sync.ts,
// lib/actions/admin-appfolio.ts) log their outcome as a SETTING_CHANGE audit
// action — AuditEvent has no dedicated status column, so there's nothing
// more "structured" to key off of than the description each job writes.
// Those descriptions are fixed, server-generated templates (never free-form
// user text), so matching them here is a stable lookup, not string-guessing.
// This turns "Changed a setting · AppFolio sync" into "AppFolio sync
// completed" / "…completed with warnings" / "…failed" — whichever actually
// happened. Anything that doesn't match one of these templates (a genuine
// settings edit, or the Cursive resync line, which already reads fine) falls
// through untouched.
type SyncTone = "warning" | "danger" | null;

function syncRunLabel(
  description: string | null,
): { label: string; tone: SyncTone } | null {
  if (!description) return null;

  const failed = description.match(
    /^(.+?) sync (?:triggered by agency staff )?\(?failed/i,
  );
  if (failed) return { label: `${failed[1]} sync failed`, tone: "danger" };

  const warnings = description.match(/^(.+?) sync completed with warnings:/i);
  if (warnings) {
    return {
      label: `${warnings[1]} sync completed with warnings`,
      tone: "warning",
    };
  }

  const completed = description.match(
    /^(.+?) sync (?:completed|triggered by agency staff)\b/i,
  );
  if (completed) return { label: `${completed[1]} sync completed`, tone: null };

  return null;
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
            const sync =
              a.action === "SETTING_CHANGE" ? syncRunLabel(a.description) : null;
            const label = sync?.label ?? humanAuditAction(a.action);
            // Non-sync descriptions keep the old "warning" substring sniff
            // (e.g. any future free-text note that happens to say
            // "warning") so nothing that worked before regresses.
            const tone: SyncTone =
              sync?.tone ??
              (a.description?.toLowerCase().includes("warning")
                ? "warning"
                : null);

            return (
              <li key={a.id} className="text-sm flex items-start gap-3 min-w-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1.5 inline-block h-1.5 w-1.5 rounded-full shrink-0",
                    tone === null && "bg-muted-foreground/40",
                    tone === "danger" && "bg-destructive",
                  )}
                  style={tone === "warning" ? { background: "var(--warning)" } : undefined}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-foreground flex items-center gap-1.5 flex-wrap">
                    <span>{label}</span>
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
                        tone === null && "text-muted-foreground",
                        tone === "danger" && "text-destructive",
                      )}
                      style={tone === "warning" ? { color: "#8a6d00" } : undefined}
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
