import { SubscriptionStatus } from "@prisma/client";

type StripeSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete_expired"
  | "paused"
  | "incomplete"
  | "unpaid";

type StripeSubscriptionMetadata = Record<string, string | undefined>;

export function isProposalSubscription(
  metadata: StripeSubscriptionMetadata,
): boolean {
  return metadata.kind === "proposal" || Boolean(metadata.proposalId);
}

export function isPlatformSubscriptionForOrg(
  metadata: StripeSubscriptionMetadata,
  orgId: string,
): boolean {
  if (isProposalSubscription(metadata)) return false;
  const metadataOrgId = metadata.org_id;
  if (metadataOrgId && metadataOrgId !== orgId) return false;
  if (
    metadata.intent === "trial_activation" ||
    metadata.intent === "upgrade_or_add" ||
    metadata.intent === "signup"
  ) {
    return true;
  }
  return metadataOrgId === orgId && Boolean(metadata.tier);
}

export function isTrialActivationSubscriptionForOrg(
  metadata: StripeSubscriptionMetadata,
  orgId: string,
): boolean {
  return (
    !isProposalSubscription(metadata) &&
    metadata.intent === "trial_activation" &&
    metadata.org_id === orgId
  );
}

export function selectPlatformSubscriptionForOrg<
  T extends { status: string; metadata: StripeSubscriptionMetadata },
>(
  subscriptions: readonly T[],
  orgId: string,
  allowedStatuses: ReadonlySet<string>,
): T | null {
  return (
    subscriptions.find(
      (subscription) =>
        allowedStatuses.has(subscription.status) &&
        isPlatformSubscriptionForOrg(subscription.metadata, orgId),
    ) ?? null
  );
}

function mappedStatus(
  stripeStatus: StripeSubscriptionStatus,
): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "past_due":
    case "incomplete":
    case "unpaid":
      return SubscriptionStatus.PAST_DUE;
    case "paused":
      return SubscriptionStatus.PAUSED;
    case "canceled":
    case "incomplete_expired":
      return SubscriptionStatus.CANCELED;
  }
}

export function subscriptionStatusUpdate(
  currentStatus: SubscriptionStatus | null,
  stripeStatus: StripeSubscriptionStatus,
): SubscriptionStatus | null {
  const nextStatus = mappedStatus(stripeStatus);

  // A new Stripe subscription does not prove collection. Null-status legacy
  // workspaces may enter an explicit trial, but paid access is established by
  // invoice.paid below, never by customer.subscription.created/updated.
  if (currentStatus === null) {
    return nextStatus === SubscriptionStatus.TRIALING ||
      nextStatus === SubscriptionStatus.CANCELED
      ? nextStatus
      : null;
  }

  // A subscription event describes intent/state in Stripe, not successful
  // collection. An in-app trial only becomes ACTIVE in invoice.paid.
  if (currentStatus === SubscriptionStatus.TRIALING) {
    return nextStatus === SubscriptionStatus.TRIALING ? nextStatus : null;
  }

  // Stripe retries and out-of-order events must not regress an already-paid
  // account to a pre-payment state.
  if (
    currentStatus === SubscriptionStatus.ACTIVE &&
    (stripeStatus === "incomplete" || stripeStatus === "trialing")
  ) {
    return null;
  }

  // PAUSED is LeaseStack's terminal dunning lock until invoice.paid or
  // cancellation. A Stripe retry remains past_due and must not unlock it.
  if (
    currentStatus === SubscriptionStatus.PAUSED &&
    nextStatus === SubscriptionStatus.PAST_DUE
  ) {
    return null;
  }

  return nextStatus;
}

export function invoiceActivatesTrial(invoice: {
  status: string | null;
  billingReason: string | null;
  amountPaid: number;
}): boolean {
  if (invoice.status !== "paid") return false;
  if (invoice.billingReason === "subscription_cycle") return true;
  return (
    invoice.billingReason === "subscription_create" && invoice.amountPaid > 0
  );
}
