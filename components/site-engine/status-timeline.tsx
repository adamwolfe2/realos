import * as React from "react";
import { Check } from "lucide-react";
import type { SiteRequestStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Status timeline used by both the public status page and the portal
// status page. Renders the client-friendly stages (collapses the noisier
// internal states like INSPIRATION_EXTRACTION / SPEC_REVIEW into a single
// "Designing your site" stage) and highlights the current step.
// ---------------------------------------------------------------------------

const STAGES: {
  key: string;
  label: string;
  matches: SiteRequestStatus[];
}[] = [
  { key: "submitted", label: "Submitted", matches: ["SUBMITTED", "TRIAGE"] },
  { key: "info", label: "Awaiting your info", matches: ["NEEDS_INFO"] },
  {
    key: "preparing",
    label: "Preparing the build",
    matches: ["QUALIFIED", "INSPIRATION_EXTRACTION", "SPEC_REVIEW", "READY_TO_BUILD"],
  },
  { key: "building", label: "Building", matches: ["IN_BUILD"] },
  {
    key: "review",
    label: "Preview ready for your review",
    matches: ["PREVIEW_READY", "CLIENT_REVIEW", "REVISION_REQUESTED"],
  },
  {
    key: "live",
    label: "Live",
    matches: ["APPROVED", "DEPLOYED", "MAINTENANCE"],
  },
];

const TERMINAL: SiteRequestStatus[] = ["DISQUALIFIED", "PAUSED", "CHURNED"];

export function statusCopy(status: SiteRequestStatus): {
  label: string;
  description: string;
} {
  switch (status) {
    case "SUBMITTED":
      return {
        label: "Submitted",
        description:
          "We've received your intake and we'll triage it within 1 business day.",
      };
    case "TRIAGE":
      return {
        label: "Under review",
        description:
          "We're reviewing your intake and scoping the build. We'll be back to you shortly.",
      };
    case "NEEDS_INFO":
      return {
        label: "We need a bit more from you",
        description:
          "Check your email — we've asked for a couple of clarifications so we can scope this properly.",
      };
    case "DISQUALIFIED":
      return {
        label: "Not a fit right now",
        description:
          "We won't be able to take this on. You should have a follow-up email with context.",
      };
    case "QUALIFIED":
    case "INSPIRATION_EXTRACTION":
    case "SPEC_REVIEW":
      return {
        label: "Designing your site",
        description:
          "We're extracting the structure and style direction from your inspiration sites and writing a build spec. ETA 2–3 business days.",
      };
    case "READY_TO_BUILD":
      return {
        label: "Build queued",
        description: "Your build is scheduled and kicks off shortly.",
      };
    case "IN_BUILD":
      return {
        label: "Building",
        description:
          "Active build session in progress. Expect a preview link in your inbox within a few days.",
      };
    case "PREVIEW_READY":
    case "CLIENT_REVIEW":
      return {
        label: "Preview ready for your review",
        description:
          "Your preview site is live. Open it from the button above and reply to the email with any feedback.",
      };
    case "REVISION_REQUESTED":
      return {
        label: "Working on revisions",
        description: "We're applying the changes you requested.",
      };
    case "APPROVED":
      return {
        label: "Approved — preparing launch",
        description:
          "You signed off on the preview. We're prepping the production deploy and domain attachment.",
      };
    case "DEPLOYED":
      return {
        label: "Live",
        description: "Your site is in production. Open it from the button above.",
      };
    case "MAINTENANCE":
      return {
        label: "Live · Maintenance",
        description: "Your site is live and under active maintenance.",
      };
    case "PAUSED":
      return {
        label: "Paused",
        description:
          "This request is paused. Reply to your last email to unpause whenever you're ready.",
      };
    case "CHURNED":
      return {
        label: "Closed",
        description: "This request has been closed.",
      };
    default:
      return { label: status, description: "" };
  }
}

export function StatusTimeline({
  currentStatus,
  events,
}: {
  currentStatus: SiteRequestStatus;
  events: Array<{
    id: string;
    kind: string;
    fromStatus: SiteRequestStatus | null;
    toStatus: SiteRequestStatus | null;
    message: string | null;
    createdAt: Date;
  }>;
}) {
  const currentIndex = STAGES.findIndex((s) => s.matches.includes(currentStatus));
  const isTerminal = TERMINAL.includes(currentStatus);

  return (
    <section className="rounded-lg border border-border bg-card p-6 space-y-5">
      <h3 className="text-sm font-semibold">Where we are</h3>
      {isTerminal ? (
        <p className="text-sm text-muted-foreground">
          {statusCopy(currentStatus).description}
        </p>
      ) : (
        <ol className="space-y-3">
          {STAGES.map((stage, idx) => {
            const done = currentIndex > idx;
            const active = currentIndex === idx;
            return (
              <li key={stage.key} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 size-5 rounded-full border-2 flex items-center justify-center text-[10px] font-semibold",
                    done
                      ? "bg-primary border-primary text-primary-foreground"
                      : active
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {done ? <Check className="w-3.5 h-3.5" strokeWidth={1.5} /> : idx + 1}
                </span>
                <div className="min-w-0">
                  <div
                    className={cn(
                      "text-sm font-medium",
                      active ? "text-foreground" : done ? "text-muted-foreground line-through" : "text-muted-foreground",
                    )}
                  >
                    {stage.label}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {events.length > 0 ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Activity log</summary>
          <ul className="mt-2 space-y-2">
            {events.map((e) => (
              <li key={e.id} className="border-l-2 border-border pl-3">
                <div className="font-medium text-foreground">
                  {e.toStatus ? statusCopy(e.toStatus).label : e.kind}
                </div>
                {e.message ? <div className="text-xs">{e.message}</div> : null}
                <div className="text-[11px] tabular-nums">
                  {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(e.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
