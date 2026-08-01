# Autonomous Hardening Session — LeaseStack

Started: 2026-07-31 20:04 PDT
Branch: `autonomous-hardening-20260731`
Base: `b7d9d83f` (main)
Baseline: vitest 1421/1421 green · tsc clean · eslint 0 errors / 90 warnings

Ground rules: local commits only, no push/deploy/migrations applied, no
`.env*` edits, no destructive git ops, conservative choices logged inline.

Prior context read: `.claude/specs/2026-07-31-batchAB-review-findings.json`
(25 findings, all `isReal:true`) and
`.claude/specs/2026-07-31-wave2-leftovers-wave3-safe.md`. Spot-checked the
top HIGH items (chatbot snippet picker property scoping, `updateProperty`
IDOR) against actual current file content — **both already fixed** in
b7d9d83f. Not re-reporting anything from that file that checks out fixed.

Recon done via 4 parallel read-only sweeps (security, test-coverage, bug
hunt, code quality) against the actual current codebase, each spot-checking
findings before reporting so we don't re-litigate wave-2/3 fixes.

---

## Backlog

### 2c. Security hardening

- [ ] **S1 (HIGH).** Stored XSS: `ContentDraft.htmlBody` is persisted
      unsanitized via `PATCH app/api/portal/content/[id]/route.ts:116` and
      the chat-edit route, then rendered raw via `dangerouslySetInnerHTML`
      in two places — `app/preview/content/[id]/page.tsx:130` (public,
      unauthenticated preview link) and
      `app/admin/content-approvals/[id]/detail-client.tsx:157` (agency
      admin review session — higher-value target). Fix: sanitize at both
      render sites with an allowlist scoped to the tag set
      `lib/content/render-mdx.ts` already documents as supported (h1-h3, p,
      ul/ol/li, blockquote, strong/em, code/pre, a). DECISION: install
      `sanitize-html` (small, standard, audited HTML-parser-based
      sanitizer) rather than hand-roll a regex sanitizer — regex can't
      safely parse HTML and that's the classic XSS-filter-bypass mistake.
      Noting the new dependency per ground rules.
- [ ] **S2 (MEDIUM).** Raw error leaked to a money-path caller:
      `app/api/marketplace/leads/[id]/checkout/route.ts:196` returns
      `err.message` from a failed Stripe call straight to the buyer. Fix:
      generic user-facing message, log detail server-side.
- [ ] **S3 (LOW).** Raw error leaked: `app/api/audit/run/[id]/route.ts:144`
      returns caught error message verbatim in the 500 body. Fix: generic
      message + server-side log.
- [ ] **S4 (LOW, note only).** Two independent SSRF-guard implementations
      (`lib/utils/ssrf-protection.ts` vs `lib/security/ssrf-guard.ts`) —
      both actively used by different callers. A future SSRF fix to one
      won't propagate to the other. Consolidation is a real refactor
      touching multiple call sites — **flagged for Adam's review, not
      attempted tonight** (behavioral-redesign risk on a security-critical
      path is exactly what this session should NOT freelance).
- [ ] **S5 (LOW, note only).** Same duplication pattern:
      `lib/utils/timing-safe.ts` (`safeEqual`) vs `lib/auth/timing-safe.ts`
      (`timingSafeEqual`). Flagged for review, not touched (auth-adjacent).

### 2d. Bug hunting

- [ ] **B1 (MEDIUM).** N+1 query pattern in 4 cron routes — sibling
      `billing-reminders/route.ts` already fixed this exact anti-pattern
      with a batched `orgId: { in: orgIds }` lookup before its loop (per
      its own comments). Copy that pattern into:
      `app/api/cron/trial-reminders/route.ts:88`,
      `app/api/cron/onboarding-drip/route.ts:93`,
      `app/api/cron/monthly-report/route.ts:73`,
      `app/api/cron/weekly-report/route.ts:64`.
- [ ] **B2 (LOW).** Missing null guard:
      `lib/integrations/appfolio.ts:1963` — `properties[0].addressLine1`
      accessed unguarded when `findMany` can return `[]`; throws a raw
      TypeError that surfaces as the tenant-facing sync error message.

### 2b. Missing tests (mock-based, follow existing `__tests__/` conventions)

- [ ] **T1.** `app/api/tenant/billing/route.ts` — zero coverage, tenant
      billing/subscription route.
- [ ] **T2.** `app/api/marketplace/leads/[id]/checkout/route.ts` — zero
      coverage on the money path (also where S2 lives — pairs naturally).
- [ ] **T3.** `app/api/tenant/reputation-mentions/route.ts` +
      `[id]` + `backfill-sentiment` — zero coverage, property-scope-shaped
      surface (same bug class other tests guard elsewhere).
- [ ] **T4.** `app/api/public/leads/route.ts` — zero coverage on an
      unauthenticated, high-blast-radius endpoint (validation + rate
      limit).
- [ ] **T5.** `app/api/webhooks/resend/route.ts` — signature verification
      completely untested; stripe/clerk/cursive webhooks all have
      dedicated test files, resend is the outlier.
- [ ] **T6.** `lib/billing/gate.ts` — real gate logic never exercised
      (only ever mocked by consumers).
- [ ] **T7.** cron N+1 fix regression coverage — one runnable vitest check
      proving the batched lookup is used (pairs with B1).

### 2f. Code quality (small, safe wins)

- [x] **Q1 — reviewed, not a bug.** Inspected all 10 console.log sites
      flagged by recon. Every one follows the same intentional
      `[module-name]` operational/cost-telemetry convention used
      consistently across lib/intelligence/**, lib/seo/**, cron routes, and
      the Stripe webhook — one file's comment explicitly says "The console
      line stays so existing log tooling still works; the DB row backs
      /admin/costs rollups." This is the app's operability logging, not
      debug cruft. Gating it behind a flag would be an unrequested change
      to a working, documented convention and risks breaking whatever reads
      these lines today. Left untouched.

### Deliberately NOT attempted (queued / decision-blocked / out of scope)

- Wave 3 Phases 2, 3, 5, 7, 8 (schema-heavy / decision-blocked) — per
  wave2-3 handoff spec.
- Pixel precedence beyond conservative default, SEO history purge, GSC
  sub-properties, per-property site config, createProperty restriction —
  explicitly listed as decision-blocked in the session brief.
- S4/S5 SSRF + timing-safe duplication — real risk, real refactor, needs a
  human call on which implementation becomes canonical.
- Splitting the 10 largest files (`components/product-tour/index.tsx`
  3915 lines, `lib/reports/generate.ts` 3079, etc.) — over the repo's
  200-400 line convention, but a safe split of an 800-3900 line file
  touching production surfaces is a multi-hour structural change with real
  regression risk for a solo overnight pass. Logged for a dedicated
  daytime refactor session, not attempted here.
- Inconsistent `{ok:false,error}` vs `throw` vs `return null` convention
  across `lib/actions/**` — real but a documentation/convention decision,
  not a bug; noted for a style-guide addition, not changed blind.

---

## Execution log

(filled in as work completes)
