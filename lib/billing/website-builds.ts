// ---------------------------------------------------------------------------
// Website-build visibility rules.
//
// /portal/billing renders WebsiteBuildRequest rows as a live fulfillment
// queue ("where your build is in our queue"). Two row classes must never
// reach that queue:
//
//   - `abandoned` — the Stripe checkout session EXPIRED without payment
//     (set by handleCheckoutExpired in app/api/webhooks/stripe/route.ts).
//     These are dead sessions, not builds. SG Real Estate carried two of
//     them from 2026-07-30, and the billing page rendered both as
//     "Custom website build · $0 paid on 7/30/2026" sitting at stage 1 —
//     telling a customer whose site has been live since April that we
//     had two builds waiting on them.
//
//   - terminal rows past their retention window — a build that went live
//     or was cancelled over 30 days ago is history, not queue state. The
//     billing page has claimed this behaviour in a comment since the
//     tracker shipped, but nothing implemented it.
//
// Pure + date-injectable so the retention boundary is testable.
// ---------------------------------------------------------------------------

/** Statuses the fulfillment stepper knows how to render. */
export const BUILD_STAGES = [
  "requested",
  "scoping",
  "designing",
  "building",
  "review",
  "live",
] as const;

export type BuildStage = (typeof BUILD_STAGES)[number];
export type BuildStatus = BuildStage | "cancelled";

/** A checkout that expired unpaid. Never a build. */
const NEVER_SHOWN = new Set(["abandoned", "failed"]);

/** Reached an end state — shown only inside the retention window. */
const TERMINAL = new Set(["live", "cancelled"]);

export const TERMINAL_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type WebsiteBuildRow = {
  status: string;
  createdAt: Date;
  launchedAt?: Date | null;
  cancelledAt?: Date | null;
};

/**
 * True when this row belongs in the customer-facing fulfillment queue.
 *
 * Unknown statuses are hidden rather than rendered: the stepper maps an
 * unrecognised status to "no stage reached", which paints a full six-step
 * progress bar with nothing highlighted — indistinguishable from a real
 * build stalled at intake.
 */
export function isVisibleWebsiteBuild(
  row: WebsiteBuildRow,
  now: Date = new Date(),
): boolean {
  const status = row.status;
  if (NEVER_SHOWN.has(status)) return false;

  if (TERMINAL.has(status)) {
    const terminalAt = row.launchedAt ?? row.cancelledAt ?? row.createdAt;
    const age = now.getTime() - terminalAt.getTime();
    return age <= TERMINAL_RETENTION_DAYS * DAY_MS;
  }

  return (BUILD_STAGES as readonly string[]).includes(status);
}

export function visibleWebsiteBuilds<T extends WebsiteBuildRow>(
  rows: readonly T[],
  now: Date = new Date(),
): T[] {
  return rows.filter((row) => isVisibleWebsiteBuild(row, now));
}

/** Narrow a persisted status string to what the stepper can render. */
export function toBuildStatus(status: string): BuildStatus {
  return status === "cancelled" ||
    (BUILD_STAGES as readonly string[]).includes(status)
    ? (status as BuildStatus)
    : "requested";
}
