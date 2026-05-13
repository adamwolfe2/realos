"use client";

import * as React from "react";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckSquare, Square, Loader2, ExternalLink } from "lucide-react";
import { LeadStatus } from "@prisma/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { humanLeadSource } from "@/lib/format";
import {
  bulkUpdateLeadStatus,
  bulkUnsubscribeLeads,
  bulkDeleteLeads,
  bulkAssignLeads,
} from "@/lib/actions/lead-bulk";
import { SideDrawer } from "@/components/portal/ui/side-drawer";
import { BulkActionBar } from "@/components/portal/ui/bulk-action-bar";

export type LeadKanbanItem = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  status: LeadStatus;
  score: number;
  propertyName: string | null;
  createdAt: string;
};

const STATUS_META: Record<
  LeadStatus,
  { label: string; className: string }
> = {
  NEW: {
    label: "New",
    className: "bg-primary/10 text-primary border-primary/30",
  },
  CONTACTED: {
    label: "Contacted",
    className: "bg-muted text-muted-foreground border-border",
  },
  TOUR_SCHEDULED: {
    label: "Tour scheduled",
    className: "bg-muted text-muted-foreground border-border",
  },
  TOURED: {
    label: "Toured",
    className: "bg-muted text-muted-foreground border-border",
  },
  APPLICATION_SENT: {
    label: "App sent",
    className: "bg-muted text-muted-foreground border-border",
  },
  APPLIED: {
    label: "Applied",
    className: "bg-primary/10 text-primary border-primary/30",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-primary/10 text-primary border-primary/30",
  },
  SIGNED: {
    label: "Signed",
    className: "bg-primary/15 text-primary border-primary/30",
  },
  LOST: {
    label: "Lost",
    className: "bg-muted text-muted-foreground border-border",
  },
  UNQUALIFIED: {
    label: "Unqualified",
    className: "bg-muted text-muted-foreground border-border",
  },
};

const TERMINAL_STATUSES = new Set<LeadStatus>([
  LeadStatus.SIGNED,
  LeadStatus.LOST,
  LeadStatus.UNQUALIFIED,
]);

function ageTier(iso: string): "fresh" | "aging" | "stale" {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 7) return "fresh";
  if (days < 15) return "aging";
  return "stale";
}

