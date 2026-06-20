# LeaseStack — Autonomous All-Day Build Handoff (2026-06-20)

> Paste this whole file as the opening prompt of a FRESH Claude Code session
> (run `/compact` or start new first — the prior session is at ~440K context).
> Adam is moving apartments today and is AFK. You have the controls. Work
> through the ten phases below, autonomously, all day. Ship safely. Keep the
> live customer working. Make it production-ready, sharp, and cohesive.

---

## 0. WHO/WHAT/WHERE (read this first, then verify, don't trust blindly)

- **Project:** LeaseStack — multi-tenant leasing-intelligence SaaS for multifamily / student / senior / commercial operators. It *tracks* leasing performance (site + ads + chatbot + visitor pixel + reputation + AppFolio sync + weekly reports), it does not manage leases.
- **Repo:** `/Users/adamwolfe/realos` · **GitHub:** `adamwolfe2/realos` · **default branch:** `main`.
- **Production:** `main` auto-deploys to Vercel → **www.leasestack.co** (am-collective team). A push/merge to `main` is a LIVE customer deploy. Feature branches get Vercel **preview** deploys.
- **Stack:** Next.js 16 (App Router, RSC) · Prisma 7.4 / Neon Postgres · Clerk auth · Anthropic + AI SDK · DataForSEO · Tavily · Stripe · Resend · Upstash (rate limit) · pnpm · vitest. Run scripts with `pnpm exec tsx`. `rtk` wraps shell commands for token savings — use it (`rtk git`, `rtk vitest run`, `rtk next build`, `rtk next lint`).
- **The real customer:** **SG Real Estate** (org) — ~134 properties, real AppFolio integration, real prospects. There is also a **Telegraph Commons** demo/flagship org with seed data. NEVER break SG. You may READ prod data to verify (Neon via `@neondatabase/serverless` + `.env.production.local` → use `DATABASE_URL_UNPOOLED`); write to prod only through the app's own code paths, never ad-hoc destructive SQL.
- **Hard conventions (cross-project, non-negotiable):** NO EMOJIS anywhere (use `lucide-react` icons). NO DARK THEME (light only). Immutable data patterns (never mutate inputs). Many small files > few large. Stage files explicitly, never `git add -A`. No `Co-Authored-By` lines in commits. Never commit `.env*` or secrets. Never use `--no-verify` or force-push `main`.

