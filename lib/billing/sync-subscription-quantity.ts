import "server-only";
import { prisma } from "@/lib/db";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/config";
import { captureWithContext } from "@/lib/sentry";
import { TIERS } from "@/lib/billing/catalog";
import { isFeatureKey } from "@/lib/billing/features";
import { selectPlatformSubscriptionForOrg } from "@/lib/billing/stripe-state";

// ---------------------------------------------------------------------------
// syncSubscriptionQuantity(orgId)
//
// Called whenever the property count on an org changes (added,
// promoted from IMPORTED to ACTIVE, soft-deleted, etc.). Computes the
// new property count and updates the Stripe subscription item
// quantity for the graduated tier price.
//
// Behavior:
//   * No-op when the org isn't on a TRIALING / ACTIVE / PAST_DUE
//     subscription. A scheduled trial subscription must stay in sync so the
//     first paid invoice uses the current property count.
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
  changedItemCount?: number;
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
    org.subscriptionStatus !== "TRIALING" &&
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
      limit: 100,
      expand: ["data.items.data.price"],
    });
    // Pick the current scheduled or paid subscription; ignore canceled or
    // incomplete subscriptions to avoid bumping a dead sub.
    const sub = selectPlatformSubscriptionForOrg(
      subs.data,
      org.id,
      new Set(["trialing", "active", "past_due"]),
    );
    if (!sub) return { ok: true, skipped: "no_active_subscription" };

    // Legacy subscriptions have one tier item. À-la-carte subscriptions have
    // base + one item per enabled feature, and every one of those prices is
    // per property. FeaturePrice is the authoritative allowlist so fixed
    // add-ons and metered usage items are never resized accidentally.
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
    const featurePrices = await prisma.featurePrice.findMany({
      select: { stripePriceId: true, stripeProductId: true },
    });
    const featurePriceIds = new Set(
      featurePrices
        .map((price) => price.stripePriceId)
        .filter((id): id is string => typeof id === "string"),
    );
    const featureProductIds = new Set(
      featurePrices
        .map((price) => price.stripeProductId)
        .filter((id): id is string => typeof id === "string"),
    );
    const perPropertyItems = sub.items.data.filter((item) => {
      if (item.price?.recurring?.usage_type === "metered") return false;
      const featureKey = item.price?.metadata?.featureKey;
      if (featureKey === "base_platform") return true;
      if (featureKey && isFeatureKey(featureKey)) return true;
      if (item.price?.id && featurePriceIds.has(item.price.id)) return true;
      const productId =
        typeof item.price?.product === "string"
          ? item.price.product
          : item.price?.product?.id;
      if (productId && featureProductIds.has(productId)) return true;
      return item.price?.lookup_key
        ? tierLookupKeys.has(item.price.lookup_key)
        : false;
    });
    if (perPropertyItems.length === 0) {
      return { ok: true, skipped: "no_tier_item_on_subscription" };
    }

    const staleItems = perPropertyItems.filter(
      (item) => (item.quantity ?? 1) !== propertyCount,
    );
    if (staleItems.length === 0) {
      const currentQuantity = perPropertyItems[0]?.quantity ?? 1;
      return {
        ok: true,
        skipped: "quantity_already_matches",
        changedFrom: currentQuantity,
        changedTo: propertyCount,
      };
    }

    await stripe.subscriptions.update(sub.id, {
      items: staleItems.map((item) => ({
        id: item.id,
        quantity: propertyCount,
      })),
      proration_behavior: "create_prorations",
    });

    const currentQuantity = staleItems[0]?.quantity ?? 1;

    await prisma.auditEvent.create({
      data: {
        orgId,
        action: "UPDATE",
        entityType: "Subscription",
        entityId: sub.id,
        description: `Property count changed (${currentQuantity} → ${propertyCount}); ${staleItems.length} subscription item${staleItems.length === 1 ? "" : "s"} synced`,
        diff: {
          subscriptionId: sub.id,
          items: staleItems.map((item) => ({
            itemId: item.id,
            from: item.quantity ?? 1,
            to: propertyCount,
          })),
          to: propertyCount,
        },
      },
    });

    return {
      ok: true,
      changedFrom: currentQuantity,
      changedTo: propertyCount,
      changedItemCount: staleItems.length,
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
