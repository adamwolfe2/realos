# Security fixes 2026-10-17 (from 5-agent review)

| # | Slice | Tier | Status | Evidence |
|---|-------|------|--------|----------|
| 1 | Clerk user.updated stops re-applying invite metadata (role/org), never provisions a removed user | 1 | done | __tests__/clerk-webhook-stale-metadata.test.ts (failed before fix) |
| 2 | Property-grant lookup fails closed on DB error | 1 | done | __tests__/property-grants-fail-closed.test.ts (failed before fix) |
| 3 | Partial marketplace refund: no status flip, no seller clawback, audit LEAD_PARTIALLY_REFUNDED | 1 | done | __tests__/marketplace-partial-refund.test.ts (failed before fix) |
| 4a | Resend audit rows store only type/email_id/created_at, not other tenants' subject/from | 1 | done | resend-webhook-engagement.test.ts new case (failed before fix) |
| 4b | Scope Resend opens/complaints to sending org (tag org_id on every lead-facing send) | 1 | blocked | Decision: current cross-org unsubscribe is documented intent; shared sending domain reputation argues for keeping complaints global |

## Assumptions
- Partial refunds are absorbed by the platform; seller share is only reversed on full refund. Proportional clawback needs a reversedCents column (migration hits prod on push).
- user.updated with no DB row = removed user or user.created not yet processed (Clerk retries it); skip rather than provision.
