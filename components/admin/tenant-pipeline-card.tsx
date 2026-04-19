"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TenantStatus } from "@prisma/client";

const STATUS_ORDER: TenantStatus[] = [
  TenantStatus.INTAKE_RECEIVED,
  TenantStatus.CONSULTATION_BOOKED,
  TenantStatus.PROPOSAL_SENT,
  TenantStatus.CONTRACT_SIGNED,
  TenantStatus.BUILD_IN_PROGRESS,
  TenantStatus.QA,
  TenantStatus.LAUNCHED,
  TenantStatus.ACTIVE,
  TenantStatus.AT_RISK,
  TenantStatus.CHURNED,
  TenantStatus.PAUSED,
];

export type TenantPipelineItem = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  propertyType: string;
  subscriptionTier: string | null;
  mrrCents: number | null;
  modulesActive: number;
  updatedAt: string;
  atRiskReason?: string | null;
};

export function TenantPipelineCard({ item }: { item: TenantPipelineItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(item.status);

  function move(next: TenantStatus) {
    if (next === status) return;
    setError(null);
    setStatus(next);
    startTransition(async () => {
      const res = await fetch(`/api/admin/clients/${item.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to update status");
        setStatus(item.status);
      } else {
        router.refresh();
      }
    });
  }

  const mrr =
    item.mrrCents != null && item.mrrCents > 0
      ? `$${Math.round(item.mrrCents / 100).toLocaleString()}/mo`
      : null;

  return (
    <article className="border rounded-md p-3 bg-background space-y-2">
      <Link
        href={`/admin/clients/${item.id}`}
        className="font-medium text-sm hover:underline underline-offset-2 block truncate"
      >
        {item.name}
      </Link>
      <div className="text-[11px] opacity-60">
        {item.propertyType}
        {mrr ? ` · ${mrr}` : ""}
        {item.subscriptionTier ? ` · ${item.subscriptionTier}` : ""}
      </div>
      <div className="text-[11px] opacity-60">
        {item.modulesActive} modules · updated{" "}
        {new Date(item.updatedAt).toLocaleDateString()}
      </div>
      {item.atRiskReason ? (
        <p className="text-[11px] text-amber-700 border-l-2 border-amber-400 pl-2">
          {item.atRiskReason}
        </p>
      ) : null}
      <div className="flex items-center gap-2 pt-1">
        <label className="text-[10px] opacity-60 uppercase tracking-widest">
          Move
        </label>
        <select
          aria-label="Move to status"
          disabled={pending}
          value={status}
          onChange={(e) => move(e.target.value as TenantStatus)}
          className="text-[11px] border rounded px-1.5 py-1 bg-background"
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {s}
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
