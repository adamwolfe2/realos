# LeaseStack Launch-Readiness Audit

**Run:** 2026-06-19 (autonomous, while Adam was AFK) · **Method:** 10 critical user workflows audited by parallel read-only agents, every finding adversarially verified, only confirmed issues kept.

**Result:** 28 agents · 17 findings · **15 confirmed · 2 refuted**.

> Read-only audit. No code was changed. Fixes below are proposals for review.

---

# LeaseStack Launch-Readiness Report
*Prepared for Adam · 2026-06-19 · based on adversarially-verified findings (all confirmed real, high confidence)*

---

## 1. Verdict

**Do NOT launch to paying clients yet.** Two confirmed P0 data-exposure holes ship paid/PII data to the public internet. The single biggest blocker: **`/marketplace/<id>` leaks each lead's income, gender, and age to unauthenticated visitors** — the paywall the product monetizes is wide open.

---

## 2. P0 Launch Blockers (must fix before any client)

### P0-1 · Lead PII leaked to non-buyers + unauthenticated visitors
- **Workflow:** Marketplace lead detail page
- **Customer hits:** Anyone opens `/marketplace/<id>` and reads the lead's real **income range, gender, age** — the exact enrichment PII the product only releases on payment. Competitors scrape monetized intel for free; buyers' purchased data leaks to everyone.
- **File:** `app/marketplace/[id]/page.tsx:261-278` (+ unconditional `getFullLead` at `:22`, raw fields from `lib/marketplace/repo.ts:186-197`)
- **Fix:** Both ternary branches return the real value — mask the `!owned` branch like email/phone already do. Better: gate the full-PII fetch behind `getBuyerPurchaseForLead` so un-purchased PII never reaches the render layer.

### P0-2 · Cross-tenant lead/tour injection via Cal.com webhook
- **Workflow:** Cal.com booking → lead capture
- **Customer hits:** The webhook's only "auth" is `orgId` in the URL — treated as an unguessable secret. But `orgId` is **publicly leaked** by the unauthenticated, CORS-`*` chatbot config endpoint. Any attacker reads a tenant's slug → gets `orgId` → forges fake `BOOKING_CREATED` events into ANY tenant's pipeline: fake Leads (`TOUR_SCHEDULED`), Tours on their default property, and operator notification emails burned through our shared Resend domain.
- **File:** `app/api/webhooks/cal/[orgId]/route.ts:25-31, 84-150` vs leak at `app/api/public/chatbot/config/route.ts:239`
- **Fix:** Stop using `orgId` as the secret. Mint a per-org unguessable `webhookToken` (hashed, format-validated) and route to `/api/webhooks/cal/[token]` — mirror the existing `cursive/[token]` pattern. At minimum, stop returning `org.id` at config `:239` (every consumer resolves it server-side from slug anyway). Ideally also add Cal's HMAC verification.

---

## 3. P1 Serious (fix immediately after — several are trust-killers)

### P1-1 · Stored XSS on public neighborhood pages
- **Workflow:** Tenant public marketing site (`/n/[slug]`)
- **Hits:** A `</script>` payload in any title/intro/FAQ field (operator- or AI-authored) breaks out of JSON-LD and runs arbitrary JS in every visitor's browser — hijacks the on-page Apply/Contact forms, steals renter PII, redirects to phishing.
- **File:** `app/(tenant)/tenant-site/n/[slug]/page.tsx:149` (same bug at `lib/content/render-mdx.ts:302-304`)
- **Fix:** Escape before injecting: `.replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')` via a shared `serializeJsonLd()`. (Borderline P0 — exploitable by any operator/AI content; only spared P0 because the attacker is the tenant or their content, not the open internet.)

