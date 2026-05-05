"use client";

import * as React from "react";
import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckSquare, Square, X, Loader2 } from "lucide-react";
import { LeadStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { humanLeadSource } from "@/lib/format";
import {
  bulkUpdateLeadStatus,
  bulkUnsubscribeLeads,
  bulkDeleteLeads,
} from "@/lib/actions/lead-bulk";

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
      {/* Bulk action toolbar — sticky pill that floats above the table when
          any rows are selected. Disappears once selection is cleared. */}
      {selected.size > 0 ? (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-card shadow-sm px-3 py-2">
          <span className="text-xs font-semibold text-foreground">
            {selected.size} selected
          </span>
          <span className="h-4 w-px bg-border" />
          <select
            value={statusToApply}
            onChange={(e) => setStatusToApply(e.target.value as LeadStatus | "")}
            disabled={pending}
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
            className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-2.5 py-1 text-xs font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Apply
          </button>
          <span className="h-4 w-px bg-border" />
          <button
            type="button"
            onClick={unsubscribe}
            disabled={pending}
            className="text-xs text-foreground hover:text-primary disabled:opacity-50"
          >
            Unsubscribe
          </button>
          <button
            type="button"
            onClick={deleteAll}
            disabled={pending}
            className="text-xs text-destructive hover:opacity-80 disabled:opacity-50"
          >
            Delete
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={clearSelection}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md text-muted-foreground hover:text-foreground text-xs disabled:opacity-50"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
          {error ? (
            <p className="basis-full rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

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
                  className={cn(
                    "transition-colors",
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
    </div>
  );
}
