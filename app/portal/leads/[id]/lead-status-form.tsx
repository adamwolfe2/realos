"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LeadStatus } from "@prisma/client";

const STATUSES: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.TOUR_SCHEDULED,
  LeadStatus.TOURED,
  LeadStatus.APPLICATION_SENT,
  LeadStatus.APPLIED,
  LeadStatus.APPROVED,
  LeadStatus.SIGNED,
  LeadStatus.LOST,
  LeadStatus.UNQUALIFIED,
];

export function LeadStatusForm({
  leadId,
  initialStatus,
  score,
}: {
  leadId: string;
  initialStatus: LeadStatus;
  score: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);

  function change(next: LeadStatus) {
    if (next === status) return;
    const prev = status;
    setStatus(next);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/tenant/leads/${leadId}/status`, {
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
    <div className="flex flex-col items-end gap-2 min-w-[12rem]">
      <div className="flex items-center gap-2">
        <label className="text-[10px] uppercase tracking-widest opacity-60">
          Status
        </label>
        <select
          value={status}
          disabled={pending}
          onChange={(e) => change(e.target.value as LeadStatus)}
          className="border rounded px-2 py-1.5 text-xs bg-background"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <span className="text-[11px] opacity-60">Lead score: {score}</span>
      {error ? (
        <span className="text-[11px] text-destructive">{error}</span>
      ) : null}
    </div>
  );
}