const AGE_DOT_CLASS: Record<ReturnType<typeof ageTier>, string> = {
  fresh: "bg-primary",
  aging: "bg-amber-400",
  stale: "bg-amber-600",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function LeadKanban({ items }: { items: LeadKanbanItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [statusToApply, setStatusToApply] = React.useState<LeadStatus | "">("");
  // openId drives the SideDrawer — clicking a row opens an inline summary
  // without navigating away from the kanban. The full /portal/leads/[id]
  // page remains canonical and deep-linkable; the drawer is purely a
  // "stay in context" affordance.
  const [openId, setOpenId] = React.useState<string | null>(null);
  const openLead = React.useMemo(
    () => items.find((i) => i.id === openId) ?? null,
    [items, openId],
  );

  const allChecked = items.length > 0 && selected.size === items.length;
  const someChecked = selected.size > 0 && !allChecked;

  function toggleAll() {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
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
    setStatusToApply("");
    setError(null);
  }

  function applyStatus() {
    if (!statusToApply) return;
    setError(null);
    const ids = Array.from(selected);
    startTransition(async () => {
      const r = await bulkUpdateLeadStatus({
        leadIds: ids,
        status: statusToApply,
      });
      if (r.ok) {
        clearSelection();
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  function unsubscribe() {
    if (
      !window.confirm(
        `Unsubscribe ${selected.size} ${selected.size === 1 ? "lead" : "leads"} from all email cadences? They can be re-subscribed individually later.`,
      )
    )
      return;
    setError(null);
    const ids = Array.from(selected);
    startTransition(async () => {
      const r = await bulkUnsubscribeLeads({ leadIds: ids });
      if (r.ok) {
        clearSelection();
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  // ---------------------------------------------------------------------
  // Bulk actions. "Mark contacted" is wired to the real
  // bulkUpdateLeadStatus action (CONTACTED is the only status the button
  // sets — picking other statuses uses the "Set status… / Apply" pair).
  // The remaining stubs (Tag / Export CSV / Assign to me) toast success
  // and clear selection until their server actions ship.
  // ---------------------------------------------------------------------
  function markContacted() {
    if (selected.size === 0) return;
    setError(null);
    const ids = Array.from(selected);
    const n = ids.length;
    startTransition(async () => {
      const r = await bulkUpdateLeadStatus({
        leadIds: ids,
        status: LeadStatus.CONTACTED,
      });
      if (r.ok) {
        toast.success(
          `Marked ${r.count} ${r.count === 1 ? "lead" : "leads"} as contacted`,
        );
        clearSelection();
        router.refresh();
      } else {
        setError(r.error);
        toast.error(`Couldn't mark ${n} ${n === 1 ? "lead" : "leads"}: ${r.error}`);
      }
    });
  }
  // Tag is intentionally still a stub: the Lead model has no `tags` column
  // today (see prisma/schema.prisma model Lead), and the task explicitly
  // asks us to skip the migration. Surface that honestly in the toast so
  // operators know it's coming, not a silent no-op.
  function stubTag() {
    toast.message("Tagging is coming soon", {
      description: "Track this on the roadmap at /portal/insights.",
    });
    clearSelection();
  }
  // Real CSV export — pure client side, no server round-trip needed.
  // Columns chosen to match what's actually useful for downstream CRMs:
  // id, name, email, phone, status, source, score, createdAt.
  function exportCsv() {
    const ids = selected;
    const rows =
      ids.size > 0 ? items.filter((i) => ids.has(i.id)) : items;
    if (rows.length === 0) {
      toast.error("No leads to export");
      return;
    }
    const csv = buildLeadsCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(
      `Exported ${rows.length} ${rows.length === 1 ? "lead" : "leads"} as CSV`,
    );
  }
  function assignToMe() {
    if (selected.size === 0) return;
    setError(null);
    const ids = Array.from(selected);
    const n = ids.length;
    startTransition(async () => {
      const r = await bulkAssignLeads({ leadIds: ids });
      if (r.ok) {
        toast.success(
          `Assigned ${r.count} ${r.count === 1 ? "lead" : "leads"} to you`,
        );
        clearSelection();
        router.refresh();
      } else {
        setError(r.error);
        toast.error(`Couldn't assign ${n} ${n === 1 ? "lead" : "leads"}: ${r.error}`);
      }
    });
  }

  function deleteAll() {
    if (
      !window.confirm(
        `Permanently delete ${selected.size} ${selected.size === 1 ? "lead" : "leads"}? This cannot be undone — tours, applications, and conversations will be cascade-deleted.`,
      )
    )
      return;
    setError(null);
    const ids = Array.from(selected);
    startTransition(async () => {
      const r = await bulkDeleteLeads({ leadIds: ids });
      if (r.ok) {
        clearSelection();
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
        <p className="text-sm font-medium text-foreground">No leads yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Leads appear here when visitors submit forms, chat, or get captured by the pixel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bulk action toolbar — uses the canonical BulkActionBar primitive so
          this matches the visitors and renewals pages. Renders nothing when
          no leads are selected. Stub actions ("Mark contacted", "Tag",
          "Export CSV", "Assign to me") sit alongside the real status /
          unsubscribe / delete actions; stubs toast success messages until
          the corresponding server actions ship. */}
      <BulkActionBar
        count={selected.size}
        onClear={clearSelection}
        noun="lead"
      >
        <button
          type="button"
          onClick={markContacted}
          disabled={pending}
          className="inline-flex items-center rounded-md bg-primary text-primary-foreground hover:bg-primary-dark px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" aria-hidden="true" />
          ) : null}
          Mark contacted
        </button>
        <button
          type="button"
          onClick={stubTag}
          disabled={pending}
          className="inline-flex items-center rounded-md border border-border bg-background hover:bg-muted px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
        >
          Tag
        </button>
        <button
          type="button"
          onClick={assignToMe}
          disabled={pending}
          className="inline-flex items-center rounded-md border border-border bg-background hover:bg-muted px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
        >
          Assign to me
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={pending}
          className="inline-flex items-center rounded-md border border-border bg-background hover:bg-muted px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
        >
          Export CSV
        </button>
        <span className="h-4 w-px bg-border" aria-hidden="true" />
        <select
          value={statusToApply}
          onChange={(e) => setStatusToApply(e.target.value as LeadStatus | "")}
          disabled={pending}
          aria-label="Set status for selected leads"
          className="rounded-md border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
        >
          <option value="">Set status…</option>
          {Object.values(LeadStatus).map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={applyStatus}
          disabled={pending || !statusToApply}
          className="inline-flex items-center gap-1 rounded-md bg-foreground text-background px-2.5 py-1 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
          Apply
        </button>
        <button
          type="button"
          onClick={unsubscribe}
          disabled={pending}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 px-1.5 py-1"
        >
          Unsubscribe
        </button>
        <button
          type="button"
          onClick={deleteAll}
          disabled={pending}
          className="text-xs text-destructive hover:opacity-80 disabled:opacity-50 px-1.5 py-1"
        >
          Delete
        </button>
        {error ? (
          <span className="basis-full rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
            {error}
          </span>
        ) : null}
      </BulkActionBar>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="w-10 px-3 py-3">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={allChecked ? "Deselect all" : "Select all"}
                >
                  {allChecked || someChecked ? (
                    <CheckSquare className={cn("h-4 w-4", someChecked && "opacity-60")} />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                Property
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                Source
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                Score
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                <span className="inline-flex items-center justify-end gap-2">
                  Added
                  <span className="inline-flex items-center gap-1 font-normal normal-case tracking-normal text-[10px] text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" title="0-6 days" />
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" title="7-14 days" />
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-600" title="15+ days" />
                  </span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => {
              const name =
                [item.firstName, item.lastName].filter(Boolean).join(" ") ||
                item.email ||
                "Anonymous";
              const meta = STATUS_META[item.status];
              const isSelected = selected.has(item.id);
              return (
                <tr
                  key={item.id}
                  onClick={(e) => {
                    // Ignore clicks that originated inside an interactive
                    // element so the checkbox / explicit "open full page"
                    // link aren't double-fired by the row handler.
                    const target = e.target as HTMLElement;
                    if (target.closest("a, button, input, select, label")) return;
                    setOpenId(item.id);
                  }}
                  className={cn(
                    "transition-colors cursor-pointer",
                    isSelected ? "bg-primary/5" : "hover:bg-muted/30",
                  )}
                >
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => toggleOne(item.id)}
                      aria-label={isSelected ? "Deselect lead" : "Select lead"}
                      className={cn(
                        "transition-colors",
                        isSelected
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {/* Name uses a real <Link> so SSR / no-JS / right-click
                        "open in new tab" still navigate to the canonical
                        detail page. The row's onClick opens the drawer; the
                        Link's default click is allowed to navigate, so the
                        operator can either click the name text (full page)
                        or any other cell (drawer). */}
                    <Link
                      href={`/portal/leads/${item.id}`}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {name}
                    </Link>
                    {item.email && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                        {item.email}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm text-foreground">
                      {item.propertyName ?? <span className="text-muted-foreground">—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {humanLeadSource(item.source)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        meta.className
                      )}
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    {item.score > 0 ? (
                      <span
                        className={cn(
                          "text-xs font-medium tabular-nums",
                          item.score >= 70
                            ? "text-primary"
                            : item.score >= 40
                            ? "text-primary/70"
                            : "text-muted-foreground"
                        )}
                      >
                        {item.score}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      {!TERMINAL_STATUSES.has(item.status) && (
                        <span
                          className={cn(
                            "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                            AGE_DOT_CLASS[ageTier(item.createdAt)],
                          )}
                        />
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {relativeTime(item.createdAt)}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Row-click drawer — informative summary; "Open full page" link in
          the header navigates to the canonical detail page for everything
          beyond the surface-level overview (notes, conversations, tours,
          applications). */}
      <SideDrawer
        open={openLead != null}
        onOpenChange={(o) => setOpenId(o ? openId : null)}
        title={openLead ? leadDisplayName(openLead) : ""}
        description={openLead?.email ?? openLead?.phone ?? undefined}
        headerActions={
          openLead ? (
            <Link
              href={`/portal/leads/${openLead.id}`}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background hover:bg-muted px-2 py-1 text-[11px] font-medium text-foreground transition-colors"
            >
              Open full page
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          ) : null
        }
        footer={
          openLead ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const lead = openLead;
                  if (!lead) return;
                  startTransition(async () => {
                    const r = await bulkUpdateLeadStatus({
                      leadIds: [lead.id],
                      status: LeadStatus.CONTACTED,
                    });
                    if (r.ok) {
                      toast.success(
                        `Marked ${leadDisplayName(lead)} as contacted`,
                      );
                      setOpenId(null);
                      router.refresh();
                    } else {
                      toast.error(r.error);
                    }
                  });
                }}
                className="inline-flex items-center rounded-md border border-border bg-background hover:bg-muted px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" aria-hidden="true" />
                ) : null}
                Mark contacted
              </button>
              <Link
                href={`/portal/leads/${openLead.id}`}
                className="inline-flex items-center rounded-md bg-primary text-primary-foreground hover:bg-primary-dark px-3 py-1.5 text-xs font-medium transition-colors"
              >
                Open full page
              </Link>
            </>
          ) : null
        }
      >
        {openLead ? <LeadDrawerBody item={openLead} /> : null}
      </SideDrawer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV builder — RFC 4180-ish: comma separator, double-quote escaping,
// CRLF line endings. Matches the visitor table's serializer so Excel +
// Google Sheets handle it correctly.
// ---------------------------------------------------------------------------
function buildLeadsCsv(rows: LeadKanbanItem[]): string {
  const headers = [
    "ID",
    "First name",
    "Last name",
    "Email",
    "Phone",
    "Status",
    "Source",
    "Score",
    "Property",
    "Created at",
  ];
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.firstName ?? "",
        r.lastName ?? "",
        r.email ?? "",
        r.phone ?? "",
        r.status,
        r.source,
        String(r.score ?? 0),
        r.propertyName ?? "",
        r.createdAt,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

function csvEscape(value: string): string {
  if (
    value.includes('"') ||
    value.includes(",") ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function leadDisplayName(item: LeadKanbanItem): string {
  return (
    [item.firstName, item.lastName].filter(Boolean).join(" ") ||
    item.email ||
    "Anonymous lead"
  );
}

// ---------------------------------------------------------------------------
// LeadDrawerBody — surface-level summary shown inside the SideDrawer when an
// operator clicks a row. Intentionally minimal; the full /portal/leads/[id]
// page remains the canonical "everything about this lead" view.
// ---------------------------------------------------------------------------
function LeadDrawerBody({ item }: { item: LeadKanbanItem }) {
  const meta = STATUS_META[item.status];
  return (
    <div className="space-y-4 text-sm">
      <section className="space-y-2">
        <h3 className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          Status
        </h3>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
            meta.className,
          )}
        >
          {meta.label}
        </span>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          Contact
        </h3>
        <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="col-span-2 text-foreground break-all">
            {item.email ?? <span className="text-muted-foreground">—</span>}
          </dd>
          <dt className="text-muted-foreground">Phone</dt>
          <dd className="col-span-2 text-foreground">
            {item.phone ?? <span className="text-muted-foreground">—</span>}
          </dd>
        </dl>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          Source &amp; property
        </h3>
        <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">Source</dt>
          <dd className="col-span-2 text-foreground">
            {humanLeadSource(item.source)}
          </dd>
          <dt className="text-muted-foreground">Property</dt>
          <dd className="col-span-2 text-foreground">
            {item.propertyName ?? (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
          <dt className="text-muted-foreground">Score</dt>
          <dd className="col-span-2 text-foreground tabular-nums">
            {item.score > 0 ? item.score : <span className="text-muted-foreground">—</span>}
          </dd>
        </dl>
      </section>

      <section className="space-y-1.5">
        <h3 className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
          Activity
        </h3>
        <p className="text-xs text-muted-foreground">
          Created {relativeTime(item.createdAt)}.
        </p>
        <p className="text-[11px] text-muted-foreground">
          Notes, conversation history, tours, and applications live on the
          full lead page.
        </p>
      </section>
    </div>
  );
}
