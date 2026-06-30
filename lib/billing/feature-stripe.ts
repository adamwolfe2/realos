import "server-only";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe/config";
import { getFeaturePriceRows, BASE_PLATFORM_KEY } from "@/lib/billing/feature-prices";
import { FEATURE_CATALOG, ALWAYS_ON_MODULE_KEYS } from "@/lib/billing/features";

// ---------------------------------------------------------------------------
// Per-feature Stripe pricing (slice). Each feature (+ base platform) gets a
// recurring monthly Stripe Price whose amount = the admin-set FeaturePrice.
// We use a STABLE lookup_key per feature and `transfer_lookup_key: true` so
// when an admin edits a price we create a new Price and move the lookup_key to
// it — old subscriptions keep their old price, new checkouts get the new one.
//
// The resulting price/product IDs are stored on the FeaturePrice row, so
// checkout (build line items) and the webhook (price ID → feature module) read
// from the DB, not the static price-ids.generated.ts file.
//
// NOTHING here runs on deploy — it's only invoked by the admin "Sync to
// Stripe" action.
// ---------------------------------------------------------------------------

export function featureStripeLookupKey(key: string): string {
  return key === BASE_PLATFORM_KEY ? "ls_base_platform_monthly" : `ls_feat_${key}_monthly`;
}

export type SyncResult = {
  synced: number;
  skipped: number;
  errors: string[];
};

// Create/refresh a Stripe Price for every feature + base at its current
// admin-set amount. Idempotent: skips a feature whose live Stripe price already
// matches the amount. Safe to re-run.
export async function syncAllFeaturePricesToStripe(): Promise<SyncResult> {
  const stripe = getStripeClient();
  const rows = await getFeaturePriceRows();
  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const existing = await prisma.featurePrice.findUnique({
        where: { key: row.key },
      });

      // Reuse the product across price edits; create it once per feature.
      let productId = existing?.stripeProductId ?? null;
      if (productId) {
        // Verify it still exists + isn't archived; recreate if gone.
        const ok = await stripe.products
          .retrieve(productId)
          .then((p) => !p.deleted && p.active)
          .catch(() => false);
        if (!ok) productId = null;
      }
      if (!productId) {
        const product = await stripe.products.create({
          name: `LeaseStack — ${row.label}`,
          metadata: { featureKey: row.key },
        });
        productId = product.id;
      }

      // If the current linked price already matches the amount + is active, no
      // need to mint a new one.
      if (existing?.stripePriceId) {
        const cur = await stripe.prices
          .retrieve(existing.stripePriceId)
          .catch(() => null);
        if (cur && cur.active && cur.unit_amount === row.monthlyCents) {
          // Price is unchanged — but if we just recreated the PRODUCT (the old
          // one was deleted/archived in Stripe), persist the new product id so
          // the next sync doesn't keep recreating orphan products. (Found by a
          // Codex review.)
          if (productId !== existing.stripeProductId) {
            await prisma.featurePrice
              .update({
                where: { key: row.key },
                data: { stripeProductId: productId },
              })
              .catch(() => undefined);
          }
          skipped++;
          continue;
        }
      }

      // Idempotency guard: a prior sync run may have created the price in
      // Stripe but then failed before persisting price.id to the DB (e.g. the
      // upsert below threw). On re-run, reuse that orphan instead of minting a
      // duplicate. We match by lookup_key (stable per feature) + amount +
      // active, so re-running sync is a no-op when Stripe is already correct.
      const lookupKey = featureStripeLookupKey(row.key);
      const priorByKey = await stripe.prices
        .list({ lookup_keys: [lookupKey], active: true, limit: 1 })
        .catch(() => null);
      const reusable = priorByKey?.data.find(
        (p) => p.active && p.unit_amount === row.monthlyCents,
      );

      const price =
        reusable ??
        (await stripe.prices.create({
          product: productId,
          currency: "usd",
          unit_amount: row.monthlyCents,
          recurring: { interval: "month" },
          lookup_key: lookupKey,
          transfer_lookup_key: true,
          metadata: { featureKey: row.key },
        }));

      await prisma.featurePrice.upsert({
        where: { key: row.key },
        update: {
          monthlyCents: row.monthlyCents,
          stripePriceId: price.id,
          stripeProductId: productId,
          stripeSyncedAt: new Date(),
        },
        create: {
          key: row.key,
          monthlyCents: row.monthlyCents,
          active: row.active,
          stripePriceId: price.id,
          stripeProductId: productId,
          stripeSyncedAt: new Date(),
        },
      });
      synced++;
    } catch (err) {
      errors.push(`${row.key}: ${(err as Error)?.message?.slice(0, 140) ?? "error"}`);
    }
  }

  return { synced, skipped, errors };
}

// Checkout helper: resolve the Stripe price ID for a feature key (or base).
// Returns null if not synced yet.
export async function getFeatureStripePriceId(key: string): Promise<string | null> {
  const row = await prisma.featurePrice
    .findUnique({ where: { key }, select: { stripePriceId: true } })
    .catch(() => null);
  return row?.stripePriceId ?? null;
}

// Webhook helper: given a Stripe price ID, find which feature key it belongs to
// (so we can flip exactly that module). Null if the price isn't a feature price.
export async function featureKeyFromStripePriceId(
  priceId: string,
): Promise<string | null> {
  const row = await prisma.featurePrice
    .findFirst({ where: { stripePriceId: priceId }, select: { key: true } })
    .catch(() => null);
  return row?.key ?? null;
}

// Webhook resolver: given the price IDs on a subscription, if any are
// per-feature prices, return the EXACT module state — always-on base modules
// true, each catalog feature true iff its price is on the subscription, all
// other catalog features false. This is what stops the trial→paid conversion
// from clobbering the operator's à-la-carte selection with tier defaults.
// Returns null when the subscription has no feature prices (legacy tier sub),
// so the caller can fall back to the tier mapping.
export async function modulesFromFeaturePriceIds(
  priceIds: string[],
): Promise<Record<string, boolean> | null> {
  if (priceIds.length === 0) return null;
  // Do NOT swallow a DB error to [] — that would look like "no feature prices",
  // fall through to tier defaults (or no change), and let the webhook commit
  // status/MRR while the module entitlement stays wrong. Let it throw so the
  // Stripe webhook returns non-2xx and retries. (Codex.)
  const rows = await prisma.featurePrice.findMany({
    where: { stripePriceId: { in: priceIds } },
    select: { key: true },
  });
  if (rows.length === 0) return null; // not an à-la-carte subscription

  const matched = new Set(rows.map((r) => r.key));
  const state: Record<string, boolean> = {};
  for (const k of ALWAYS_ON_MODULE_KEYS) state[k] = true;
  for (const f of FEATURE_CATALOG) state[f.key] = matched.has(f.key);
  return state;
}

// Whether every feature + base has been synced to Stripe (drives the admin
// "needs sync" banner + guards checkout).
export async function getFeatureSyncStatus(): Promise<{
  total: number;
  synced: number;
  pendingKeys: string[];
}> {
  const rows = await prisma.featurePrice.findMany({
    select: { key: true, stripePriceId: true },
  });
  const synced = rows.filter((r) => r.stripePriceId).length;
  const pendingKeys = rows.filter((r) => !r.stripePriceId).map((r) => r.key);
  return { total: rows.length, synced, pendingKeys };
}
