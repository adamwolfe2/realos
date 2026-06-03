/**
 * Proposal builder limits — single source of truth so the composer UI,
 * server-side validation, and Stripe sanity-checks agree.
 *
 * Picked to be generous enough for real-world deals (a $99,999.99 unit
 * × 999 quantity covers any tier or service line we'd write) but well
 * below Stripe Checkout's hard 99,999,999 cent total cap. Both layers
 * (input min/max + server validation) clamp to these values so the
 * composer never produces a Stripe-rejected payload.
 *
 * Cents — never floats.
 */

/// Maximum unit price in cents — $99,999.99 per line.
export const MAX_PRICE_CENTS = 9_999_999;

/// Maximum quantity per line. 999 covers any realistic service-line
/// count (seats, properties, integration hours). Higher counts indicate
/// a data-entry error, not a real deal.
export const MAX_QUANTITY = 999;

/// Maximum cents on a single proposal's line-item total (unit × qty).
/// Equal to MAX_PRICE_CENTS × MAX_QUANTITY ceil'd to the Stripe cap.
export const MAX_LINE_TOTAL_CENTS = MAX_PRICE_CENTS * MAX_QUANTITY;
