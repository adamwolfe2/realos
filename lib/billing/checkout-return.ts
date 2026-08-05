import type { SubscriptionStatus } from "@prisma/client";

export type CheckoutReturnState =
  | "invalid"
  | "scheduled"
  | "processing"
  | "active";

export function resolveCheckoutReturn(input: {
  expectedOrgId: string;
  expectedCustomerId: string | null;
  sessionOrgId: string | null;
  sessionCustomerId: string | null;
  sessionMode: string | null;
  sessionStatus: string | null;
  paymentStatus: string | null;
  stripeSubscriptionStatus: string | null;
  subscriptionStatus: SubscriptionStatus | null;
}): CheckoutReturnState {
  const ownedByOrg = input.sessionOrgId === input.expectedOrgId;
  const ownedByCustomer =
    input.expectedCustomerId !== null &&
    input.sessionCustomerId === input.expectedCustomerId;
  if (!ownedByOrg || !ownedByCustomer) return "invalid";
  if (input.sessionMode !== "subscription") return "invalid";
  if (input.sessionStatus !== "complete") return "invalid";

  // Stripe can report a zero-due trial Checkout as `paid` even though no
  // customer charge occurred. The subscription is the authoritative signal:
  // while it is trialing, the only truthful return state is scheduled.
  if (input.stripeSubscriptionStatus === "trialing") {
    return input.paymentStatus === "paid" ||
      input.paymentStatus === "no_payment_required"
      ? "scheduled"
      : "invalid";
  }

  if (input.subscriptionStatus === "ACTIVE") {
    return input.paymentStatus === "paid" ||
      input.paymentStatus === "no_payment_required"
      ? "active"
      : "invalid";
  }
  if (
    input.subscriptionStatus === "TRIALING" &&
    input.paymentStatus === "no_payment_required"
  ) {
    return "scheduled";
  }
  if (input.paymentStatus === "paid") return "processing";
  return "invalid";
}

export function resolveScheduledTrialEnd(
  stripeTrialEnd: number | null,
  orgTrialEndsAt: Date | null,
): Date | null {
  return stripeTrialEnd === null
    ? orgTrialEndsAt
    : new Date(stripeTrialEnd * 1000);
}