### What already shipped (live on main, verified) — do NOT redo
1. **Application ingestion fixed** — AppFolio `rental_applications` v2 mapper was silently dropping 100% of rows; now SG has **288 real applications** flowing, full status funnel, linked to leads.
2. **Chatbot insights** page — `/portal/conversations/insights` (top questions, keywords, capture-rate trend).
3. **Portfolio funnel** report — `/portal/reports/portfolio` (Traffic → Leads → Tours → Applications, per-property table).
4. **AppFolio sync hardening** (PR #142) — phase recovery backfill (leads/showings/work-orders), duplicate-lead dedup, event-date KPIs.

### Your North Star inputs (READ THESE before planning each phase)
- `docs/audits/2026-06-19-launch-readiness-report.md` — the 15 confirmed launch findings (2 P0, 9 P1, 4 P2), each with file:line + a fix. **This is your backlog spine.**
- `~/.claude/research-queue.md` — same findings queued.
- Existing design system to MATCH (read, then conform — do not invent new tokens):
  `app/globals.css` (the `ls-card`, `ls-card-accent`, `ls-metric`, `ls-metric-lg`, `ls-eyebrow`, `ls-delta`, `ls-select` utility classes + CSS vars like `--primary`, `--terracotta`),
  `components/portal/ui/chart-theme.ts` (CHART_COLORS — brand blue `#2563EB`, success/warn/danger, mono numerics),
  `components/portal/dashboard/kpi-tile.tsx` (the canonical metric tile: mono figures, SVG sparkline/bars/gauge, brand-glow accent variant),
  `components/admin/page-header.tsx` (eyebrow/title/description/actions),
  `components/portal/ui/empty-state.tsx` (icon/title/body/action),
  and if present `DESIGN.md` / `PRODUCT.md`. If `DESIGN.md` is missing, derive the system from the above and write one as part of Phase 7.

---

## 1. OPERATING CONTRACT (how you work today)

You are in **autopilot**. For each phase: orient → plan → execute → verify → ship → log → next. No waiting for Adam. But hold these guardrails like law:

**Safety / Tier-1.** Any surface touching money, auth, RLS/tenant-isolation, webhooks, state transitions, or destructive actions MUST use the `safe-feature-slice` skill and get a parallel review (`code-reviewer` + `security-reviewer` + Codex via `codex exec --sandbox read-only`) before `/cap`. The 2 P0s are exactly this tier.

**Verification is the target, not a report about red.** Every phase ends green: `rtk next lint`, `rtk tsc` (clean), `rtk vitest run` (all pass — currently ~970 tests, never weaken them), `rtk next build` (0 errors). Then verify behavior against **real prod data, read-only** where relevant (e.g. confirm a query returns sane numbers for SG before claiming done). Throwaway verification scripts go in `scripts/_*.ts` and are DELETED before commit.

**Shipping.** Branch from `origin/main` per phase (`feat/...` or `fix/...`). Run the full gate, push, open a PR, then — because Adam explicitly authorized full autonomy today — **merge to `main` and watch the production deploy go green** (poll `gh api repos/adamwolfe2/realos/commits/<sha>/status` until `success`). EXCEPTION: the 2 P0 security fixes and anything that could expose/lose customer data — ship those too, but only after a clean parallel review AND a read-only prod sanity check; if a review surfaces an unresolved HIGH/CRITICAL, stop at a draft PR and move on, leaving a clear note. Never auto-merge a red build.

**Tokens.** It's an all-day run — protect context. Use **background Workflows / subagents** (fresh contexts) for fan-out: audits, multi-file reviews, parallel implementation of independent slices. Keep a running progress log at `docs/handoff/PROGRESS-2026-06-20.md` (append one tight block per phase: what changed, files, verification, PR/commit, deploy status). `/compact` at each phase boundary. Don't re-read large files you already understand; grep then read ranges.

**Flywheel.** After each bug fixed: `log-mistake` (append to `~/.claude/mistakes.jsonl`) + add a regression test. If you find new issues, append to `~/.claude/research-queue.md`.

**Design cohesion is a first-class requirement, not a coda.** Every new/edited surface must reuse the existing tokens and components above. No new colors, fonts, shadows, radii, or one-off spacing. No emojis. Light theme. Per-property scoping + tenant isolation (`requireScope`, `tenantWhere`, `propertyWhereFragment`, module gates) on EVERY data surface — copy the pattern from `app/portal/conversations/insights/page.tsx` and `app/portal/reports/portfolio/page.tsx` (both shipped clean this way).

**Hard stops (surface in the progress log and move on, don't force):** a migration that isn't provably zero-downtime; a fix that would weaken/delete a test; a secret about to be committed; a change that can't be verified safe against the live customer; a review that flags an unresolved CRITICAL on a Tier-1 surface.

---

## 2. THE TEN PHASES (in priority order — launch-blocking first, polish last)

Work them in order; within a phase, slice small and ship incrementally. Each phase header notes its tier and the skills/agents to use.

### PHASE 1 — Close the 2 P0 launch blockers *(Tier-1; safe-feature-slice + security-reviewer + Codex)*
Nothing else matters if these are open — they leak paid/PII data to the public internet.
- **P0-1 Marketplace PII leak:** `/marketplace/<id>` renders a lead's real income/gender/age to unauthenticated visitors. `app/marketplace/[id]/page.tsx:261-278` (both ternary branches return the real value), unconditional `getFullLead` at `:22`, raw fields `lib/marketplace/repo.ts:186-197`. Fix: mask the `!owned` branch exactly like email/phone already are; better, gate the full-PII fetch behind `getBuyerPurchaseForLead` so un-purchased PII never reaches render. Add a test: anonymous + non-buyer sees masked; buyer sees full.
- **P0-2 Cal.com webhook cross-tenant injection:** `app/api/webhooks/cal/[orgId]/route.ts` trusts `orgId` (URL) as a secret, but `orgId` is leaked by the unauthenticated CORS-`*` `app/api/public/chatbot/config/route.ts:239`. Fix: mint a per-org unguessable `webhookToken` (hashed, format-validated) and route `/api/webhooks/cal/[token]` — mirror the existing `cursive/[token]` pattern; stop returning `org.id` at config:239 (consumers resolve it server-side from slug); ideally add Cal HMAC verification. This needs a small migration (add `calWebhookToken` to the integration/org) — make it additive + backfill, keep the old route working during transition or migrate the one live tenant deliberately. Verify SG's Cal integration still books after.
Ship each as its own reviewed PR.

### PHASE 2 — High-risk P1 trust-breakers *(Tier-1 for the leaks; safe-feature-slice)*
- **Stored XSS (borderline P0):** `app/(tenant)/tenant-site/n/[slug]/page.tsx:149` and `lib/content/render-mdx.ts:302-304` inject operator/AI content into JSON-LD unescaped. Add a shared `serializeJsonLd()` that escapes `<`, `>`, `&` and route all JSON-LD through it. Grep the whole repo for other raw `JSON.stringify` into `<script type="application/ld+json">` and fix all.
- **Insights cross-property leak:** `app/portal/insights/page.tsx:63-114` — `getOpenInsights` falls to the org-wide branch for property-restricted users with ≥2 properties. Pass `effectiveIds` through (the sibling `getInsightCounts` already does). Audit ALL insights/queries for the same "single-property only" gate bug.
- **Onboarding regressions:** `app/api/onboarding/wizard/back/route.ts:47-60` (add `NOT:{onboardingStep:'done'}` atomic guard; fix `previousStep('done')` to no-op; the steps array is now 4 items and doc comments are stale) and `app/api/onboarding/wizard/features/route.ts:63-71` (gate the entitlement write on `subscriptionStatus notIn [ACTIVE, PAST_DUE]` like `start-trial`/`properties` already do). Add replay/stale-tab regression tests.

### PHASE 3 — Onboarding & signup journey: correctness + polish *(Tier-1)*
Make a brand-new customer's first 10 minutes bulletproof and sharp. Audit + harden the whole flow: `/sign-up` → provisioning → à-la-carte cart → property step → plan/trial activation → first-value. Verify status guards (no ACTIVE→TRIALING regressions), plan-intent passthrough from `/pricing` (cookie before Clerk redirect), scaffold durability/retry (don't swallow failures then mark done), name-based property idempotency (stable client ids). Then a craft pass with `impeccable`: progress clarity, empty/loading states, error copy, the "aha" moment. Read `lib/onboarding/*`, `components/onboarding/*`, `app/api/onboarding/wizard/*`.

### PHASE 4 — Stripe billing end-to-end + entitlements *(Tier-1; security-reviewer + Codex)*
Audit and harden the money path so it's launch-safe: checkout (à-la-carte per-feature pricing + base), trial→paid conversion, the Stripe webhook (`handleSubscriptionUpserted`, cancel revokes ALL paid modules, no swallowed errors → let Stripe retry), entitlement gates (`requireWritableWorkspace` on every mutation; expired-trial can't mutate), double-charge / orphaned-payment guards, idempotency keys, price-edit → sub remap (FeaturePriceHistory), stale-price quote-vs-charge guard. Confirm the `/admin/pricing` → "Sync to Stripe" → live-price path. Add tests for: cancel revokes modules, expired trial blocked, no double-charge on concurrent conversion. Verify against Stripe test mode; do not touch live Stripe objects without certainty.

