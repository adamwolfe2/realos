# ADR-0003: Payment Processing with Stripe

**Status:** Accepted
**Date:** 2026-02-23

## Context

TBGC currently accepts payments via PayPal, Zelle, CashApp, mailed checks, and Stripe receipts — all manually tracked. We need a unified payment system that supports:
- Credit/debit card payments
- ACH bank transfers (low fees for large B2B orders)
- Checkout sessions (hosted payment page)
- Webhooks for payment status updates
- Future: invoicing, net terms, subscriptions

## Decision

Use **Stripe** as the sole payment processor.

## Rationale

1. **ACH fees**: 0.8% capped at $5 — a $10,000 order costs only $5 to process
2. **Checkout Sessions**: Hosted payment page, PCI-compliant, no card data on our servers
3. **Webhooks**: Reliable event delivery with automatic retries (72h)
4. **Invoicing**: Stripe Invoicing can handle net terms when ready
5. **Ecosystem**: Best documentation, widest adoption, easiest to find help

## Fee Structure

| Method | Fee |
|--------|-----|
| Cards | 2.9% + $0.30 |
| ACH | 0.8% (capped at $5) |
| Wire | $8 flat |
| Invoicing | +0.4% on top |

## Future: Net Terms

When TBGC is ready for Net 30/60/90 terms:
- Option A: Stripe Invoicing (send invoice, auto-remind, track payment)
- Option B: Resolve Pay (get paid immediately, buyer pays later — ~2.6-5.2% fee)

## Implementation

1. Create Stripe Checkout Session from order
2. Redirect user to Stripe-hosted page
3. Webhook `checkout.session.completed` → mark order as paid
4. Store `stripeSessionId` and `stripePaymentIntentId` on Order
