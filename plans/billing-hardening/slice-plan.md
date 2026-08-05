# Billing hardening slice plan

## Working brief

- Feature: self-serve trial activation and ongoing Stripe billing.
- Primary actors: `CLIENT_OWNER`; authorized LeaseStack agency staff while supporting a client.
- Core invariant: LeaseStack never grants or preserves paid access until Stripe confirms payment, and every charge is derived from the server-owned catalog and tenant-owned subscription.
- Previous behavior preserved: no-card trial, exact per-feature pricing, webhook-authoritative entitlements, Stripe-hosted Checkout and Portal, read-only expired workspaces, recoverable dunning grace for customers who previously paid.
- Unsafe outcomes: first-payment failure unlocks access; wrong role opens Checkout/Portal; duplicate/different carts reuse a session; property changes leave feature item quantities stale; success copy claims payment without verification; tiered MRR caches as zero.
- Assumption approved: activation during a trial collects payment details now and starts billing at the existing trial end. An already-expired trial charges immediately.
- Out of scope: canceling or modifying live Stripe subscriptions, enabling self-serve plan changes in Stripe Portal, database schema changes, or redesigning the billing page.
- Risk: Tier 1 (money, permissions, webhooks, access state).

## Dependency graph

`S1 checkout contract + authorization` -> `S2 payment state + MRR` -> `S3 quantity reconciliation` -> `S4 verified success + truthful UI` -> `S5 integrated verification`

## Progress

| Slice | Status |
| --- | --- |
| S1 Checkout contract and billing authorization | done |
| S2 First-payment state and MRR | done |
| S3 Multi-item property quantity sync | done |
| S4 Verified success and portal/UI truth | done |
| S5 Integrated verification and review | done |

## S1 — Checkout contract and billing authorization

- Actor/trigger: owner or authorized agency staff selects Activate.
- Action: create one server-priced Stripe Checkout session for the exact canonical cart.
- Invariant: client input cannot choose price, tenant, role, or trial deadline.
- Intentional change: preserve remaining trial days in Stripe; reject non-owner client roles; idempotency includes a canonical cart fingerprint.
- Files: checkout route, shared billing authorization/cart helpers, focused route tests.
- Tests: wrong role, agency support role, trial end, expired trial, canonical cart idempotency, duplicate module keys, Stripe/DB failures.
- Acceptance: Checkout receives server-resolved prices and `trial_end` only when the in-app trial remains active.

## S2 — First-payment state and MRR

- Actor/trigger: Stripe subscription and invoice webhooks.
- Action: synchronize status, entitlements, MRR, and recovery.
- Invariant: `incomplete`, `unpaid`, or a failed first invoice never converts an unactivated trial into paid grace.
- Intentional change: `invoice.paid` is the activation boundary; tiered MRR uses graduated catalog math.
- Files: webhook domain helpers/route, MRR helper, behavior tests.
- Tests: incomplete first subscription, failed first invoice, paid first invoice, previously-active dunning, replay, graduated and feature MRR.
- Acceptance: only paid invoice activates a trial; existing paid customers retain the documented grace/recovery behavior.

## S3 — Multi-item property quantity sync

- Actor/trigger: billable property count changes.
- Action: update every recurring per-property item on the active subscription in one Stripe call.
- Invariant: every per-property line item has the same current billable quantity; metered/fixed items are untouched.
- Files: quantity sync service and tests.
- Tests: feature subscription, legacy tier, mixed fixed/metered items, already-matching quantities, Stripe failure.
- Acceptance: an a-la-carte subscription no longer returns `no_tier_item_on_subscription`.

## S4 — Verified success and portal/UI truth

- Actor/trigger: Stripe returns from Checkout; user opens billing/portal.
- Action: retrieve and tenant-check the Checkout session before displaying a success/processing state.
- Invariant: a URL alone cannot claim payment or activation.
- Files: success page/service, trial card copy, billing portal route/copy/nav visibility, tests.
- Tests: missing/foreign/unpaid/paid session, client-admin denial, no-customer message.
- Acceptance: UI distinguishes payment method scheduled, processing, and active; portal accurately describes enabled capabilities.

## S5 — Integrated verification and review

- Run focused and full billing tests, TypeScript, lint, and production build.
- Run browser verification against a local/test-mode fixture without creating live Stripe resources.
- Run independent Tier-1 review and `dual-review` before any push.
- Re-check working tree for secrets and environment files.
- Live subscription reconciliation remains read-only and separately reviewed; no cancellation is authorized.

### Verification result

- Full suite: 189 files, 1,995 tests passed.
- TypeScript, full-repo ESLint (zero errors), diff check, and production build passed.
- Browser E2E used a disposable local Postgres database and Stripe test mode only:
  - continuing trial: $248/month, $0 due today, card saved, Stripe subscription `trialing`, LeaseStack remained `TRIALING`, and the return page truthfully said no charge occurred;
  - expired trial: $248 due today, successful test-card charge, all forwarded webhooks returned 200, Stripe subscription became `active`, and LeaseStack became `ACTIVE` with $248 MRR and the selected module intact.
- Stripe can label a zero-dollar trial Checkout `payment_status=paid`; return-state verification now expands the subscription and treats Stripe `trialing` status as scheduled, with a regression test.
- A trialing-but-unpaid Checkout is rejected, and the scheduled billing date comes from Stripe's expanded subscription before falling back to the database; both review findings have regression tests.
- All disposable Stripe customers, subscriptions, prices, products, local database containers, and temporary app files were cleaned up after verification. No live Stripe resources or production customer records were mutated.
- Independent Tier-1 and Codex read-only reviews: PASS. The final reviewer found two medium return-page truthfulness edges; both were fixed and reverified with the full suite and production build.
