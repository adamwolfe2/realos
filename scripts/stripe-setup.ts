/**
 * Stripe catalog setup — creates / updates every Product and Price the
 * LeaseStack billing layer needs, in either test or live mode.
 *
 * Idempotent: each Product is identified by `metadata.lookup_key` and each
 * Price by Stripe's built-in `lookup_key` field. Re-running the script
 * finds existing entities by those keys and leaves them alone if the
 * underlying definition hasn't changed.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/stripe-setup.ts
 *   STRIPE_SECRET_KEY=sk_live_... pnpm tsx scripts/stripe-setup.ts
 *
 * The script never deletes anything in Stripe. If a price needs to change,
 * bump its lookup_key version in lib/billing/catalog.ts (e.g. _v1 → _v2)
 * and re-run. The old price stays in Stripe (still attached to existing
 * customers) until you archive it from the dashboard.
 *
 * Outputs:
 *   - Prints a summary of every entity created or already-present
 *   - Writes lib/billing/price-ids.generated.ts mapping lookup_key →
 *     Stripe price ID, which plans.ts imports
 */

import Stripe from "stripe";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ADDONS, TIERS, type AddOnDefinition } from "../lib/billing/catalog";

if (!process.env.STRIPE_SECRET_KEY) {
  console.error(
    "STRIPE_SECRET_KEY is not set. Export the LeaseStack key first:\n" +
      "  export STRIPE_SECRET_KEY=$(stripe config --project-name leasestack --list | grep test_mode_api_key | cut -d= -f2 | tr -d \" '\")\n" +
      "then re-run.",
  );
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover" as Stripe.LatestApiVersion,
  appInfo: { name: "LeaseStack setup", version: "1.0.0" },
});

const isLive = process.env.STRIPE_SECRET_KEY.startsWith("sk_live_");
const mode = isLive ? "LIVE" : "TEST";

