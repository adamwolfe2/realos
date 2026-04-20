"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TenantStatus } from "@prisma/client";
import {
  humanTenantStatus,
  humanPropertyType,
  humanSubscriptionTier,
} from "@/lib/format";

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

  const updated = new Date(item.updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <article className="rounded-lg border border-border bg-card p-3 space-y-1.5 hover:border-foreground/20 transition-colors">
      <Link
        href={`/admin/clients/${item.id}`}
        className="font-medium text-sm text-foreground hover:text-primary transition-colors block truncate"
      >
        {item.name}
      </Link>
      <div className="text-[11px] text-muted-foreground">
        {humanPropertyType(item.propertyType)}
        {item.subscriptionTier
          ? ` · ${humanSubscriptionTier(item.subscriptionTier)}`
          : ""}
        {mrr ? ` · ${mrr}` : ""}
      </div>
      <div className="text-[11px] text-muted-foreground">
        {item.modulesActive} module{item.modulesActive === 1 ? "" : "s"} · {updated}
      </div>
      {item.atRiskReason ? (
        <p className="text-[11px] text-amber-800 bg-amber-50 rounded px-2 py-1 mt-1">
          {item.atRiskReason}
        </p>
      ) : null}
      <div className="flex items-center gap-2 pt-1.5">
        <select
          aria-label="Move to status"
          disabled={pending}
          value={status}
          onChange={(e) => move(e.target.value as TenantStatus)}
          className="w-full text-[11px] border border-border rounded-md px-2 py-1 bg-background text-foreground hover:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {humanTenantStatus(s)}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="text-[11px] text-rose-700">{error}</p>
      ) : null}
    </article>
  );
}