### PHASE 5 — AppFolio integration completeness & reliability *(Tier-1 data)*
Build on today's fixes. Per-phase watermarks (so no phase starves another — generalize the recovery-backfill already added), multi-property attribution correctness across ALL phases (the embed `properties[0]` class of bug), the `guest_cards`/`showings` 404 reality for plans without the CRM module (surface clearly in the connect UI; don't silently show zero), encrypted-cred handling, partial-sync status truthfulness (amber vs red). Make the connect/setup surface honest about what each plan supports. Verify SG's sync stats read true. Read `lib/integrations/appfolio*.ts`, `app/api/cron/appfolio-sync`, `lib/integrations/appfolio-status.ts`.

### PHASE 6 — Application tracking: the dedicated dashboard surface *(Tier-1 read)*
Applications now flow but only show as lead-timeline events + an occupancy count. Build the browsable surface promised: a per-property **Applications** view (list + status filter submitted/under-review/approved/denied/withdrawn, applicant, unit, applied/decided dates, screening), property-scoped via the switcher, with the funnel context (applied→approved→signed). Add it as a tab under `app/portal/properties/[id]` AND/OR a top-level `/portal/applications` cross-property list. Reuse `KpiTile` + table patterns from the portfolio funnel. Verify it renders SG's 288 apps correctly. Consider co-applicant grouping via `applicationGroupId`.

### PHASE 7 — Design system audit & cohesion pass *(use `impeccable`)*
This is the "looking sharp / everything cohesive" mandate. Audit EVERY portal surface for consistency: spacing scale, typography, color usage (only chart-theme + CSS vars), card/border/radius/shadow tokens, button/badge/pill styles, table styles, empty states, loading skeletons (every route needs `loading.tsx`), responsive behavior (mobile), focus/hover/a11y. Produce/refresh `DESIGN.md` documenting the canonical tokens + components. Then systematically bring outliers into line — consolidate one-off styles into shared components/utilities. No visual regressions to the surfaces shipped this week. Use a Workflow to fan out the audit across route groups, then fix in batches. Run `design-qa` (visual + axe + Lighthouse) on key routes if available.

