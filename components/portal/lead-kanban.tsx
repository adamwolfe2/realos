"use client";

import Link from "next/link";
import { LeadStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { humanLeadSource } from "@/lib/format";

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
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  CONTACTED: {
    label: "Contacted",
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
  TOUR_SCHEDULED: {
    label: "Tour scheduled",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  TOURED: {
    label: "Toured",
    className: "bg-teal-50 text-teal-700 border-teal-200",
  },
  APPLICATION_SENT: {
    label: "App sent",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  APPLIED: {
    label: "Applied",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  SIGNED: {
    label: "Signed",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  LOST: {
    label: "Lost",
    className: "bg-red-50 text-red-600 border-red-200",
  },
  UNQUALIFIED: {
    label: "Unqualified",
    className: "bg-gray-50 text-gray-500 border-gray-200",
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
  fresh: "bg-emerald-400",
  aging: "bg-amber-400",
  stale: "bg-rose-500",
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
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
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
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" title="0-6 days" />
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" title="7-14 days" />
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" title="15+ days" />
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
            return (
              <tr
                key={item.id}
                className="hover:bg-muted/30 transition-colors"
              >
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
                          ? "text-emerald-600"
                          : item.score >= 40
                          ? "text-amber-600"
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
  );
}
