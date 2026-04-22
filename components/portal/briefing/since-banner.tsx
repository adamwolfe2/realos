"use client";

import { useTransition } from "react";
import { Gauge, Check } from "lucide-react";
import { markBriefingViewed } from "@/app/portal/insights/actions";

export function SinceBanner({
  lastViewedAt,
  delta,
}: {
  lastViewedAt: Date | null;
  delta: {
    since: Date;
    newLeads: number;
    newInsights: number;
    newTours: number;
    newChats: number;
    newApplications: number;
  };
}) {
  const [pending, startTransition] = useTransition();

  const sinceLabel = lastViewedAt
    ? `Since your last briefing ${relativeTime(lastViewedAt)}`
    : "Since last Monday";

  const items: { label: string; value: number }[] = [
    { label: "new leads", value: delta.newLeads },
    { label: "new insights", value: delta.newInsights },
    { label: "tour requests", value: delta.newTours },
    { label: "captured chats", value: delta.newChats },
    { label: "applications", value: delta.newApplications },
  ].filter((i) => i.value > 0);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          <Gauge className="h-3 w-3" />
          Command Center
        </div>
        <p className="mt-1 text-[15px] tracking-tight text-foreground font-medium">
          {sinceLabel}
          {items.length === 0 ? (
            <span className="ml-1 text-muted-foreground">
              nothing material has changed yet.
            </span>
          ) : (
            <span className="ml-1 text-muted-foreground">
              {items.map((i, idx) => (
                <span key={i.label}>
                  <span className="tabular-nums font-semibold text-foreground">
                    {i.value}
                  </span>{" "}
                  {i.label}
                  {idx < items.length - 1 ? ", " : "."}
                </span>
              ))}
            </span>
          )}
        </p>
      </div>
      <button
        onClick={() => startTransition(() => { void markBriefingViewed(); })}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md bg-foreground text-background px-3 py-1.5 text-[12px] font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <Check className="h-3 w-3" />
        {pending ? "Saving..." : "Mark briefing reviewed"}
      </button>
    </div>
  );
}

function relativeTime(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
