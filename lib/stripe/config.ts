/**
 * Wholesail Stripe Integration — Configuration & Initialisation
 *
 * Single source of truth for Stripe client setup.
 * Prefer importing from here rather than lib/payments/stripe.ts for new code.
 */

import Stripe from "stripe";
import { StripeNotConfiguredError } from "./errors";
import { BRAND_NAME } from "@/lib/brand";

/** Pinned Stripe API version. Bumped intentionally on SDK upgrade. */
const STRIPE_API_VERSION = "2026-02-25.clover" as const satisfies Stripe.LatestApiVersion;

let _stripe: Stripe | null = null;

/** Returns true if all required Stripe environment variables are present */
export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET
  );
}

/**
 * Returns a singleton Stripe client.
 * Throws StripeNotConfiguredError in dev/prod if keys are missing.
 */
export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new StripeNotConfiguredError();
  }

  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
      appInfo: {
        name: BRAND_NAME,
        version: "1.0.0",
      },
    });
  }

  return _stripe;
}

/** Construct and verify a Stripe webhook event */
export async function parseWebhookEvent(
  rawBody: string | Buffer,
  signature: string
): Promise<Stripe.Event> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new StripeNotConfiguredError();

  return getStripeClient().webhooks.constructEventAsync(
    rawBody,
    signature,
    secret
  );
}
