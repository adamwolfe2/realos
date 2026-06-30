# LeaseStack Enterprise Cleanup — Plan & Backlog

**Run:** 2026-06-30 (overnight, autonomous) · **Branch:** `cleanup/enterprise-polish-2026-06-30` (off `main`)
**Goal:** Reduce surface bloat — fewer buttons/modals/pages/loose ends — so the platform
feels Salesforce/Stripe-grade (does a lot, looks calm). Everything ships to a branch for
human merge; nothing deploys automatically.

> Independent re-verification matters: the dead-code agent's HIGH list had 3 false positives
> (`components/ui/stat.tsx` had 7 importers, `onboarding/plan-step.tsx` 1, `domain-attach` only
> comment-refs). Every deletion below was re-grepped for zero real importers and gated on `tsc`.

---

## Phase 1 — Dead-code removal ✅ (this branch)

**23 files, ~2,500 LOC, zero real importers, `tsc` + full suite green.** Verified individually.

Libs: `lib/build/provision-tenant.ts`, `lib/build/domain-attach.ts` (both superseded by
`lib/integrations/vercel-domains.ts`), `lib/chart-palette.ts` (dup of `lib/charts/palette.ts`),
`lib/email/index.ts` (unused barrel), `lib/observability/sink-error.ts`, `lib/seo/property-activity.ts`,
`lib/zillow/scrape.ts`.

Components: duplicate `app/portal/seo/seo-trend-chart.tsx` (live one is `components/platform/artifacts/`),
dead homepage sections (`components/home/{live-example,platform-walkthrough,sanity-check-section,verticals}.tsx`
+ `components/platform/sticky-artifact-section.tsx`), dead UI (`components/portal/ui/{data-card,toolbar}.tsx`),
orphan onboarding steps (`components/onboarding/{integrations-step,property-step}.tsx`),
orphan platform/admin/audit bits (`components/platform/rotating-word.tsx`,
`components/platform/artifacts/pacing-alert.tsx`, `components/admin/content-quota-override.tsx`,
`components/audit/{audit-form,email-gate}.tsx`, `app/portal/seo/recommendations/reopen-form.tsx`).

**KEPT (false positives / load-bearing):** `components/ui/stat.tsx`, `components/onboarding/plan-step.tsx`,
`public/embed/{chatbot,popup}.js` (live client widgets), `components/product-tour/index.tsx` +
`app/(platform)/demo/*` (live marketing, linked from sitemap).

### Deferred dead-code (needs a separate, gated pass — NOT before client onboarding)
- `components/properties/property-form-dialog.tsx` + `components/ui/upload/image-uploader.tsx` — import
  commented out "see issue #69"; confirm the issue is dead first.
- `components/home/weekly.tsx` (~344 ln) — re-grep exact `import { Weekly }` before removing.
- `scripts/**` (~19k LOC, 124 one-off ops/backfill files) — archive to `scripts/_archive/`, don't hard-delete
  (operational history). Only `heal-site-engine-migration.mjs` + `sync-site-engine-data.mjs` are build-wired.
- ~280 in-file unused named exports (ts-prune/knip) — export-surface trim, risky individually on a live
  product; do as one test-gated pass later.

---

## Phase 2 — IA consolidation (target state)

The felt clutter is the **portal nav: ~30 visible items across 4 groups** (Marketing has 14, Account 7).
Target: **~7 calm top-level items, depth via in-page tabs** (Stripe/Salesforce pattern). Reuse the existing
`PropertyTabs` component (`app/portal/properties/[id]/page.tsx`) as the canonical tab pattern. Every
consolidation **adds redirects** from old routes → new `?tab=` URLs so no deep link / email link breaks.

Target nav: **Dashboard · Properties · Pipeline · Residents · Marketing · Analytics · Account**
- Pipeline = Leads/Visitors/Tours/Applications/Conversations
- Residents = Residents/Renewals/Work-orders (AppFolio-gated)
- Marketing = Campaigns·Ads / Content (+Creative) / SEO / Reputation / Conversion (chatbot·popups·referrals) / Site
- Analytics = Attribution / Reverse-Attribution / Reports / Insights  ← collapses the 3× attribution overlap
- Account = Settings / Integrations / Billing / Marketplace / Vault / Evaluator (1 item, tabbed) ← collapses 7

### Execution slices (high-value / low-risk first)
| # | Slice | Type | Risk |
|---|---|---|---|
| S4 | Split `properties/[id]/tabs/overview.tsx` (1894 ln) → `components/portal/properties/overview/*` (mechanical, no behavior change) | PURE-IA | LOW |
| S1 | Collapse Marketing(14)→Marketing+Analytics in `components/portal/portal-nav.tsx` (preserve `show:`/`badge:` predicates verbatim) | PURE-IA | LOW |
| S2 | Tabbed Analytics hub (attribution/reverse/reports/insights as tabs; old routes → redirects) | PURE-IA | LOW |
| S3 | Collapse Account(7)→1 tabbed item | PURE-IA | LOW |
| S5 | Trim dashboard `app/portal/page.tsx` to 4 KPIs + 1 hero chart + insights; demote rest below fold | PURE-IA | MED (screenshot before/after) |
| S6 | Overview → 4 cards; move Integrations/Renewal/Meta to their tabs; QuickActions → overflow menu | PURE-IA | MED |
| S7 | Split Pipeline → Pipeline + Residents nav groups | PURE-IA | LOW |
| S8 | `/portal/seo` landing → tabbed hub (8 sub-pages as tabs) | PURE-IA | LOW |
| S9 | Merge Content + Creative | PURE-IA | LOW |
| S10–S12 | Retire `site-builder` orphan; merge reports/portfolio+settings; unify 3 integration doors | **RISKY — propose-only** (route removal / OAuth callbacks) — needs Adam's sign-off + redirect-map review | HIGH |

**Overnight order:** S4 → S1 → S2 → S3, screenshot-verifying S5/S6. Stop before S10–S12 (route/OAuth removals).
