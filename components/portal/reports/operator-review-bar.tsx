"use client";

import * as React from "react";
import {
  computeDefaultOpen,
  computeSummaryText,
  type ReportStatus,
} from "@/lib/reports/operator-bar-state";

// ---------------------------------------------------------------------------
// OperatorReviewBar
//
// Collapsible wrapper for the headline / personal-note / send-to-client
// panels on the report editor page. The operator's job is two clicks:
// (1) review the numbers, (2) personalize + send. Previously the editor
// and send panels stacked ~600px above the report so the operator scrolled
// past their own draft inputs just to skim the deliverable they were about
// to share. This wraps both panels in a sticky bar that opens on demand.
//
// All decision logic (default-open + summary text) lives in
// lib/reports/operator-bar-state.ts — pure and unit-tested.
// ---------------------------------------------------------------------------

type Status = ReportStatus;

export function OperatorReviewBar({
  status,
  hasHeadline,
  hasNotes,
  shareUrl,
  recipient,
  children,
}: {
  status: Status;
  hasHeadline: boolean;
  hasNotes: boolean;
  shareUrl: string | null;
  recipient: string | null;
  children: React.ReactNode;
}) {
  const defaultOpen = computeDefaultOpen(status, hasHeadline, hasNotes);
  const [open, setOpen] = React.useState(defaultOpen);

  const statusPill = (() => {
    switch (status) {
      case "shared":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Shared
            {recipient ? (
              <span className="font-medium normal-case tracking-normal text-primary/80">
                · {recipient}
              </span>
            ) : null}
          </span>
        );
      case "archived":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Archived
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Draft
          </span>
        );
    }
  })();

  const summaryText = computeSummaryText(
    status,
    hasHeadline,
    hasNotes,
    shareUrl,
  );

  return (
    <section
      data-no-print
      className="ls-operator-bar rounded-xl border border-border bg-card overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="operator-review-content"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          {statusPill}
          <span className="text-sm font-semibold text-foreground truncate">
            {summaryText}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status === "shared" && shareUrl ? (
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-semibold text-primary hover:underline underline-offset-2"
            >
              Open public view ↗
            </a>
          ) : null}
          <span className="text-xs font-semibold text-primary">
            {open ? "Hide" : status === "shared" ? "Edit" : "Open"} ▾
          </span>
        </div>
      </button>
      <div
        id="operator-review-content"
        hidden={!open}
        className="border-t border-border bg-muted/10"
      >
        <div className="p-4 space-y-4">{children}</div>
      </div>
    </section>
  );
}
