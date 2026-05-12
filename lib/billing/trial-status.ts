import "server-only";

// ---------------------------------------------------------------------------
// Trial status helpers.
//
// A workspace is in one of these effective states from the trial's
// point of view (computed, not stored — Organization holds the inputs):
//
//   trial_active     subscriptionStatus === TRIALING, trialEndsAt in future
//   trial_expired    subscriptionStatus === TRIALING, trialEndsAt in past
//                    (workspace flips to read-only; customer must activate)
//   paid             subscriptionStatus === ACTIVE / PAST_DUE
//                    (full access — past_due is its own grace window)
//   none             pre-trial or post-cancel state; full access for
//                    legacy orgs that predate the trial-first model,
//                    no access for fresh signups that bailed at the wizard
//
// `isWorkspaceReadOnly` is the single function every mutating action
// should consult before writing data. Putting it here centralizes the
// "what does our read-only mean" logic so future tweaks (grace days,
// admin overrides, dispute holds) all live in one place.
// ---------------------------------------------------------------------------

import type {
  SubscriptionStatus,
  Organization,
} from "@prisma/client";

export type TrialState =
  | "trial_active"
  | "trial_expired"
  | "paid"
  | "none";

export type TrialStatusInput = Pick<
  Organization,
  "subscriptionStatus" | "trialStartedAt" | "trialEndsAt"
>;

export function resolveTrialState(org: TrialStatusInput): TrialState {
  const now = new Date();
  const status: SubscriptionStatus | null = org.subscriptionStatus;
  const ends = org.trialEndsAt;

  if (status === "ACTIVE" || status === "PAST_DUE") return "paid";
  if (status === "TRIALING") {
    if (!ends) return "trial_active"; // defensive — null end = treat as active
    return ends.getTime() > now.getTime() ? "trial_active" : "trial_expired";
  }
  return "none";
}

// Days remaining (rounded UP) in the trial. Negative for expired,
// null for non-trial states. Use for banner copy, not gating.
export function daysLeftInTrial(org: TrialStatusInput): number | null {
  if (org.subscriptionStatus !== "TRIALING" || !org.trialEndsAt) return null;
  const ms = org.trialEndsAt.getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

// THE GATE every write-side action should consult before mutating.
//
// `requiresPaid` actions (e.g. send a high-volume email, run an ad
// campaign, sync audiences to Meta) are blocked the moment a trial
// expires without activation. Most read paths stay open so the
// customer can still review their data, export it, and decide to
// activate.
//
// Agency users impersonating a client BYPASS the gate so support
// workflows aren't broken by an expired trial — they need to be
// able to fix things on the customer's behalf.
export function isWorkspaceReadOnly(
  org: TrialStatusInput,
  opts: { isImpersonating?: boolean } = {},
): boolean {
  if (opts.isImpersonating) return false;
  return resolveTrialState(org) === "trial_expired";
}

// Soft-deadline gating: "we're going to lock this down in N days".
// Useful for banners that read "your trial ends in 3 days, activate
// now to keep these features" with a slightly stronger tone than
// the standard countdown.
export function trialEndsWithinDays(
  org: TrialStatusInput,
  days: number,
): boolean {
  const left = daysLeftInTrial(org);
  if (left === null) return false;
  return left > 0 && left <= days;
}
