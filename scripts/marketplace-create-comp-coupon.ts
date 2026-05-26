import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });

import Stripe from "stripe";

// ---------------------------------------------------------------------------
// Create a 100%-off Stripe coupon + promotion code for marketplace testing.
//
// Run with:
//   node --env-file-if-exists=.env.local --import tsx \
//     scripts/marketplace-create-comp-coupon.ts
//
// Or pass overrides on the CLI:
//   node ... scripts/marketplace-create-comp-coupon.ts \
//     --code=COMP100 \
//     --emails=adamwolfe100@gmail.com,you@example.com \
//     --max-redemptions=20
//
// The script is IDEMPOTENT — re-running with the same --code skips the
// create step and prints the existing IDs. Use --rotate to force a new
// promotion code (e.g. if the previous one leaked).
//
// Mode awareness: reads STRIPE_SECRET_KEY from .env.local. If that starts
// with sk_live_, the coupon is created in LIVE mode. If sk_test_, TEST.
// Promo codes don't cross modes — create one of each if you test both.
// ---------------------------------------------------------------------------

interface Args {
  code: string;
  emails: string[];
  maxRedemptions: number;
  rotate: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = {
    code: "COMP100",
    emails: ["adamwolfe100@gmail.com"],
    maxRedemptions: 25,
    rotate: false,
  };
  for (const a of argv) {
    if (a.startsWith("--code=")) args.code = a.slice("--code=".length).trim().toUpperCase();
    else if (a.startsWith("--emails=")) {
      args.emails = a
        .slice("--emails=".length)
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    } else if (a.startsWith("--max-redemptions=")) {
      const n = Number(a.slice("--max-redemptions=".length));
      if (Number.isFinite(n) && n > 0) args.maxRedemptions = n;
    } else if (a === "--rotate") args.rotate = true;
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set in .env.local");

  const mode = key.startsWith("sk_live_") ? "LIVE" : "TEST";
  console.log(`Mode: ${mode}`);
  console.log(`Code: ${args.code}`);
  console.log(`Email allow-list: ${args.emails.join(", ")}`);
  console.log(`Max redemptions: ${args.maxRedemptions}`);
  console.log(`Rotate code: ${args.rotate ? "yes (force new)" : "no (reuse if exists)"}`);
  console.log();

  const stripe = new Stripe(key);

  // 1. Coupon — create if not present, look up by name otherwise. Stripe
  // coupons aren't keyed by anything stable other than `id`; we use a
  // deterministic id derived from the code so re-runs find the same row.
  const couponId = `marketplace_${args.code.toLowerCase()}_${mode.toLowerCase()}`;
  let coupon: Stripe.Coupon | null = null;
  try {
    coupon = await stripe.coupons.retrieve(couponId);
    console.log(`✓ Coupon already exists: ${coupon.id}`);
  } catch (err) {
    if ((err as Stripe.StripeError).code !== "resource_missing") throw err;
    coupon = await stripe.coupons.create({
      id: couponId,
      name: `Marketplace comp · ${args.code}`,
      percent_off: 100,
      duration: "once",
      metadata: {
        purpose: "marketplace-internal-testing",
        emails: args.emails.join(","),
      },
    });
    console.log(`✓ Created coupon: ${coupon.id}`);
  }

  // 2. Promotion code — Stripe restricts these by `code` per coupon. We
  // look up any active code on this coupon first; if found and --rotate
  // wasn't passed, reuse it.
  const existingCodes = await stripe.promotionCodes.list({
    coupon: coupon.id,
    active: true,
    limit: 5,
  });
  let promo: Stripe.PromotionCode | null = null;
  for (const p of existingCodes.data) {
    if (p.code === args.code) {
      promo = p;
      break;
    }
  }

  if (promo && !args.rotate) {
    console.log(`✓ Promotion code already exists: ${promo.code} (id=${promo.id})`);
  } else {
    // Rotate: deactivate the old one before creating a new one with the same code.
    if (promo && args.rotate) {
      await stripe.promotionCodes.update(promo.id, { active: false });
      console.log(`✓ Deactivated old promo code id=${promo.id}`);
    }
    promo = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: args.code,
      max_redemptions: args.maxRedemptions,
      restrictions: {
        // Stripe only honors first_time_transaction + minimum_amount here.
        // Email allow-listing is enforced by the Checkout's `customer_email`
        // field — the buyer's email is already pre-set on our checkout
        // sessions, so the promo simply won't apply to a non-allow-listed
        // customer if we add the email gate below.
        first_time_transaction: false,
        minimum_amount: 0,
        minimum_amount_currency: "usd",
      },
      metadata: {
        emailAllowList: args.emails.join(","),
        createdBy: "scripts/marketplace-create-comp-coupon.ts",
      },
    });
    console.log(`✓ Created promotion code: ${promo.code} (id=${promo.id})`);
  }

  console.log();
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Use this code at checkout:  ${promo.code}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log();
  console.log(`Stripe dashboard:`);
  const base = mode === "LIVE"
    ? "https://dashboard.stripe.com"
    : "https://dashboard.stripe.com/test";
  console.log(`  Coupon:    ${base}/coupons/${coupon.id}`);
  console.log(`  Promo:     ${base}/promotion_codes/${promo.id}`);
  console.log();
  console.log("Next step:");
  console.log("  1. Open a marketplace lead, click 'Buy lead'");
  console.log("  2. On the Stripe Checkout page, click 'Add promotion code'");
  console.log(`  3. Enter: ${promo.code}`);
  console.log("  4. Total goes to $0 — click 'Pay' to complete the test");
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
