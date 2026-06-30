# LeaseStack Enterprise Hardening — Progress Report

**Run:** 2026-06-30 (overnight, autonomous) · **Branch:** `harden/launch-readiness-2026-06-30`
**Baseline:** `main` @ `a2a62468` · TypeScript clean · 391 unit-test files green at start.

> **Headline:** The platform is in **far better shape than the launch brief assumed.**
> The brief's premise (Supabase, redirect loops, hardcoded `repMap.ts`, leaking
> paywall) is largely outdated. The repo is Prisma/Neon + Clerk, the apex/www +
> redirect logic is sound, and the prior 2026-06-19 launch-readiness audit's two
> **P0 data-exposure holes were already fixed** (marketplace PII masked, Cal
> webhook tokenized). 12 of 15 audited findings were already remediated with
> regression tests. This run closed the remaining real gaps and audited the new
> surfaces shipped in the last 11 days that the prior audit never saw.

---

## Method

1. Re-verified all 15 findings from the 2026-06-19 adversarial audit against
   current code (many had landed as commits `0589f591`…`200459c9`).
2. Fixed the genuinely-open items with tests, on a branch, for human merge
   (never auto-merged to `main` — Tier-1 billing/auth changes need your eyes).
3. Ran a **fresh** read-only adversarial sweep on the surfaces added since the
   audit (admin create-client, attribution/GA4 boards) + the brief's specific
   worries (middleware redirect loops, apex→www, `/admin/pricing` Stripe sync).

---

## Completed (shipped to the branch, 2 commits, all tests green)

### Commit `adf99ee5` — billing dunning + AppFolio attribution
- **Paused dunning was a lie → made it true + safe.** The 14-day-overdue email
  said "your account has been paused," but the portal stayed fully writable
  (`isWorkspaceReadOnly` only checked expired trials). Now:
  - `isWorkspaceReadOnly` treats `subscriptionStatus=PAUSED` as read-only.
  - Escalation sets `subscriptionStatus=PAUSED` alongside `TenantStatus.PAUSED`.
  - **`invoice.paid` now reverses `TenantStatus.PAUSED → ACTIVE`** (latent bug:
    previously the chatbot pause never lifted after payment).
  - Verified safe: the Stripe billing-portal route uses `requireScope` (not
    writable-gated), so a paused customer can **always still pay**; impersonating
    support bypasses the lock. No pay-lockout risk.
- **AppFolio showings wrong-building attribution.** Tours for a lead with no
  resolved property were attached to the org's "first ACTIVE property." Now only
  auto-attaches when the org has exactly one active property; multi-property orgs
  skip-with-warning (matches residents/leases/work-orders/applications rule).
- Tests: `trial-status-paused` (behavioral), `billing-reminders-paused`,
  `appfolio-showings-attribution`, + stripe-webhook restore assertion.

### Commit `d1b019df` — GA4 reliability + Stripe pricing idempotency
- **GA4 `runReport` had no timeout** → a slow/hung Analytics Data API call
  blocked the entire `/portal/attribution` page (calls run in a `Promise.all`;
  a code comment *claimed* "timeout → null" but none existed). All **5** call
  sites now pass `{ timeout: 8000 }`; on timeout the page degrades to pixel-only
  attribution. (The audit agent reported only 3 sites — the test asserting "one
  timeout per `runReport`" caught the other 2.)
- **`/admin/pricing` Stripe sync was not idempotent** → a price created in Stripe
  but not persisted (DB upsert fails after `prices.create`) would orphan, and the
  next run minted a duplicate. Sync now reuses an existing active price matched by
  `lookup_key` + amount before creating. Re-runs are now no-ops when Stripe is
  already correct.
- Tests: `ga4-timeout`, `feature-stripe-idempotency`.

---

## Verified clean (no change needed — evidence-based)

- **Two P0 launch gates** from the 2026-06-19 audit: marketplace PII (income/
  gender masked + `getMaskedLead`/`getFullLead` split) and the Cal webhook
  (now `[token]`-routed, format-validated, rate-limited). **Closed.**
- **P1s:** XSS JSON-LD (`serializeJsonLd` helper + test), insights property gate,
  onboarding `back`/`features` terminal guards, AppFolio recovery backfill +
  dedup + event-date KPIs, chatbot per-property listings — **all landed.**
- **Middleware / redirect loops (brief's #1 worry):** traced unauth→/sign-in,
  not-onboarded→/onboarding, done→portal — **no circular path.** RSC auth headers
  preserved (page routes use bare `NextResponse.next()`; only `/api` headers are
  sanitized). apex↔www handled at the Vercel platform layer, no in-app loop.
- **Admin create-client auth:** `requireAgency()` enforced on both page and
  server action; Zod-validated inputs; slug TOCTOU handled via DB unique +
  P2002 retry; sane initial state; no PII in audit diffs; clients list scoped
  to `orgType=CLIENT`. **Solid.**
- **Attribution tenant isolation:** every `lib/attribution/*` query scopes by
  `orgId`; property-restricted users gated via `effectivePropertyIds` with a
  `__no_property_access__` sentinel; no `$queryRaw`. **No cross-tenant leak.**

---

## Next Priority (recommended, NOT yet done — needs your call)

1. **Merge this branch** after review — the billing read-only enforcement is a
   real behavior change (paused orgs lose portal writes). It's correct and the
   restore path is wired, but it deserves your eyes before `main`. New clients
   onboarding this week won't be 14-days-overdue, so zero impact on them.
2. **`P2` create-client double-submit race** (`lib/actions/create-client.ts`):
   the duplicate-email guard is app-level only (no DB constraint), so two
   concurrent admin submits could create two orgs for one email. Low likelihood
   (internal tool). Fix = partial unique index on `(orgType, primaryContactEmail)`
   — deferred because a `prisma migrate deploy` overnight could fail on any
   existing duplicate rows; verify prod data first, then add. Cheap interim:
   disable the submit button while pending in `new-client-form.tsx`.
3. **`P2` paused-user error copy:** a paused org's blocked writes throw
   `TrialExpiredError` → likely shows "trial expired" copy, not "account paused."
   Consider a dedicated `PausedError` + a portal banner so paused users see *why*
   writes are blocked (today they'd hit silent-ish failures). UX polish.
4. **`P2` report hero scope** (`lib/reports/load-property-hero.ts`): left
   **intentionally unchanged.** The flagship-first order is a documented Norman
   (May 22) requirement; constraining it to the snapshot would re-introduce the
   image-less-placeholder bug he reported. Confirm desired behavior with product
   before touching.
5. **GA4 admin-API test-connection call** (`ga4.ts` ~line 130) also lacks a
   timeout — lower priority (connect flow, not the dashboard) but worth adding
   for symmetry.

## Blockers

- **None blocking the branch.** All changes are committed, typecheck clean,
  targeted tests green; full suite + `next build` verification in progress.
- The create-client unique-index fix is *gated on* confirming there are no
  existing duplicate `(orgType, primaryContactEmail)` rows in prod (can't verify
  prod data from here without DB access) — hence deferred, not done.