### P1-2 · Insights page leaks other properties' data to property-restricted users
- **Workflow:** Portal → Insights/Recommendations drawer
- **Hits:** A regional manager granted 2+ of an org's 10 buildings sees AI recommendation cards (names, titles, bodies) for buildings they're NOT authorized to view. Per-user property gate bypassed for any restricted user with ≥2 properties.
- **File:** `app/portal/insights/page.tsx:63-114` — `singlePropertyId` only set when exactly 1 property; `getOpenInsights` falls to the no-filter org-wide branch (`lib/insights/queries.ts:63-66`).
- **Fix:** Pass `effectiveIds` to `getOpenInsights` (it already exists — sibling `getInsightCounts` uses it). Restricted users must never reach the unfiltered branch.

### P1-3 · Onboarding "back" route regresses a completed workspace
- **Workflow:** Onboarding wizard
- **Hits:** A stale wizard tab or replayed POST rewrites a *done* (trialing) customer's `onboardingStep` from `done` → `properties`, trapping a paying customer back inside the signup wizard on every page load.
- **File:** `app/api/onboarding/wizard/back/route.ts:47-60` — unconditional update, missing the `NOT:{onboardingStep:'done'}` guard its three sibling routes all have.
- **Fix:** `updateMany` with `NOT:{onboardingStep:'done'}`; fix `previousStep('done')` to no-op (steps.ts array is now 4 items, doc comments are stale).

### P1-4 · Onboarding "features" route can downgrade a paid workspace
- **Workflow:** Onboarding wizard
- **Hits:** Replayed/stale `features` POST rewrites tier + all `module*` entitlement flags unconditionally — turns OFF every module not in the payload, silently dark-firing paid features.
- **File:** `app/api/onboarding/wizard/features/route.ts:63-71` — entitlement write has no status guard (only the separate step-advance is guarded).
- **Fix:** Mirror `start-trial`/`properties`: wrap entitlement write in `updateMany` gated on `subscriptionStatus notIn [ACTIVE, PAST_DUE]`, or short-circuit when `onboardingStep==='done'`.

### P1-5 · AppFolio leads phase silently loses leads after any failure gap
- **Workflow:** AppFolio sync → leads (core funnel data)
- **Hits:** If the `guest_cards` phase fails/auto-skips while other phases succeed, `lastSyncAt` advances past the gap and **every lead in that window is permanently lost** — no error shown. Dashboard under-reports pipeline.
- **File:** `lib/integrations/appfolio-sync.ts:191-194, 646-665, 1146`
- **Fix:** Mirror the existing applications-recovery pattern: `leadsRecovering = options.retrySkipped || !!phaseFailures.leads` → widen `fromDate` to a recovery backfill window.

### P1-6 · Work-orders + showings phases share the same watermark data-loss gap
- **Workflow:** AppFolio sync → work orders / showings
- **Hits:** Same mechanism as P1-5 — maintenance tickets and tour records during a phase outage silently never appear.
- **File:** `lib/integrations/appfolio-sync.ts:680, 1028`
- **Fix:** Apply `<phase>Recovering` + widened backfill to both phases (fix alongside P1-5 as one patch).

### P1-7 · Duplicate Lead rows — applicant counted twice
- **Workflow:** AppFolio sync → application tracking
- **Hits:** A prospect who applies (when guest_card is skipped/late) then later gets a guest_card becomes **two Lead rows** — inflated pipeline counts, history split across records. Trust-eroding for clients (e.g. Norman) who reconcile against AppFolio.
- **File:** `lib/integrations/appfolio-sync.ts:1441-1472, 1202-1256, 1429-1436` — no email-based reconciliation when a guest_card lands for an existing `application:<id>` lead.
- **Fix:** In `upsertAppfolioLead`, before create, match an existing `application:`-keyed lead by `(orgId, propertyId, email ci)` and adopt it. Add a regression test for skipped-then-recovered guest_cards.

### P1-8 · 28-day KPIs count by ingest time — backfills dump months into "last 28 days"
- **Workflow:** Property dashboard KPIs (first sync + after recovery)
- **Hits:** New customer's **first sync** shows wildly inflated 28-day leads/apps/tours (180-day recovery worst case); prev-28d comparison + sparkline meaningless. Wrong first impression at the exact onboarding moment.
- **File:** `lib/properties/queries.ts:136-160` — filters on `createdAt` (DB insert time) instead of real event date, which is already stored.
- **Fix:** Filter on real dates: Applications by `COALESCE(appliedAt, receivedAt, createdAt)`, Leads by `firstSeenAt` (already populated).

