// Stripe constants for RealOS.
// Volume-discount + net-term distribution concepts removed; real estate retainer
// billing is flat MRR with one-time build fees. Kept generic surface for Stripe
// Webhook event typing.

/** Stripe API version pinned for this project */
export const STRIPE_API_VERSION = "2026-02-25.clover" as const;

/** Default currency */
export const STRIPE_CURRENCY = "usd" as const;

/** Webhook event types we handle */
export const HANDLED_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.expired",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.finalized",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "charge.dispute.created",
] as const;

export type HandledWebhookEvent = (typeof HANDLED_WEBHOOK_EVENTS)[number];

/** Stripe statement descriptor (max 22 chars) */
export const STATEMENT_DESCRIPTOR =
  (process.env.BRAND_NAME ?? "REALOS").toUpperCase().slice(0, 22);

/** Maximum invoice line items Stripe allows */
export const MAX_INVOICE_LINE_ITEMS = 250;
