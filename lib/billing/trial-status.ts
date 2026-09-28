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
  | "paused"
  | "canceled"
  | "none";

import {
  TRIAL_CAP_DAYS,
  TRIAL_DAYS,
  addTrialDays,
  computeTrialEndsAt,
} from "@/lib/onboarding/steps";

export type TrialStatusInput = Pick<
  Organization,
  "subscriptionStatus" | "trialStartedAt" | "trialEndsAt"
>;

export function resolveTrialState(org: TrialStatusInput): TrialState {
  const now = new Date();
  const status: SubscriptionStatus | null = org.subscriptionStatus;
  const ends = org.trialEndsAt;

  if (status === "ACTIVE" || status === "PAST_DUE") return "paid";
  // PAUSED is a hard dunning state set by the 14-day-overdue escalation
  // (billing-reminders cron). The portal flips to read-only and the
  // customer is told to update payment; invoice.paid restores it to ACTIVE.
  if (status === "PAUSED") return "paused";
  if (status === "CANCELED") return "canceled";
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
  const state = resolveTrialState(org);
  // Both an unactivated expired trial AND a payment-paused workspace are
  // read-only. PAUSED matches the "your account has been paused" dunning
  // email — without this the email lied (portal stayed fully writable).
  return (
    state === "trial_expired" || state === "paused" || state === "canceled"
  );
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

// Card on file: the trialing org has a live Stripe platform subscription that
// will bill at trial end. The Stripe webhook writes currentPeriodEnd only when
// a platform subscription exists, and cancelAtPeriodEnd means it won't bill.
export type CardOnFileInput = Pick<
  Organization,
  "subscriptionStatus" | "currentPeriodEnd" | "cancelAtPeriodEnd"
>;

export function hasCardOnFile(org: CardOnFileInput): boolean {
  return (
    org.subscriptionStatus === "TRIALING" &&
    org.currentPeriodEnd !== null &&
    !org.cancelAtPeriodEnd
  );
}

// New trial end at go-live, or null when nothing should change.
// min(goLive + 14d, signup + 30d). Any existing end other than the 30-day
// setup placeholder is a floor, so a trial never gets shorter. Once a card is
// on file Stripe's trial_end is the source of truth, so we never move it.
export function computeGoLiveTrialEnd(input: {
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  goLiveAt: Date;
  cardOnFile: boolean;
}): Date | null {
  const { trialStartedAt, trialEndsAt, goLiveAt, cardOnFile } = input;
  if (cardOnFile || !trialStartedAt) return null;
  if (trialEndsAt && trialEndsAt.getTime() <= goLiveAt.getTime()) return null;

  const cap = addTrialDays(trialStartedAt, TRIAL_CAP_DAYS);
  const formula = new Date(
    Math.min(addTrialDays(goLiveAt, TRIAL_DAYS).getTime(), cap.getTime()),
  );
  const isPlaceholder =
    trialEndsAt?.getTime() === computeTrialEndsAt(trialStartedAt).getTime();
  const next =
    trialEndsAt && !isPlaceholder && trialEndsAt > formula
      ? trialEndsAt
      : formula;
  return next.getTime() === trialEndsAt?.getTime() ? null : next;
}

// Soft landing (plans/go-live-trial slice 4): an expired trial with no card
// pauses only the live, outward-facing features (public chatbot + pixel
// identity ingestion). Dashboard and lead history stay readable. A
// card-on-file trial past its end is waiting on Stripe's first invoice and
// keeps running.
export function liveFeaturesPaused(
  org: TrialStatusInput & CardOnFileInput,
): boolean {
  return resolveTrialState(org) === "trial_expired" && !hasCardOnFile(org);
}

// Prisma select for liveFeaturesPaused, so every gate reads the same fields.
export const LIVE_FEATURE_GATE_SELECT = {
  subscriptionStatus: true,
  trialStartedAt: true,
  trialEndsAt: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
} as const;
