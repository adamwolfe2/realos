"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LeadStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

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

const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  TOUR_SCHEDULED: "Tour scheduled",
  TOURED: "Toured",
  APPLICATION_SENT: "Application sent",
  APPLIED: "Applied",
  APPROVED: "Approved",
  SIGNED: "Signed",
  LOST: "Lost",
  UNQUALIFIED: "Unqualified",
};

export function LeadStatusForm({
  leadId,
  initialStatus,
}: {
  leadId: string;
  initialStatus: LeadStatus;
  score?: number;
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
    <div className="space-y-2">
      <select
        aria-label="Lead status"
        value={status}
        disabled={pending}
        onChange={(e) => change(e.target.value as LeadStatus)}
        className={cn(
          "w-full rounded-[10px] bg-card px-3 py-2 text-sm",
          "text-foreground",
          "ring-1 ring-border",
          "focus:outline-none focus:ring-primary",
          "transition-colors duration-200",
          pending && "opacity-60"
        )}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {error ? (
        <p className="text-xs text-[var(--error)]">{error}</p>
      ) : null}
    </div>
  );
}
