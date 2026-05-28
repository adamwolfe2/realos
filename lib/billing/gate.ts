import "server-only";

import { prisma } from "@/lib/db";
import { SubscriptionStatus } from "@prisma/client";
import { notifyAiQuotaWarning } from "@/lib/notifications/create";

// ---------------------------------------------------------------------------
// AI billing gate — blocks Anthropic spend for delinquent tenants.
//
// Background: Stripe `past_due` (rendered as SubscriptionStatus.PAST_DUE in
// our schema) is a grace window — the customer's card failed, dunning is
// running. Most of the platform stays open during this grace so the
// customer can still log in, see their data, and fix their payment method.
//
// BUT: AI endpoints fan out to Anthropic on a per-call basis. Every Claude
// call costs real money. A tenant whose card has been declining for a week
// and is racking up Anthropic charges with no working subscription is a
// loss the platform absorbs. Delinquent customers must be capped from
// spending more model budget until they fix billing.
//
// PRODUCT DECISION: the gate trips on PAST_DUE. CANCELED / TRIALING /
// no-status orgs are handled by other gates (TrialExpiredError,
// require* helpers). ACTIVE is allowed.
//
// Agency users impersonating a client BYPASS the gate so support can still
// debug AI features on the customer's behalf during a dunning hold.
//
// Returns:
//   { allowed: true }                          — proceed
//   { allowed: false, reason, retryUrl }       — 402 Payment Required
//   { allowed: true, reason: "unknown_org" }   — fail-open on missing org
//                                                (defensive: don't block
//                                                feature for a brand-new
//                                                workspace with no Stripe
//                                                state yet)
// ---------------------------------------------------------------------------

export type BillingGateResult =
  | { allowed: true; reason?: "unknown_org" | "impersonating" | "ok" }
  | {
      allowed: false;
      reason: "past_due" | "canceled" | "paused";
      retryUrl: string;
      subscriptionStatus: SubscriptionStatus;
    };

export type BillingGateOptions = {
  /** Agency users impersonating a client should bypass the gate. */
  isImpersonating?: boolean;
};

const BILLING_PORTAL_URL = "/portal/billing";

/**
 * Returns the current billing gate decision for an org. Pure read —
 * never mutates. Caller is responsible for translating a `false`
 * result into a 402 response.
 *
 * Fail-mode policy: a Prisma error (DB blip, missing org row) returns
 * `allowed: true` with reason="unknown_org" so a transient infra hiccup
 * doesn't take every AI endpoint offline. The trade-off — a deleted org
 * could theoretically slip a few AI calls through — is acceptable
 * because (a) deleted orgs can't get a Clerk session in the first place,
 * and (b) any sustained DB outage is already a P0 unrelated to billing.
 */
export async function checkAiBillingGate(
  orgId: string,
  options: BillingGateOptions = {},
): Promise<BillingGateResult> {
  if (options.isImpersonating) {
    return { allowed: true, reason: "impersonating" };
  }

  let status: SubscriptionStatus | null = null;
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { subscriptionStatus: true },
    });
    if (!org) return { allowed: true, reason: "unknown_org" };
    status = org.subscriptionStatus;
  } catch {
    // DB error — fail open so the AI feature isn't broken by infra.
    return { allowed: true, reason: "unknown_org" };
  }

  // Null status = pre-trial / no Stripe record yet. Allowed — the
  // trial gate (requireWritableWorkspace) covers that path.
  if (status === null) return { allowed: true, reason: "ok" };

  switch (status) {
    case SubscriptionStatus.PAST_DUE:
      return {
        allowed: false,
        reason: "past_due",
        retryUrl: BILLING_PORTAL_URL,
        subscriptionStatus: status,
      };
    case SubscriptionStatus.CANCELED:
      return {
        allowed: false,
        reason: "canceled",
        retryUrl: BILLING_PORTAL_URL,
        subscriptionStatus: status,
      };
    case SubscriptionStatus.PAUSED:
      return {
        allowed: false,
        reason: "paused",
        retryUrl: BILLING_PORTAL_URL,
        subscriptionStatus: status,
      };
    // ACTIVE / TRIALING fall through to allowed. Trial expiry is
    // handled by requireWritableWorkspace; this gate is purely about
    // capping Anthropic spend on delinquent paid accounts.
    default:
      return { allowed: true, reason: "ok" };
  }
}

// ---------------------------------------------------------------------------
// AI quota inbox-warning helper.
//
// The per-org daily AI quota (lib/ai/quota.ts → checkAiQuota) hard-blocks
// at 100%. That's the safety net but it lands with zero warning. The
// per-user/hour rate limiter (lib/rate-limit.ts → aiCallLimiter) is a
// separate, much smaller fast-path budget — those 429s are normal,
// expected, and self-clear in <1h, so we don't notify on them.
//
// reportAiQuotaCrossing() is invoked from checkAiQuota the first time an
// org crosses 80% of its DAILY budget on a given day. We emit a single
// `ai_quota_warning` notification (deduped to one per hour per org via
// notifyAiQuotaWarning's lookup) so the operator sees it in the bell
// before they get blocked.
//
// Fire-and-forget: notification failures must never break an AI call.
// ---------------------------------------------------------------------------

export const AI_QUOTA_WARN_THRESHOLD = 0.8;

export function reportAiQuotaCrossing(input: {
  orgId: string;
  used: number;
  limit: number;
  resetAt: Date;
}): void {
  notifyAiQuotaWarning(input).catch((err) => {
    console.error("[billing/gate] notifyAiQuotaWarning failed:", err);
  });
}

/**
 * Build the standard 402 response body. Use this from every AI route so
 * the client sees a consistent shape and can route the operator to
 * /portal/billing without parsing free-form error text.
 */
export function aiBillingDeniedResponseBody(result: {
  reason: "past_due" | "canceled" | "paused";
  retryUrl: string;
  subscriptionStatus: SubscriptionStatus;
}): {
  error: string;
  code: "billing_required";
  reason: "past_due" | "canceled" | "paused";
  retryUrl: string;
  subscriptionStatus: SubscriptionStatus;
} {
  const human: Record<"past_due" | "canceled" | "paused", string> = {
    past_due:
      "Your subscription payment is past due. AI features are paused until billing is current.",
    canceled:
      "Your subscription is canceled. Reactivate to restore AI features.",
    paused:
      "Your subscription is paused. Resume from billing to restore AI features.",
  };
  return {
    error: human[result.reason],
    code: "billing_required",
    reason: result.reason,
    retryUrl: result.retryUrl,
    subscriptionStatus: result.subscriptionStatus,
  };
}
