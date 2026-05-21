"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type SnoozedRec = {
  id: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  snoozedUntil: string;
  snoozedReason: string | null;
};

type Props = {
  recommendations: SnoozedRec[];
};

// Enterprise-blue severity treatment — matches the rec queue + intel
// panel. Severity reads from primary saturation, never hue.
const SEV_TONE: Record<string, string> = {
  CRITICAL: "bg-primary text-primary-foreground",
  HIGH: "bg-primary/15 text-primary",
  MEDIUM: "bg-muted text-foreground",
  LOW: "bg-background text-muted-foreground",
};

function fmtReturn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "due now";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days === 1) return "returns tomorrow";
  if (days < 7) return `returns in ${days}d`;
  if (days < 31) return `returns in ${Math.ceil(days / 7)}w`;
  return `returns in ${Math.ceil(days / 30)}mo`;
}

// ---------------------------------------------------------------------------
// SnoozedRecsPanel — collapsed-by-default surface that shows operators
// what they snoozed and when each one is returning. Prevents snooze from
// being a black hole. Wake-now button per row flips status back to OPEN
// without waiting for the cron auto-revive.
// ---------------------------------------------------------------------------
export function SnoozedRecsPanel({ recommendations }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  if (recommendations.length === 0) return null;

  const soonest = recommendations
    .slice()
    .sort(
      (a, b) =>
        new Date(a.snoozedUntil).getTime() - new Date(b.snoozedUntil).getTime(),
    )[0];

  function wake(id: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/portal/seo/recommendations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "OPEN" }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(body?.error ?? "Could not wake.");
          return;
        }
        toast.success("Recommendation moved back to OPEN.");
        router.refresh();
      } catch {
        toast.error("Network error.");
      }
    });
  }

  return (
    <details
      className="rounded-2xl border border-border bg-card overflow-hidden"
      open={expanded}
      onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors list-none">
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Snoozed
          </p>
          <h3 className="text-sm font-semibold text-foreground mt-0.5">
            {recommendations.length} snoozed rec
            {recommendations.length === 1 ? "" : "s"} · soonest {fmtReturn(soonest.snoozedUntil)}
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {expanded ? "Hide" : "Show"}
        </span>
      </summary>
      <ul className="divide-y divide-border/60 border-t border-border/60">
        {recommendations.map((r) => (
          <li
            key={r.id}
            className="flex items-start gap-3 px-4 py-2.5"
          >
            <span
              className={`mt-0.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide shrink-0 ${SEV_TONE[r.severity]}`}
            >
              {r.severity.toLowerCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-foreground truncate">
                {r.title}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                <span className="font-mono uppercase tracking-wide">
                  {r.category.toLowerCase().replace(/_/g, " ")}
                </span>
                {" · "}
                {fmtReturn(r.snoozedUntil)}
                {r.snoozedReason ? ` · ${r.snoozedReason}` : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => wake(r.id)}
              className="shrink-0 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Wake now
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