console.log(`\n=== LeaseStack Stripe setup — ${mode} MODE ===\n`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ProductSpec = {
  lookupKey: string;
  name: string;
  description: string;
};

type PriceSpec = {
  lookupKey: string;
  productId: string;
  unitAmountCents: number;
  recurringInterval?: "month" | "year";
  recurringUsageType?: "licensed" | "metered";
  // Stripe Billing Meter id — required when recurringUsageType=metered
  // (Stripe API 2025-03-31+).
  meterId?: string;
  metadata?: Record<string, string>;
};

/**
 * Find or create a Stripe Billing Meter. Metered prices (as of API
 * 2025-03-31) must be backed by a Meter; usage events are reported to
 * the meter's event_name and the price aggregates against them.
 *
 * Meters can't be deleted, only deactivated. Re-running this is safe —
 * the first run creates, subsequent runs find by event_name.
 */
async function findOrCreateMeter(spec: {
  eventName: string;
  displayName: string;
}): Promise<Stripe.Billing.Meter> {
  // The Meters list API doesn't filter server-side by event_name, so we
  // list (max 100, our catalog is tiny) and filter client-side.
  let starting_after: string | undefined;
  while (true) {
    const page = await stripe.billing.meters.list({
      limit: 100,
      ...(starting_after ? { starting_after } : {}),
    });
    for (const m of page.data) {
      if (m.event_name === spec.eventName) {
        console.log(`  ✓ meter exists:    ${spec.eventName}`);
        return m;
      }
    }
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  const created = await stripe.billing.meters.create({
    display_name: spec.displayName,
    event_name: spec.eventName,
    // `count` = each event represents one unit consumed.
    // `sum`   = each event carries a `value` and the meter sums them.
    // We use SUM so callers can report N visitors / N dollars in one event.
    default_aggregation: { formula: "sum" },
    customer_mapping: {
      type: "by_id",
      event_payload_key: "stripe_customer_id",
    },
    value_settings: { event_payload_key: "value" },
  });
  console.log(`  + meter created:   ${spec.eventName}  (${created.id})`);
  return created;
}

/**
 * Find an existing product by metadata.lookup_key, or create one. Stripe
 * doesn't support querying products by metadata server-side (the search
 * API does but returns stale results); we list and filter client-side,
 * which is fine for our ~15-product catalog.
 */
async function findOrCreateProduct(spec: ProductSpec): Promise<Stripe.Product> {
  // Search API is eventually consistent — use list + manual filter.
  // Iterate pages because list returns max 100.
  let starting_after: string | undefined;
  while (true) {
    const page = await stripe.products.list({
      limit: 100,
      ...(starting_after ? { starting_after } : {}),
    });
    for (const p of page.data) {
      if (p.metadata?.lookup_key === spec.lookupKey) {
        // Update name/description if they drifted.
        if (
          p.name !== spec.name ||
          p.description !== spec.description
        ) {
          const updated = await stripe.products.update(p.id, {
            name: spec.name,
            description: spec.description,
          });
          console.log(`  ↻ product updated: ${spec.lookupKey}`);
          return updated;
        }
        console.log(`  ✓ product exists:  ${spec.lookupKey}`);
        return p;
      }
    }
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  const created = await stripe.products.create({
    name: spec.name,
    description: spec.description,
    metadata: { lookup_key: spec.lookupKey },
  });
  console.log(`  + product created: ${spec.lookupKey}  (${created.id})`);
  return created;
}

/**
 * Find an existing price by built-in lookup_key, or create one.
 *
 * NOTE: Stripe prices are immutable. If the spec amount differs from the
 * existing price, we ARCHIVE the old one (set active=false) and create a
 * new price under the same lookup_key. This is the Stripe-recommended
 * pattern for price changes — existing subscriptions keep the old price,
 * new ones get the new amount.
 */
async function findOrCreatePrice(spec: PriceSpec): Promise<Stripe.Price> {
  const existing = await stripe.prices.list({
    lookup_keys: [spec.lookupKey],
    limit: 1,
    active: true,
  });
  if (existing.data.length > 0) {
    const e = existing.data[0];
    if (e.unit_amount === spec.unitAmountCents) {
      console.log(`  ✓ price exists:    ${spec.lookupKey}`);
      return e;
    }
    // Amount drift — archive + recreate.
    console.log(
      `  ↻ price amount changed (${e.unit_amount} → ${spec.unitAmountCents}), archiving old price`,
    );
    await stripe.prices.update(e.id, {
      active: false,
      lookup_key: `${spec.lookupKey}_archived_${Date.now()}`,
    });
  }

  const params: Stripe.PriceCreateParams = {
    currency: "usd",
    product: spec.productId,
    unit_amount: spec.unitAmountCents,
    lookup_key: spec.lookupKey,
    metadata: spec.metadata ?? {},
  };

  if (spec.recurringInterval) {
    params.recurring = {
      interval: spec.recurringInterval,
      usage_type: spec.recurringUsageType ?? "licensed",
      ...(spec.recurringUsageType === "metered" && spec.meterId
        ? { meter: spec.meterId }
        : {}),
    };
  }

  const created = await stripe.prices.create(params);
  console.log(`  + price created:   ${spec.lookupKey}  (${created.id})`);
  return created;
}

function metadataForTierPrice(
  tier: string,
  cycle: "monthly" | "annual",
  perProperty: "base" | "additional" | "setup",
): Record<string, string> {
  return { tier, cycle, per_property: perProperty };
}

function metadataForAddon(
  addon: AddOnDefinition,
): Record<string, string> {
  return {
    kind: "addon",
    billing_mode: addon.billingMode,
    ...(addon.meteredUnit ? { metered_unit: addon.meteredUnit } : {}),
  };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function run() {
  const priceIdMap: Record<string, string> = {};

  console.log("[1/3] Tiers — products + prices");

  for (const tier of TIERS) {
    console.log(`\n  Tier: ${tier.productName} (${tier.tier})`);

    const product = await findOrCreateProduct({
      lookupKey: tier.productLookupKey,
      name: tier.productName,
      description: tier.productDescription,
    });

    const tierPrices = [
      {
        ...tier.monthly,
        recurringInterval: "month" as const,
        metadata: metadataForTierPrice(tier.tier, "monthly", "base"),
      },
      {
        ...tier.annual,
        recurringInterval: "year" as const,
        metadata: metadataForTierPrice(tier.tier, "annual", "base"),
        unitAmountCents: tier.annual.unitAmountCents * 12, // annual prepay billed yearly, surface as monthly-equivalent on the UI
      },
      {
        ...tier.additionalPropertyMonthly,
        recurringInterval: "month" as const,
        metadata: metadataForTierPrice(tier.tier, "monthly", "additional"),
      },
      {
        ...tier.additionalPropertyAnnual,
        recurringInterval: "year" as const,
        metadata: metadataForTierPrice(tier.tier, "annual", "additional"),
        unitAmountCents: tier.additionalPropertyAnnual.unitAmountCents * 12,
      },
      {
        ...tier.setupFee,
        metadata: metadataForTierPrice(tier.tier, "monthly", "setup"),
      },
    ];

    for (const p of tierPrices) {
      const price = await findOrCreatePrice({
        ...p,
        productId: product.id,
      });
      priceIdMap[p.lookupKey] = price.id;
    }
  }

  console.log("\n[2/3] Add-ons — products + prices");
  for (const addon of ADDONS) {
    console.log(`\n  Add-on: ${addon.productName}`);

    const product = await findOrCreateProduct({
      lookupKey: addon.productLookupKey,
      name: addon.productName,
      description: addon.productDescription,
    });

    const priceSpec: PriceSpec = {
      lookupKey: addon.priceLookupKey,
      productId: product.id,
      unitAmountCents: addon.unitAmountCents,
      metadata: metadataForAddon(addon),
    };

    if (addon.billingMode === "recurring_monthly") {
      priceSpec.recurringInterval = "month";
      priceSpec.recurringUsageType = "licensed";
    } else if (addon.billingMode === "metered") {
      // Provision a Stripe Billing Meter that backs this metered price.
      if (!addon.meterEventName || !addon.meterDisplayName) {
        throw new Error(
          `Metered add-on ${addon.productLookupKey} missing meter config`,
        );
      }
      const meter = await findOrCreateMeter({
        eventName: addon.meterEventName,
        displayName: addon.meterDisplayName,
      });
      priceSpec.recurringInterval = "month";
      priceSpec.recurringUsageType = "metered";
      priceSpec.meterId = meter.id;
      priceSpec.metadata = {
        ...(priceSpec.metadata ?? {}),
        meter_event_name: addon.meterEventName,
      };
    }
    // one_time → no recurring block

    const price = await findOrCreatePrice(priceSpec);
    priceIdMap[addon.priceLookupKey] = price.id;
  }

  console.log("\n[3/3] Writing price-ids.generated.ts");
  const banner = `// AUTO-GENERATED by scripts/stripe-setup.ts — do not edit by hand.
// Re-run \`pnpm tsx scripts/stripe-setup.ts\` after any change to
// lib/billing/catalog.ts to regenerate. Generated against the ${mode} mode
// of the LeaseStack Stripe account (acct_*).
//
// This file is the source of truth at runtime: lookup_key → Stripe price ID.
// Checked into git so deployments don't need to re-discover IDs and so
// the dashboard always reflects the same catalog the code is wired to.
`;
  const entries = Object.entries(priceIdMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, id]) => `  "${key}": "${id}",`)
    .join("\n");

  const ts = `${banner}
export const STRIPE_PRICE_IDS = {
${entries}
} as const;

export type StripeLookupKey = keyof typeof STRIPE_PRICE_IDS;

export const STRIPE_MODE = ${JSON.stringify(mode)};
`;

  const outPath = join(
    process.cwd(),
    "lib/billing/price-ids.generated.ts",
  );
  writeFileSync(outPath, ts, "utf8");
  console.log(`  wrote ${outPath}`);

  console.log(
    `\n=== Done. ${Object.keys(priceIdMap).length} prices registered in ${mode} mode. ===\n`,
  );
}

run().catch((err) => {
  console.error("\nSetup failed:", err);
  process.exit(1);
});
