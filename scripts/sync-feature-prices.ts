/**
 * One-off: create/refresh a recurring Stripe Price per onboarding feature
 * (+ base platform) at the current admin-set amount. Idempotent — skips a
 * feature whose live price already matches. Mirrors
 * lib/billing/feature-stripe.ts but standalone so it runs under tsx without the
 * server-only import chain.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... DATABASE_URL=postgres://... \
 *     pnpm tsx scripts/sync-feature-prices.ts
 */
import Stripe from "stripe";
import { neon } from "@neondatabase/serverless";
import { FEATURE_CATALOG, BASE_PLATFORM_CENTS } from "../lib/billing/features";

const BASE_KEY = "base_platform";
function lookupKey(key: string): string {
  return key === BASE_KEY ? "ls_base_platform_monthly" : `ls_feat_${key}_monthly`;
}

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const DB_URL = process.env.DATABASE_URL;
if (!STRIPE_KEY || !DB_URL) {
  console.error("Missing STRIPE_SECRET_KEY or DATABASE_URL");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_KEY);
const sql = neon(DB_URL);

type Row = { key: string; label: string; cents: number };

async function main() {
  const dbRows = (await sql`
    SELECT key, "monthlyCents", "stripeProductId", "stripePriceId" FROM "FeaturePrice"
  `) as Array<{
    key: string;
    monthlyCents: number;
    stripeProductId: string | null;
    stripePriceId: string | null;
  }>;
  const byKey = new Map(dbRows.map((r) => [r.key, r]));

  const rows: Row[] = [
    {
      key: BASE_KEY,
      label: "LeaseStack platform (base)",
      cents: Number(byKey.get(BASE_KEY)?.monthlyCents ?? BASE_PLATFORM_CENTS),
    },
    ...FEATURE_CATALOG.map((f) => ({
      key: f.key,
      label: f.name,
      cents: Number(byKey.get(f.key)?.monthlyCents ?? f.monthlyCents),
    })),
  ];

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const existing = byKey.get(row.key);

      let productId = existing?.stripeProductId ?? null;
      if (productId) {
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

      if (existing?.stripePriceId) {
        const cur = await stripe.prices
          .retrieve(existing.stripePriceId)
          .catch(() => null);
        if (cur && cur.active && cur.unit_amount === row.cents) {
          skipped++;
          console.log(`skip   ${row.key} (unchanged $${row.cents / 100})`);
          continue;
        }
      }

      const price = await stripe.prices.create({
        product: productId,
        currency: "usd",
        unit_amount: row.cents,
        recurring: { interval: "month" },
        lookup_key: lookupKey(row.key),
        transfer_lookup_key: true,
        metadata: { featureKey: row.key },
      });

      await sql`
        INSERT INTO "FeaturePrice"
          (id, key, "monthlyCents", active, "stripePriceId", "stripeProductId", "stripeSyncedAt", "createdAt", "updatedAt")
        VALUES
          (${"fp_" + row.key}, ${row.key}, ${row.cents}, true, ${price.id}, ${productId}, now(), now(), now())
        ON CONFLICT (key) DO UPDATE SET
          "monthlyCents" = ${row.cents},
          "stripePriceId" = ${price.id},
          "stripeProductId" = ${productId},
          "stripeSyncedAt" = now(),
          "updatedAt" = now()
      `;
      synced++;
      console.log(`synced ${row.key} -> ${price.id} ($${row.cents / 100})`);
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      errors.push(`${row.key}: ${msg}`);
      console.error(`ERROR  ${row.key}: ${msg}`);
    }
  }

  console.log("\n=== RESULT ===");
  console.log(JSON.stringify({ synced, skipped, errors }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
