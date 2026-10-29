# Security fixes 2026-10-17 (from 5-agent review)

| # | Slice | Tier | Status | Evidence |
|---|-------|------|--------|----------|
| 1 | Clerk user.updated stops re-applying invite metadata (role/org), never provisions a removed user | 1 | done | __tests__/clerk-webhook-stale-metadata.test.ts (failed before fix) |
| 2 | Property-grant lookup fails closed on DB error | 1 | done | __tests__/property-grants-fail-closed.test.ts (failed before fix) |
| 3 | Partial marketplace refund: no status flip, no seller clawback, audit LEAD_PARTIALLY_REFUNDED | 1 | done | __tests__/marketplace-partial-refund.test.ts (failed before fix) |
| 4a | Resend audit rows store only type/email_id/created_at, not other tenants' subject/from | 1 | done | resend-webhook-engagement.test.ts new case (failed before fix) |
| 4b | Scope Resend opens/clicks + audit rows to sending org (tag org_id on every lead-facing send); keep bounces/complaints global | 1 | blocked | Needs Adam's call. Review (codex) confirmed opens/clicks still cross tenants: B's lead gets A's activity + A's emailId |

## Assumptions
- Partial refunds are absorbed by the platform; seller share is only reversed on full refund. Proportional clawback needs a reversedCents column (migration hits prod on push).
- user.updated with no DB row = removed user or user.created not yet processed (Clerk retries it); skip rather than provision.

## Review follow-ups (parallel-review wf_50a76e26-874, 11 confirmed)
- Fixed: user.created upsert no longer sets role on update; partial-refund audit deduped per (purchase, amount_refunded) + Sentry alert; isImpersonating derived from resolved target; empty catches in scope.ts now log; Resend diff fields type-checked; dead orgId check removed; skip-branch comment names real recovery path.
- Residual: a user.created retry landing after a removal can still re-create the membership (needs a removal tombstone; Svix only retries failed deliveries).
- Skipped: typed ScopeUnavailableError (optional).
