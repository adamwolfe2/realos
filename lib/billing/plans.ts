// ---------------------------------------------------------------------------
// LeaseStack billing — runtime resolution layer.
//
// `catalog.ts` declares the products + prices we sell (pricing, copy,
// limits, module entitlements). This file is the runtime BRIDGE between
// that catalog and Stripe's API: given a tier id + billing cycle, return
// the Stripe price ID we send to Checkout / Subscriptions.
//
// All Stripe price IDs come from `price-ids.generated.ts`, which the
// `pnpm tsx scripts/stripe-setup.ts` script writes after creating /
// finding every product + price in Stripe. Decoupling the script-driven
// id-lookup from the static catalog means changing prices doesn't touch
// the application code — just bump catalog.ts amounts, re-run setup,
// commit the new generated file.
// ---------------------------------------------------------------------------

import type { SubscriptionTier } from "@prisma/client";
import {
  ADDONS,
  TIERS,
  type AddOnDefinition,
  type ModuleFlags,
  type TierDefinition,
  findTierByLookupKey,
  getModulesForTier,
  getTierById,
} from "./catalog";
import { STRIPE_PRICE_IDS, type StripeLookupKey } from "./price-ids.generated";

export { ADDONS, TIERS } from "./catalog";
export type { AddOnDefinition, ModuleFlags, TierDefinition } from "./catalog";

// ---------------------------------------------------------------------------
// Price ID lookup
// ---------------------------------------------------------------------------

export function getPriceId(lookupKey: StripeLookupKey | string): string {
  const id = (STRIPE_PRICE_IDS as Record<string, string>)[lookupKey];
  if (!id) {
    throw new Error(
      `No Stripe price registered for lookup_key "${lookupKey}". Did you run \`pnpm tsx scripts/stripe-setup.ts\`?`,
    );
  }
  return id;
}

// Resolve every Stripe price ID we'd need to build a Checkout Session
// for a given tier + cycle + property count + optional add-ons.
export type CheckoutPriceSelection = {
  tier: TierDefinition;
  cycle: "monthly" | "annual";
  propertyCount: number; // total properties (must be >= 1)
  addOnLookupKeys?: string[];
  includeSetupFee: boolean;
};

export type ResolvedLineItems = Array<
  | {
      kind: "subscription_base";
      priceId: string;
      quantity: 1;
      tier: TierDefinition;
      cycle: "monthly" | "annual";
    }
  | {
      kind: "subscription_additional_property";
      priceId: string;
      quantity: number; // propertyCount - 1
    }
  | {
      kind: "subscription_addon";
      priceId: string;
      addon: AddOnDefinition;
    }
  | {
      kind: "subscription_metered_addon";
      priceId: string;
      addon: AddOnDefinition;
    }
  | {
      kind: "one_time";
      priceId: string;
      quantity: number;
      label: string;
    }
>;

export function resolveLineItems(
  selection: CheckoutPriceSelection,
): ResolvedLineItems {
  const items: ResolvedLineItems = [];

  // Base subscription — quantity always 1; additional properties get
  // their own discounted line item below.
  const baseLookupKey =
    selection.cycle === "monthly"
      ? selection.tier.monthly.lookupKey
      : selection.tier.annual.lookupKey;
  items.push({
    kind: "subscription_base",
    priceId: getPriceId(baseLookupKey),
    quantity: 1,
    tier: selection.tier,
    cycle: selection.cycle,
  });

  // Additional properties at 20% off.
  if (selection.propertyCount > 1) {
    const additionalLookupKey =
      selection.cycle === "monthly"
        ? selection.tier.additionalPropertyMonthly.lookupKey
        : selection.tier.additionalPropertyAnnual.lookupKey;
    items.push({
      kind: "subscription_additional_property",
      priceId: getPriceId(additionalLookupKey),
      quantity: selection.propertyCount - 1,
    });
  }

  // Setup fee — multiplied by property count (each property gets its
  // own one-time setup).
  if (selection.includeSetupFee) {
    items.push({
      kind: "one_time",
      priceId: getPriceId(selection.tier.setupFee.lookupKey),
      quantity: selection.propertyCount,
      label: `${selection.tier.productName} setup`,
    });
  }

  // Add-ons. Recurring/metered → subscription items. One-time → invoice
  // line items added separately at Checkout creation time.
  for (const addonKey of selection.addOnLookupKeys ?? []) {
    const addon = ADDONS.find((a) => a.priceLookupKey === addonKey);
    if (!addon) continue;
    const priceId = getPriceId(addon.priceLookupKey);
    if (addon.billingMode === "recurring_monthly") {
      items.push({ kind: "subscription_addon", priceId, addon });
    } else if (addon.billingMode === "metered") {
      items.push({ kind: "subscription_metered_addon", priceId, addon });
    } else {
      items.push({
        kind: "one_time",
        priceId,
        quantity: 1,
        label: addon.uiLabel,
      });
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Reverse mapping (Stripe → app)
// ---------------------------------------------------------------------------

// Given a Stripe price ID (from a webhook payload), figure out which
// tier it belongs to so we can apply the right module entitlements.
export function tierFromStripePriceId(
  priceId: string,
): SubscriptionTier | null {
  // Build a reverse map once per process. STRIPE_PRICE_IDS is small
  // (~24 entries) so this is essentially free.
  const lookupKey = Object.entries(STRIPE_PRICE_IDS).find(
    ([, id]) => id === priceId,
  )?.[0];
  if (!lookupKey) return null;
  return findTierByLookupKey(lookupKey)?.tier ?? null;
}

// Compute module flags from an active subscription. Pass the array of
// price IDs on the subscription's `items.data[]`. Tier wins if any of
// the items match a tier price; otherwise default-off across the board.
export function modulesFromSubscriptionPriceIds(
  priceIds: string[],
): ModuleFlags | null {
  for (const id of priceIds) {
    const tier = tierFromStripePriceId(id);
    if (tier) {
      return getModulesForTier(tier);
    }
  }
  return null;
}

// MRR contribution in cents from a subscription, for cache + dashboard.
// Sums the unit_amount * quantity of every item; metered items don't
// contribute (their MRR depends on usage).
//
// Caller hands us the items array from Stripe.Subscription so we don't
// duplicate the Stripe SDK type here.
export function computeMrrCents(
  items: Array<{
    quantity?: number | null;
    price?: {
      unit_amount?: number | null;
      recurring?: { interval?: string | null; usage_type?: string | null } | null;
    } | null;
  }>,
): number {
  let cents = 0;
  for (const item of items) {
    const unit = item.price?.unit_amount ?? 0;
    const qty = item.quantity ?? 1;
    const interval = item.price?.recurring?.interval;
    const usageType = item.price?.recurring?.usage_type;
    if (usageType === "metered") continue;
    if (interval === "month") {
      cents += unit * qty;
    } else if (interval === "year") {
      cents += Math.round((unit * qty) / 12);
    }
  }
  return cents;
}

// Re-export so callers can pull everything from "plans".
export { getModulesForTier, getTierById, findTierByLookupKey };
