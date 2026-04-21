"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LeadStatus } from "@prisma/client";

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

const COLUMNS: Array<{ status: LeadStatus; label: string }> = [
  { status: LeadStatus.NEW, label: "New" },
  { status: LeadStatus.CONTACTED, label: "Contacted" },
  { status: LeadStatus.TOUR_SCHEDULED, label: "Tour scheduled" },
  { status: LeadStatus.TOURED, label: "Toured" },
  { status: LeadStatus.APPLICATION_SENT, label: "App sent" },
  { status: LeadStatus.APPLIED, label: "Applied" },
  { status: LeadStatus.APPROVED, label: "Approved" },
  { status: LeadStatus.SIGNED, label: "Signed" },
  { status: LeadStatus.LOST, label: "Lost" },
  { status: LeadStatus.UNQUALIFIED, label: "Unqualified" },
];

export function LeadKanban({ items }: { items: LeadKanbanItem[] }) {
  const byStatus = new Map<LeadStatus, LeadKanbanItem[]>();
  for (const row of items) {
    const list = byStatus.get(row.status) ?? [];
    list.push(row);
    byStatus.set(row.status, list);
  }

  return (
    <>
      <p className="md:hidden mb-2 text-[11px] opacity-60">
        Swipe columns →
      </p>
      <div
        className="grid gap-3 overflow-x-auto pb-4 snap-x snap-mandatory md:snap-none scroll-smooth -mx-4 px-4 md:mx-0 md:px-0 kanban-grid"
        style={{ gridAutoFlow: "column" }}
      >
        <style>{`
          .kanban-grid { grid-template-columns: repeat(${COLUMNS.length}, 85vw); }
          @media (min-width: 768px) {
            .kanban-grid { grid-template-columns: repeat(${COLUMNS.length}, minmax(220px, 1fr)); }
          }
        `}</style>
        {COLUMNS.map((col) => {
          const list = byStatus.get(col.status) ?? [];
          return (
            <section
              key={col.status}
              className="min-w-0 space-y-3 snap-start"
            >
              <header className="flex items-center justify-between">
                <h3 className="text-[11px] md:text-[10px] tracking-widest uppercase opacity-60">
                  {col.label}
                </h3>
                <span className="text-[11px] md:text-[10px] bg-muted rounded px-1.5 py-0.5">
                  {list.length}
                </span>
              </header>
              <div className="border-t" />
              <div className="space-y-2">
                {list.length === 0 ? (
                  <p className="border border-dashed rounded-md p-3 text-[11px] opacity-40 text-center">
                    Empty
                  </p>
                ) : (
                  list.map((item) => <LeadCard key={item.id} item={item} />)
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function LeadCard({ item }: { item: LeadKanbanItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(item.status);
  const [error, setError] = useState<string | null>(null);

  const name =
    [item.firstName, item.lastName].filter(Boolean).join(" ") ||
    item.email ||
    "Anonymous";

  function move(next: LeadStatus) {
    if (next === status) return;
    const prev = status;
    setStatus(next);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/tenant/leads/${item.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to update status");
        setStatus(prev);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <article className="border rounded-md p-3 bg-background space-y-2">
      <Link
        href={`/portal/leads/${item.id}`}
        className="font-medium text-sm hover:underline underline-offset-2 block truncate"
      >
        {name}
      </Link>
      <div className="text-[11px] opacity-60 truncate">
        {item.email ?? "—"}
        {item.propertyName ? ` · ${item.propertyName}` : ""}
      </div>
      <div className="text-[11px] opacity-60">
        {item.source}
        {item.score ? ` · score ${item.score}` : ""}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <label className="text-[10px] opacity-60 uppercase tracking-widest">
          Move
        </label>
        <select
          aria-label="Change lead status"
          disabled={pending}
          value={status}
          onChange={(e) => move(e.target.value as LeadStatus)}
          className="text-[12px] border rounded px-2 py-1.5 bg-background min-h-[36px] flex-1"
        >
          {COLUMNS.map((c) => (
            <option key={c.status} value={c.status}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : null}
    </article>
  );
}
