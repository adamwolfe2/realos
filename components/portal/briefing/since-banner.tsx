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

  // Bug #110 (was #13 from May): the command-center strip was reading
  // "Since last Monday 1 new leads, 1 captured chats." — plural nouns even
  // when the count is 1. Each item now declares a singular + plural form
  // and we pick the right one based on the count.
  const items: { label: string; value: number }[] = [
    {
      label: plural(delta.newLeads, "new lead", "new leads"),
      value: delta.newLeads,
    },
    {
      label: plural(delta.newInsights, "new insight", "new insights"),
      value: delta.newInsights,
    },
    {
      label: plural(delta.newTours, "tour request", "tour requests"),
      value: delta.newTours,
    },
    {
      label: plural(delta.newChats, "captured chat", "captured chats"),
      value: delta.newChats,
    },
    {
      label: plural(delta.newApplications, "application", "applications"),
      value: delta.newApplications,
    },
  ].filter((i) => i.value > 0);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2px] border border-border bg-card px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
          <Gauge className="h-3 w-3" />
          Command Center
        </div>
        <p className="mt-0.5 text-[13px] tracking-tight text-foreground font-medium leading-snug">
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
      {/* Bug #111 (was #12 from May): solid blue primary button pulled
          attention away from the actual primary action (making the calls
          listed in the Call sheet below). Demoted to a ghost / secondary
          variant and tagged with a tooltip so operators know what it
          does. The Call sheet's first call CTA is now the only solid
          primary on the briefing page. */}
      <button
        onClick={() => startTransition(() => { void markBriefingViewed(); })}
        disabled={pending}
        title="Marks today's briefing as triaged. Counters do not reset — this just clears the briefing from your daily inbox."
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card text-muted-foreground px-3 py-1.5 text-[12px] font-semibold transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
      >
        <Check className="h-3 w-3" />
        {pending ? "Saving..." : "Mark briefing reviewed"}
      </button>
    </div>
  );
}

// Tiny pluralization helper local to this file. We could pull in a real
// library, but the briefing strip needs five words total — a 3-line helper
// is fine and avoids a new dependency.
function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
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
