# LeaseStack — Overnight Autonomous Quality Run (2026-06-30)

Worked unattended through the night under a standing mandate: find/fix bugs + clean up the
platform, branch-only, never deploy/merge. Every change verified (tsc + tests); every agent
finding adversarially re-verified before acting (this caught ~12 false positives — see below).

**Nothing was deployed or merged.** Review each branch and merge what you want.

---

## TL;DR — what to do this morning

1. **Merge the safe wins** (in this order): `cleanup/enterprise-polish` → `harden/launch-readiness`
   → `overnight-quality`. All are isolated, tsc + full-suite green, atomic commits.
2. **Decide on the propose-only items** below (ranked) — they need your judgment, I didn't ship them.
3. **The nav consolidation** (your "feel like Stripe" ask) is a finished spec ready to execute with you:
   `docs/audits/2026-06-30-enterprise-cleanup-plan.md`. I deliberately didn't ship it blind — it's a
   visual/taste call.

---

## Branches & commits (8 commits, all green)

### `cleanup/enterprise-polish-2026-06-30` — declutter
- `ea957172` remove **23 dead files (−4,861 LOC)** — orphan libs, dup components, dead homepage
  sections. Each re-verified for zero importers (caught 3 the analysis wrongly called dead, e.g.
  `ui/stat` had 7 importers).
- `b271d2bb` split the **1894-line property overview tab → 12 modules** (650-line parent +
  co-located cards/types/helpers). Pure mechanical, zero behavior change.

### `harden/launch-readiness-2026-06-30` — earlier hardening (from the launch-readiness audit)
- `adf99ee5` enforce paused dunning + reverse it on payment; stop wrong-building tour attribution.
- `d1b019df` timeout every GA4 runReport; make Stripe price sync idempotent.
- `253962fc` progress report.
(Context: the 2026-06-19 launch audit's two P0s — marketplace PII, Cal webhook — were already fixed;
12 of 15 findings already remediated. These commits close the rest.)

### `overnight-quality-2026-06-30` — bug hunt
- `ca709b48` **phase5**: signals-daily now uses constant-time `verifyCronAuth` (was raw `!==`);
  marketplace Stripe webhook got the rate-limit + 3MB body cap the main webhook already had.
- `7529f872` **phase6**: added timeouts to **18 external `fetch()` calls** (google-ads, meta-ads,
  twilio, slack, vercel-domains, oauth, al-segments, places, ad-library, perplexity) — same
  hung-upstream bug class as the GA4 fix. Regression test asserts every external fetch has a timeout.

---

## What I verified CLEAN (the value of NOT changing things)

- **P3 multi-tenant isolation** — 3 auditors raised **8 "P0 IDOR"** findings; ALL false positives.
  Routes use the correct `findFirst({id,...tenantWhere}) → 404 → update by PK` pattern. The agents'
  suggested fix (`orgId: scope.orgId` on admin mutations) would have **broken production** (admin
  scope.orgId = agency org, not the client's). **0 real bugs — isolation is well-built.**
- **P5 review-requests** "double-send" — false positive; its query already filters
  `reviewRequestSentAt: null`.
- 6 webhooks + ~30 crons, 41 server actions, attribution tenant-scoping, middleware/redirects,
  admin create-client auth — all audited, found solid.

> The load-bearing discipline all night: **agent findings are leads, not licenses.** ~12 confident
> "P0/P1" claims were false on inspection; trusting them blind would have caused outages.

---

## PROPOSE-ONLY — needs your decision (ranked by impact)

1. **[Billing] `lib/proposals/customer-lookup.ts:50,70`** — DB lookup errors are swallowed
   (`.catch(()=>null)`) and masquerade as "no row," so the code creates a **duplicate Stripe
   customer** (the exact thing the function exists to prevent; author left a `// TODO: don't swallow
   errors`). Fix = log+capture+fallthrough like the sibling Stripe-search branch already does. Small,
   high value. *Didn't auto-ship: Tier-1 billing flow change.*
2. **[Cleanup] Nav IA consolidation** — collapse the ~30-item / 4-group portal nav to **7 calm
   top-level items** with in-page tabs (Dashboard·Properties·Pipeline·Residents·Marketing·Analytics·
   Account). Full execution spec + old→new mapping + redirect guardrails in
   `docs/audits/2026-06-30-enterprise-cleanup-plan.md`. *This is your main "feel like Stripe" ask —
   left for you because it's a visual/taste call best done with eyes on it.*
3. **[Reliability] Unbounded crons** — `trial-reminders`, `onboarding-drip`, `appfolio-sync` fetch
   org sets with no `.take()`. Fine now; at 500+ clients could hit the 300s cron limit. Needs
   *ordered + dedup-aware* pagination (a naive `.take(N)` would reprocess the same N and starve the
   tail, since they dedup in-loop via AuditEvent). *Not a safe one-liner.*
4. **[Correctness] Silent state-write swallows** — `appfolio-sync` status updates (4×),
   `onboarding/scaffold` config upserts (4×) swallow DB failures → stale UI / silently-disabled
   features. Safe first step: add `console.error` (observability) without changing flow; rethrow only
   per-site after you decide.
5. **[Billing, low] billing-reminders** pause isn't atomic — fold an `updateMany({where:{id,
   status:{notIn:[PAUSED,CANCELED,CHURNED]}}})` guard when merging `harden/launch-readiness` (which
   already touches this path).
6. **[Cleanup, low] Deferred dead code** — `scripts/**` (~19k LOC of one-off ops files) → archive to
   `scripts/_archive/`; `weekly.tsx` + `property-form-dialog` (confirm issue #69 dead first); ~280
   in-file unused exports (one test-gated pass). Details in the cleanup-plan doc.
7. **[Multi-agency future, not a bug]** Admin mutations on client records are role-gated only — fine
   for single-operator; add ownership checks IF you ever go multi-agency (do NOT add `orgId:
   scope.orgId` — would break it today).
8. **[UX, low]** weekly-report auto-send silently no-ops when recipients empty — add a config guard.

---

## Phases run: P1 dead-code ✅ · P2 file-split ✅ (nav=spec) · P3 isolation ✅ clean · P5 webhooks/crons ✅
· P6 integrations ✅ · P11 error-handling → propose-only. Phases P4/P7-P10/P12-P14 not reached —
stopped here deliberately to avoid grinding a ballooning single-session context (token stewardship).
Full running log: `~/.claude/leasestack-overnight-plan.md`.

**Net delivered:** 8 verified commits across 3 branches; ~4.9k LOC dead code removed; a 1894-line file
modularized; real fixes to GA4/Stripe/dunning, cron auth, webhook DoS, and 18 integration timeouts;
8 ranked decisions teed up for you. Zero deploys, zero merges, zero broken tests.
