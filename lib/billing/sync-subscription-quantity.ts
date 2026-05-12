import "server-only";
import { prisma } from "@/lib/db";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/config";
import { captureWithContext } from "@/lib/sentry";
import { TIERS } from "@/lib/billing/catalog";

// ---------------------------------------------------------------------------
// syncSubscriptionQuantity(orgId)
//
// Called whenever the property count on an org changes (added,
// promoted from IMPORTED to ACTIVE, soft-deleted, etc.). Computes the
// new property count and updates the Stripe subscription item
// quantity for the graduated tier price.
//
// Behavior:
//   * No-op when the org isn't on an ACTIVE / PAST_DUE subscription.
//     During TRIALING the customer hasn't paid yet, so adding
//     properties just changes the future activation price.
//   * No-op when the subscription item already matches the new
//     quantity. Saves API calls in the common case where the count
//     didn't actually change (e.g. someone toggled `isAvailable` on
//     a listing, which is downstream of the property model).
//   * Uses `proration_behavior: "create_prorations"` so customers
//     pay the prorated delta for the rest of the billing cycle.
//
// Errors are caught and logged but never thrown — the caller (e.g. a
// property creation route handler) should not fail the user's action
// because Stripe is momentarily unreachable. The cron + webhook
// reconciliation loops eventually self-heal.
// ---------------------------------------------------------------------------

export async function syncSubscriptionQuantity(
  orgId: string,
): Promise<{
  ok: boolean;
  skipped?: string;
  changedFrom?: number;
  changedTo?: number;
  error?: string;
}> {
  if (!isStripeConfigured()) {
    return { ok: true, skipped: "stripe_not_configured" };
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      stripeCustomerId: true,
      subscriptionStatus: true,
      subscriptionTier: true,
    },
  });
  if (!org) return { ok: false, error: "Org not found" };
  if (!org.stripeCustomerId) {
    return { ok: true, skipped: "no_stripe_customer" };
  }
  if (
    org.subscriptionStatus !== "ACTIVE" &&
    org.subscriptionStatus !== "PAST_DUE"
  ) {
    return { ok: true, skipped: "not_paid_subscription" };
  }

  const propertyCount = await prisma.property.count({
    where: {
      orgId,
      lifecycle: { in: ["IMPORTED", "ACTIVE"] },
    },
  });
  if (propertyCount <= 0) {
    return { ok: true, skipped: "no_properties" };
  }

  const stripe = getStripeClient();
  try {
    const subs = await stripe.subscriptions.list({
      customer: org.stripeCustomerId,
      status: "all",
      limit: 5,
      expand: ["data.items.data.price"],
    });
    // Pick the most-recent ACTIVE / PAST_DUE subscription; ignore
    // canceled or incomplete to avoid bumping a dead sub.
    const sub = subs.data.find((s) =>
      ["active", "past_due"].includes(s.status),
    );
    if (!sub) return { ok: true, skipped: "no_active_subscription" };

    // Find the subscription item whose price corresponds to one of
    // our graduated-tier lookup keys. There should be exactly one
    // per subscription (we only ever create a single tiered item).
    const tierLookupKeys = new Set(
      TIERS.flatMap((t) => [
        t.graduatedMonthly.lookupKey,
        t.graduatedAnnual.lookupKey,
        // Old flat lookup keys covered for backwards compatibility
        // with any customer who subscribed BEFORE the catalog refactor.
        t.monthly.lookupKey,
        t.annual.lookupKey,
      ]),
    );
    const tierItem = sub.items.data.find((i) =>
      i.price?.lookup_key
        ? tierLookupKeys.has(i.price.lookup_key)
        : false,
    );
    if (!tierItem) {
      return { ok: true, skipped: "no_tier_item_on_subscription" };
    }

    const currentQuantity = tierItem.quantity ?? 1;
    if (currentQuantity === propertyCount) {
      return {
        ok: true,
        skipped: "quantity_already_matches",
        changedFrom: currentQuantity,
        changedTo: propertyCount,
      };
    }

    await stripe.subscriptions.update(sub.id, {
      items: [{ id: tierItem.id, quantity: propertyCount }],
      proration_behavior: "create_prorations",
    });

    await prisma.auditEvent.create({
      data: {
        orgId,
        action: "UPDATE",
        entityType: "Subscription",
        entityId: sub.id,
        description: `Property count changed (${currentQuantity} → ${propertyCount}); subscription quantity synced`,
        diff: {
          subscriptionId: sub.id,
          itemId: tierItem.id,
          from: currentQuantity,
          to: propertyCount,
        },
      },
    });

    return {
      ok: true,
      changedFrom: currentQuantity,
      changedTo: propertyCount,
    };
  } catch (err) {
    captureWithContext(err, {
      route: "lib/billing/sync-subscription-quantity",
      orgId,
    });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Stripe update failed",
    };
  }
}