### P1-9 · Chatbot greeting shows wrong building's inventory on multi-property tenants
- **Workflow:** Public chatbot greeting
- **Hits:** A prospect on Building B's site sees Building A's pricing/availability (`{starting_rent}/{open_count}/{next_available}`) — pooled across the whole portfolio.
- **File:** `app/api/public/chatbot/listings-summary/route.ts:42-95` — reads `slug` but ignores the `&property=` param the widget sends; matches on org slug not property slug, falls through to all-properties.
- **Fix:** Read `property` param and scope like `config/route.ts` does (fail closed if it doesn't belong to the org).

---

## 4. P2 / Polish

- **MRR inflated ~12x for annual subscribers** — `invoice.paid` writes the full invoice total to `mrrCents` instead of monthly; corrupts internal MRR/health dashboards (no customer mischarged). `app/api/webhooks/stripe/route.ts:566-570`. Drop the `mrrCents` write here; let `computeMrrCents` be the single source.
- **"Account paused" email lies** — 14-day-overdue cron sets `TenantStatus.PAUSED` but never `subscriptionStatus`; only the public chatbot enforces it, so the customer keeps full portal write access despite being told they're locked out. `app/api/cron/billing-reminders/route.ts:174-178`. Either soften the copy or actually enforce the pause.
- **Showings wrong-building attribution** — multi-property tour with no resolved property files under "first ACTIVE property." `appfolio-sync.ts:1332-1341`. (Note: this is a documented intentional default with an operator re-assign path — lower urgency; consider skip-with-warning instead.)
- **Shared report hero shows off-period property** — portfolio `/r/[token]` reports pin the org's current flagship building photo/name, possibly not in the report's period/scope. `lib/reports/load-property-hero.ts:54-66`. Constrain hero to properties in `snapshot.properties[]`.

---

## 5. Looked Solid (audited clean — reassurance)

- **Every other lead-capture surface is correctly defended** — chatbot/popup/public leads+tours use `requireMatchingOrigin` against the resolved tenant hostname; `ingest/*` uses API-key orgId scoping; `visitor-convert` uses `requireWritableWorkspace` + `tenantWhere`. The Cal webhook (P0-2) is the **lone** unguarded surface.
- **Onboarding wizard mutation routes** `workspace` and `properties` and `start-trial` are all properly hardened with atomic `updateMany` + terminal/paid guards (the `back` and `features` routes are the only two that missed the pattern).
- **Config route property isolation** — `chatbot/config` already added a fail-closed property-isolation guard (`:192-207`) from a prior Codex finding.
- **AppFolio residents/leases/units/delinquency phases** are data-loss-safe — they pull the full directory each run with no date filter, so no watermark gap applies.
- **Marketplace email/phone/company/LinkedIn masking** is correct — only income/gender/age slipped through (P0-1).
- **Application-row dedup** (vs. lead-row) is already hardened via `backendAppId` anchoring — the remaining dupe is lead-row only (P1-7).
- **Report timeline** correctly uses `appliedAt ?? createdAt` — the bug is isolated to the KPI queries (P1-8).

---

## 6. Recommended Next Actions (in order)

1. **Close both P0s first — same afternoon.** (a) Mask income/gender/age in `marketplace/[id]/page.tsx` AND stop returning raw PII from `getFullLead` for non-owners; (b) remove `org.id` from the chatbot config response (`:239`) — that one-line deletion immediately defangs the Cal injection by re-sealing the identifier. These are the only two true launch gates.
2. **Ship the Cal webhook token properly** (P0-2 hardening) — mint hashed per-org `webhookToken`, route to `/[token]`, add HMAC. The config-leak fix is a stopgap; the path-as-secret model must die.
3. **Fix the XSS (P1-1) + the two onboarding guards (P1-3, P1-4)** — all three are tiny, high-confidence, single-file diffs that prevent trust-breaking regressions. Bundle into one PR.
4. **Batch the AppFolio sync fixes (P1-5, P1-6, P1-7, P1-8) into one slice** — they share root causes (watermark recovery + ingest-time dating + lead reconciliation) and one customer (Norman/SG reconciling against AppFolio). Add regression tests; this is where launch trust in the numbers lives.
5. **Then P1-2 (insights gate) + P1-9 (chatbot greeting)**, and sweep the P2s before GA.

**Suggested workflow:** route each fix through `safe-feature-slice` (all touch Tier-1 surfaces — auth, entitlements, PII, webhooks). Run `parallel-review` on the P0/XSS diffs before `/cap`.

> Reflection: All 13 findings confirmed real/high-confidence — strong adversarial pass. The recurring theme is "one sibling route got the guard, the parallel one didn't" (onboarding back/features, appfolio leads vs applications) — worth a logic-ripple sweep to catch the next missed-parity bug class before it ships.

---

## Appendix — all 15 confirmed findings (structured)

### P0 (2)

**[lead-capture] Cal.com webhook treats orgId as a secret, but orgId is publicly leaked by the chatbot config endpoint — cross-tenant lead/tour injection**
- File: `app/api/webhooks/cal/[orgId]/route.ts:25-31, 84-150 (auth) vs app/api/public/chatbot/config/route.ts:239`
- Impact: A competitor or attacker can forge fake tour bookings into ANY tenant's pipeline: created Lead rows (status TOUR_SCHEDULED), Tour rows on the tenant's default property, and operator notification emails sent via our Resend account to the victim tenant's primaryContactEmail. Pollutes the customer's CRM/dashboard, trains operators to distrust notifications, and burns sending reputation on our shared domain — a trust-breaking launch issue for a multi-tenant product whose value prop is clean leasing intel.
- Fix: Stop using orgId as the webhook secret. Add a dedicated per-org unguessable webhook token (mirror the cursive/[token] pattern: a minted 32-hex CalIntegration.webhookToken stored hashed, format-validated before DB lookup), and route Cal to /api/webhooks/cal/[token]. Alternatively (or additionally) implement Cal.com's HMAC signature verification with a per-webhook secret. At minimum, do not expose org.id in the public chatbot config response — the embed/chat flow only needs slug + display config, and orgId is resolved server-side from slug in every consuming endpoint, so removing line 239 closes the leak that this and the origin-guard design both depend on staying secret.
- Confidence: high

**[marketplace] Lead PII (income range, gender, age) leaked to non-buyers and unauthenticated visitors on the lead detail page**
- File: `app/marketplace/[id]/page.tsx:261-278`
- Impact: Anyone — including unauthenticated visitors and buyers who have NOT purchased the lead — can read each lead's real income range, gender, and age just by opening /marketplace/<id>. These are exactly the enrichment PII fields the product promises to release only on payment. It both leaks personal data the buyer paid for and lets competitors scrape monetized intel for free, breaking the core paywall and trust model.
- Fix: Mask these three rows when !owned, matching the pattern used for email/phone. E.g. Income range: `value={owned ? (lead.incomeRange ?? "—") : "••• (revealed on purchase)"}` and only show the row when `owned`; same for Gender and Age. Better: don't return raw gender/incomeRange/age from getFullLead for unauthenticated/non-owner callers at all — gate the full-PII fetch behind getBuyerPurchaseForLead so un-purchased PII never reaches the render layer.
- Confidence: high

### P1 (9)

**[onboarding] Onboarding 'back' route regresses a completed (done) workspace out of its terminal state, locking a trialing customer back into the wizard**
- File: `app/api/onboarding/wizard/back/route.ts:47-60`
- Impact: A customer who has finished onboarding (trial active, onboardingStep='done') and then has a stale wizard tab — or any duplicate/replayed POST to /api/onboarding/wizard/back — gets onboardingStep rewritten from 'done' to 'properties'. The portal layout (app/portal/layout.tsx:272-275) then redirects every page load to /onboarding, trapping a paying/trialing user back inside the signup wizard until they re-complete the properties step. Trust-breaking regression for a customer who already 'got in'.
- Fix: Make the write atomic and terminal-safe: `await prisma.organization.updateMany({ where: { id: user.org.id, NOT: { onboardingStep: 'done' } }, data: { onboardingStep: target } })`. Also fix previousStep() so previousStep('done') returns 'done' (no-op) rather than 'properties' — a finished wizard has no 'back'.
- Confidence: high

**[onboarding] Onboarding 'features' route rewrites tier + module entitlements with no status/terminal guard, so a replayed request can downgrade a paid workspace's entitlements**
- File: `app/api/onboarding/wizard/features/route.ts:63-71`
- Impact: The entitlement write (chosenTier, subscriptionTier, and all module* flags) runs UNCONDITIONALLY for any authenticated user resolving to an org. A paid/active org (e.g. a customer who finished onboarding then re-opened a stale features tab, or a replayed POST) would have its module flags overwritten to the EXACT cart selection in the body — turning OFF every module not in that payload and flipping subscriptionTier to the inferred tier, silently downgrading entitlements the customer is paying for. No data is lost but paid features go dark.
- Fix: Gate the entitlement write the same way the trial routes do: only write chosenTier/subscriptionTier/moduleState when the org is not already paid — e.g. `prisma.organization.updateMany({ where: { id: user.orgId, OR: [{ subscriptionStatus: null }, { subscriptionStatus: { notIn: [ACTIVE, PAST_DUE] } }] }, data: { chosenTier, subscriptionTier, ...moduleState } })`, or short-circuit when onboardingStep === 'done'.
- Confidence: high

**[appfolio] Leads phase has no recovery backfill window — silently loses every lead from a failure/skip gap**
- File: `lib/integrations/appfolio-sync.ts:191-194, 646-665, 1146`
- Impact: After any stretch where the guest_cards (leads) phase fails or auto-skips while other phases keep succeeding, the operator permanently loses every lead that arrived during that window. For a leasing-INTELLIGENCE product, leads are the core funnel data — the dashboard will under-report the pipeline and the customer will distrust the numbers, with no error shown.
- Fix: Mirror the applications recovery pattern in the leads phase: compute `leadsRecovering = options.retrySkipped || !!phaseFailures.leads` and widen `fromDate` to a recovery backfill (e.g. reuse a RECOVERY_BACKFILL_DAYS window) when recovering, falling back to the normal incremental `fromDate` once the phase succeeds and its failure state clears.
- Confidence: high

**[appfolio] Work-orders and showings phases share the same watermark data-loss gap as leads**
- File: `lib/integrations/appfolio-sync.ts:680, 1028`
- Impact: Maintenance tickets (work orders) and tour/showing records that occurred during a phase outage silently never appear — operators see an incomplete maintenance backlog and tour history, eroding trust in the synced data.
- Fix: Apply the same `<phase>Recovering` + widened backfill window to the showings and work_order phases, keyed on `options.retrySkipped || !!phaseFailures.<phase>`.
- Confidence: high

**[application-tracking] Same applicant becomes two Lead rows (application-created lead never reconciles with later guest_card lead)**
- File: `lib/integrations/appfolio-sync.ts:1441-1472 (creation) + 1202-1256 (upsertAppfolioLead) + 1429-1436 (email match)`
- Impact: A prospect who submitted a rental application shows up TWICE in the property's lead list and lead count: once as the lead auto-created from the application (externalId `application:<id>`) and once as the AppFolio guest_card lead (externalId `<guest_card_id>`). The operator sees inflated pipeline numbers (leads28d / total leads double-count this person) and their history is split across two records — the application timeline lives on one lead, the inquiry/tour activity on the other. Trust-eroding for a customer like Norman who reconciles against AppFolio.
- Fix: In upsertAppfolioLead, before create, look up an existing lead by (orgId, propertyId, email insensitive) whose externalId starts with `application:`; if found, adopt that row (update it / set its externalId to the guest_card id or store both) instead of creating a new Lead. Equivalently, give application-created leads a deterministic email-based external key and have guest_cards match it. Add a regression test for the skipped-guest_cards-then-recovery sequence.
- Confidence: high

**[application-tracking] 28-day dashboard KPIs count by createdAt (sync ingest time), so backfills dump months of history into "last 28 days"**
- File: `lib/properties/queries.ts:136-160 (leads28d, applications28d, tours28d) and schema.prisma Application/Lead createdAt @default(now())`
- Impact: On a new customer's first sync, and after any phase recovery, the property dashboard shows wildly inflated "last 28 days" leads/applications/tours — e.g. 180 days of historical applications all appear as if they arrived this month, and the prev-28d comparison and sparkline are meaningless. A new customer's first impression of their numbers is wrong, undermining trust at exactly the onboarding moment.
- Fix: Filter the 28d/56d KPI windows on the real event date, not ingest time: Application by `appliedAt`/`receivedAt`, Lead by `firstSeenAt` (already populated from mapped.createdAt/appliedAt). At minimum use COALESCE(appliedAt, receivedAt, createdAt) for applications28d and firstSeenAt for leads28d so backfilled history is dated correctly.
- Confidence: high

**[chatbot] listings-summary ignores ?property= and pools ALL properties' inventory into a per-property greeting**
- File: `app/api/public/chatbot/listings-summary/route.ts:42-95`
- Impact: On a multi-property tenant, a prospect visiting Building B's website sees a chatbot greeting with the WRONG building's pricing/availability. The greeting interpolates {starting_rent}/{open_count}/{next_available} (config route lines 248-249), so e.g. Building B's site says 'rooms starting at $765/mo, 4 available' where $765 and the count actually come from Building A. The widget explicitly requests the per-property number (public/embed/chatbot.js:58 appends &property=<slug> to LISTINGS_URL) but the route never honors it — breaking the same per-property isolation the config + chat routes carefully enforce, and surfacing inventory figures from sibling properties.
- Fix: Read `const propertySlug = req.nextUrl.searchParams.get('property')` and resolve the scope the same way config/route.ts does: if propertySlug is present, find the property by that slug (fail to empty/disabled if it doesn't belong to the org), else fall back to `p.slug === slug`, else all properties. Scope scopedProperties to that single property so the greeting numbers match the building the prospect is actually on.
- Confidence: high

**[reports-sharing] Insights page leaks other properties' recommendation insights to property-restricted users**
- File: `app/portal/insights/page.tsx:63-114`
- Impact: A user whose access is limited to a subset of an org's properties (via UserPropertyAccess grants — e.g. a regional manager who should only see 2 of an org's 10 buildings) sees AI-generated Insight/recommendation cards for properties they are NOT authorized to view, including those properties' names, titles, and body text, in the Recommendations drawer. This breaks the per-user property gate the product relies on.
- Fix: Pass the gated id list to getOpenInsights instead of only the single-property shortcut. Extend getOpenInsights to accept `propertyIds?: string[]` and apply propertyIdsToWhere(effectiveIds) (mirroring getInsightCounts), or in the page compute the where from effectiveIds and refuse the unfiltered org-wide query whenever scope.allowedPropertyIds is non-null. Restricted users must never reach the no-filter branch.
- Confidence: high

**[public-ingest] Stored XSS in public neighborhood pages via unescaped JSON-LD injection**
- File: `app/(tenant)/tenant-site/n/[slug]/page.tsx:149`
- Impact: An operator (or AI-generated content) can store a payload containing `</script>` in a neighborhood page's title/intro/section/FAQ text. On the tenant's PUBLIC marketing site, the breakout runs arbitrary JS in every prospective renter's browser — letting an attacker hijack the on-page Apply/Contact lead-capture forms, steal visitor PII (name/email/phone), redirect to phishing, or deface the page. Breaks trust on the exact pages LeaseStack exists to drive leads to.
- Fix: Escape the serialized JSON-LD before injecting: `JSON.stringify(jsonLd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')` (or a shared `serializeJsonLd()` helper). Apply the same fix at lib/content/render-mdx.ts:302-304. `<` is valid JSON and renders identically to crawlers while making `</script>` breakout impossible.
- Confidence: high

### P2 (4)

**[stripe] invoice.paid overwrites mrrCents with the full invoice total, inflating MRR ~12x for annual subscribers**
- File: `app/api/webhooks/stripe/route.ts:566-570`
- Impact: Internal MRR/revenue dashboards and admin analytics report wildly wrong numbers for any annual customer: an org paying $11,880/yr shows mrrCents=1,188,000 ($11,880/mo) instead of $990/mo. Skews total platform MRR, per-org health scoring, and any cost/insight logic that reads mrrCents. No customer is mischarged.
- Fix: Do not derive MRR from invoice.amount_paid. Either drop the mrrCents write in handleInvoicePaid entirely (let customer.subscription.created/updated be the single source via computeMrrCents), or re-retrieve the subscription and run computeMrrCents on its items.
- Confidence: high

**[stripe] 14-day-overdue escalation sets TenantStatus.PAUSED but never sets subscriptionStatus, so the email's 'account paused/suspended' claim is only enforced for the public chatbot**
- File: `app/api/cron/billing-reminders/route.ts:174-178`
- Impact: A customer who is 14+ days past due receives an email stating 'Your account has been paused' / 'account suspended', but they retain full write access to the portal and all paid modules — only the public-facing chatbot (app/api/public/chatbot/chat/route.ts:131-133) actually checks TenantStatus.PAUSED. The escalation copy overstates the enforcement, a trust/consistency gap (customer told they're locked out but isn't).
- Fix: Either soften the escalation email copy to match reality (past-due, not paused), or actually enforce the pause: on escalation set subscriptionStatus=PAUSED (the AI gate and any subscriptionStatus-based gate already handle PAUSED) and/or make requireWritableWorkspace treat TenantStatus.PAUSED as read-only.
- Confidence: high

**[appfolio] Showings fallback guesses 'first ACTIVE property' for multi-property orgs — wrong-building attribution**
- File: `lib/integrations/appfolio-sync.ts:1332-1341`
- Impact: In a multi-building portfolio, a tour for a lead with no resolved property is attached to whichever building was created first, so that property's tour metrics are inflated and the real building's are wrong — cross-property data corruption in the per-property dashboards.
- Fix: For multi-property orgs (propertyByExternalId.size > 1) where the lead has no propertyId, return 'no_lead'/skip with a warning instead of falling back to the first ACTIVE property — matching the no-guess rule used by residents/leases/work-orders/applications.
- Confidence: high

**[reports-sharing] Shared report hero can display a property that is not part of the report's period/scope**
- File: `lib/reports/load-property-hero.ts:54-66`
- Impact: On a public /r/[token] portfolio (org-wide) report, or any report whose snapshot property lacks an image, the building photo + property name pinned at the very top of the client-facing shared link is resolved from the org's current flagship (most-recently-updated LIVE+ACTIVE property with an image) — NOT necessarily a property included in the report's data or time period. A client can open a 'last week' report and see a building name/photo that was added after the period or that contributed nothing to the numbers below it, undermining trust in the report's accuracy. Stays within the same org (not cross-tenant), so this is a correctness/trust issue, not a data leak.
- Fix: Constrain the hero to properties actually represented in the report: prefer snapshot.scope.propertyId, then a property present in snapshot.properties[] (which already reflects the period), and only fall back to an org flagship when the snapshot has no property context at all. Or label the hero so it is not mistaken for the sole subject of the period's data.
- Confidence: high