### PHASE 8 — Chatbot quality, isolation & analytics depth
- Fix the **multi-property greeting bug**: greeting pools `{starting_rent}/{open_count}/{next_available}` across the whole portfolio — scope to the property the prospect is actually on. (`lib/chatbot/*`, `resolve-config`, `build-system-prompt`, `property-attribution`.)
- Tighten per-property config + chat-capture lookup org scoping; ambiguous-property fallback safety; prompt-injection / system-prompt-leak hardening; don't hallucinate unit data.
- Deepen the insights I shipped: add an optional **AI topic/intent classification** layer on `lib/chatbot/conversation-analytics.ts` (Claude Haiku, batched, cheap, cached/stored) so "common questions" become real topics (pricing / availability / pet policy / tour / application) with capture-rate-by-topic. Keep the heuristic as fallback.

### PHASE 9 — Reports, sharing & portfolio analytics depth *(Tier-1 for share tokens)*
- Audit public **share tokens** (`app/r/*`, proposal/report share routes): guessability, expiry, strict tenant scoping, no over-exposure beyond the shared period. (Reports-sharing surface had findings — confirm them.)
- Elevate the client report + the portfolio funnel: trend charts (recharts via chart-theme), period-over-period deltas, tour data graceful when sparse, print/PDF polish, "as of" freshness. Make the manager one-pager genuinely shareable and beautiful.
- Ensure the new portfolio-funnel + insights pages stay tenant/property-scoped (they are — keep them that way as you extend).

### PHASE 10 — Performance, observability & production readiness
Run the performance-audit master prompt (in Adam's `~/.claude/rules/performance-audit.md`): edge runtime for simple routes, N+1 → batched queries, `select()` explicit columns, streaming + `loading.tsx` everywhere, `<Suspense>` around `useSearchParams`, lazy-load heavy components, image/font optimization, list virtualization, caching (staleTime, ISR, Cache-Control), preconnect/preload. Then: error boundaries on every route group, Sentry coverage, structured logging, rate-limit coverage on all public/ingest endpoints (Upstash), body caps, SSRF guards on URL-fetching (AppFolio embed/AEO/firecrawl), zod validation at every external boundary. Finally, generate/expand **Playwright E2E** (`/e2e`) for the launch-critical journeys: signup→onboarding→trial, lead capture, application appears on dashboard, billing checkout, report share. Green E2E = production-ready.

---

## 3. CROSS-CUTTING (apply within every phase, not as a separate phase)
- **Empty + loading + error states** for every new surface (skeletons, friendly empties, no flashes of nothing).
- **Mobile responsive** — these are operator dashboards; check at sm/md.
- **Accessibility** — labels, focus rings, contrast, semantic tables, aria for charts.
- **UX copy** — clear, no jargon, manager-readable; no placeholder/tenant-specific hardcoded strings (audit for "Telegraph Commons"/"Norman"/"SG Real Estate" leaking into generic copy).
- **Tenant isolation on every query** — `requireScope` + `tenantWhere` + `propertyWhereFragment` + module gate. Add a test asserting cross-org access is denied for each new route/action (there's an `admin-route-auth-coverage` / `api-mutation-auth` test pattern — extend it).
- **Idempotency + immutability** — no input mutation; race-safe upserts; no swallowed `catch {}`.

---

## 4. SUGGESTED DAILY RHYTHM (so you stay productive + safe all day)
1. `/compact`, then read `docs/audits/2026-06-19-launch-readiness-report.md` + `docs/handoff/PROGRESS-2026-06-20.md` (create it) for state.
2. Pick the current phase. If Tier-1 → `safe-feature-slice`. Plan in 3-7 bullets, write a slice spec to `.claude/specs/`.
3. Implement smallest shippable slice. TDD where it fits. Reuse design tokens/components.
4. Verify: lint/types/tests/build green + read-only prod sanity check.
5. Parallel review (Claude reviewers + Codex read-only) on non-trivial/Tier-1 diffs. Resolve CRITICAL/HIGH.
6. `/cap` → push → PR → merge to `main` → watch prod deploy green. (Hold P0/data-risk at draft PR if any review is unresolved.)
7. `log-mistake` + regression test if you fixed a bug. Append a block to `PROGRESS-2026-06-20.md`.
8. `/compact`, next slice/phase. Use background Workflows to parallelize independent audits/reviews and keep context cold.
9. If blocked by something genuinely Adam-only (a billing/registrar/secret decision, a destructive migration, a product judgment call), note it clearly in the progress log and SKIP forward — don't stall the day.

## 5. END-OF-DAY DELIVERABLE
A `docs/handoff/PROGRESS-2026-06-20.md` Adam can read in 3 minutes: phases completed, PRs merged + live, anything left at draft PR (with why), new findings queued, and the single most important thing to do next. Plus: the 2 P0s closed (or a crisp reason if one was held), the design `DESIGN.md` written, and the live customer (SG) still fully working — verify at the end that SG's applications, leads, chatbot, and reports all still render with real data.

Don't break the live customer. Ship sharp, cohesive, working software. Go.
