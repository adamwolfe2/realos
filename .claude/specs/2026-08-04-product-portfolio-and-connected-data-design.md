# LeaseStack Product Portfolio and Connected Data Foundation

**Date:** 2026-08-04

**Status:** Approved design; implementation not started

**Product boundary:** Software products with admin-assisted activation. LeaseStack does not provide managed advertising or creative services. Website Build is the intentional service upsell.

**Primary principle:** Preserve and productize the existing LeaseStack implementation. Do not rebuild working features from scratch.

## 1. Product thesis

LeaseStack is the flexible leasing data layer for property operators. It connects fragmented leasing systems, normalizes their signals by organization and property, and turns trustworthy data into simple operator actions.

The product must be useful across different portfolio sizes, website arrangements, AppFolio plans, integration permissions, and data shapes. Complexity belongs in LeaseStack's adapters, capability detection, and admin activation workflow. Customers should see a small set of outcome-oriented products that work end to end.

Success is not an enabled module flag. A product is active only after LeaseStack verifies that it produced its required real-world evidence.

## 2. Goals

1. Establish one authoritative product definition for marketing, pricing, marketplace, proposals, onboarding, entitlements, and Stripe.
2. Make integration readiness explicit per organization, property, and data lane.
3. Package existing features into five clear operator products with measurable outcomes.
4. Preserve existing routes, jobs, models, UI, module flags, and integrations wherever they already work.
5. Prevent static, fabricated, cross-tenant, stale, or unsupported data from appearing as operational truth.
6. Support admin-led activation now and a future self-serve flow using the same underlying contracts.
7. Make Website Build the premium service upsell without making it a prerequisite for using LeaseStack on existing customer websites.

## 3. Non-goals

- Rebuilding the LeaseStack dashboard or marketing design.
- Replacing the existing module-flag entitlement system in the first implementation slice.
- Providing managed advertising, media buying, campaign operations, or creative services.
- Promising universal completeness from third-party systems.
- Making all integrations self-serve immediately.
- Restoring PMS-style property-management surfaces. LeaseStack tracks leasing and marketing intelligence; it does not manage properties.
- Automatically changing existing subscriptions, prices, Stripe items, or customer entitlements.

## 4. Product architecture

### 4.1 Connected Data Foundation

Connected Data Foundation is the base platform, not an optional add-on. It connects and monitors available sources including:

- Customer websites and LeaseStack-hosted property sites.
- AppFolio and future PMS connectors.
- GA4 and Google Search Console.
- Google Ads and Meta Ads.
- Cursive visitor identification.
- Chatbot, popup, form, referral, and manual lead sources.

It owns connection status, property mapping, freshness, backfill state, data-lane availability, reconciliation, and integration health. It does not imply that every source or lane is available for every customer.

### 4.2 Lead-to-Lease Attribution

Attribution is the shared measurement spine, not a separately marketed tactical add-on. It joins the strongest available evidence across sessions, leads, chatbot conversations, campaigns, applications, and signed leases. It must report coverage and uncertainty rather than claim universal attribution.

### 4.3 Outcome products

1. **AI Leasing Chatbot**
2. **Conversion Offers**
3. **Reputation Rescue**
4. **Search Opportunity Engine**
5. **Monday Action Brief**

Each product uses the Connected Data Foundation and Attribution where applicable. Each has a setup contract, activation proof, operator workflow, primary KPI, degraded states, and end-to-end proof test.

### 4.4 Website Build

Website Build is a premium service upsell. It gives LeaseStack control over implementation quality, analytics, conversion instrumentation, chatbot placement, and property routing. Customers who keep existing websites can still use LeaseStack through portable scripts, verified domains, per-property configuration, service accounts, OAuth where ready, and admin-assisted setup.

## 5. Canonical product registry

Add one typed, version-controlled product registry above the current catalogs. Existing module flags remain the initial runtime entitlements.

Each product definition contains:

- Stable product key.
- Customer-facing name and concise promise.
- Classification: `foundation`, `outcome_product`, or `service`.
- Readiness: `sellable`, `beta`, `concierge`, `blocked`, or `internal`.
- Existing module flags and companion entitlements.
- Existing routes, background jobs, integrations, and admin surfaces.
- Scope: organization-wide, per-property, or mixed.
- Setup requirements and responsible actor.
- Required and optional data capabilities.
- Activation evidence.
- Primary KPI and supporting metrics.
- Supported degraded states.
- Stripe product/price mapping when billable.
- Marketing availability and approved claims.

The registry becomes the source for:

- Pricing cards and checkout selections.
- Marketplace cards and readiness labels.
- Proposal catalog lines.
- Admin activation choices.
- Onboarding recommendations.
- Runtime entitlement validation.
- Stripe reconciliation previews.
- Marketing claim validation.

Marketing pages can keep richer editorial copy, but every factual claim must be compatible with the registry contract.

## 6. Customer capability profile

LeaseStack maintains a capability profile per organization and, when relevant, per property. A capability records:

- Source and data lane.
- Connection lifecycle state.
- Property mapping state.
- First and last successful sync.
- Backfill window and completion state.
- Freshness threshold.
- Records received, accepted, skipped, and rejected.
- Schema or permission warnings.
- Verification evidence.
- Last user-safe error and recommended remediation.

The canonical lifecycle is:

`DISCONNECTED -> VERIFYING -> BACKFILLING -> READY | PARTIALLY_READY | NEEDS_ATTENTION`

Readiness is lane-specific. One AppFolio connection can simultaneously expose ready availability, unavailable resident data, and stale applications. Product activation evaluates only the capabilities that product requires.

### 6.1 Initial capability contracts

- **AppFolio Core / embed:** availability and public listing information only.
- **AppFolio Plus/Max REST:** properties, units, leads, applications, residents, leases, and work orders enabled independently after endpoint, schema, mapping, and backfill verification.
- **GA4/GSC:** organic intelligence after credential, property/site permission, backfill, and freshness checks.
- **Google/Meta Ads:** account-level reporting until campaign-to-property mapping and downstream attribution reconciliation are proven.
- **Cursive:** ready only after domain install, resolved identity event, property attribution, lead behavior, and notification delivery are verified.
- **Chatbot:** ready per property after domain/origin verification, knowledge completeness, availability truth test, test conversation, captured lead, transcript, and operator notification.

## 7. Outcome-product contracts

### 7.1 AI Leasing Chatbot

**Promise:** Answer property questions around the clock, qualify intent, capture contact information, and hand leads to the leasing team.

**Reuse:** Existing per-property chatbot configuration, structured knowledge base, live listings, origin controls, conversations, lead extraction, transcript storage, and notifications.

**Activation proof:** A controlled test conversation uses correct property facts, creates a lead under the correct organization/property, stores the transcript, and delivers the configured notification.

**Primary KPI:** Qualified leads captured, with after-hours leads reported separately.

**Degraded behavior:** If availability is stale or unavailable, the chatbot must say so and capture a follow-up request; it must never invent units, pricing, or tour availability.

### 7.2 Conversion Offers

**Promise:** Launch targeted, property-specific offers on an existing or LeaseStack-hosted site and measure the incremental leads they create.

**Reuse:** Existing popup editor, embed script, triggers, events, lead creation, property attribution, and campaign reporting.

**Activation proof:** A test campaign loads only on an allowed domain/property, records an impression and conversion, creates or associates the lead correctly, and appears in campaign analytics.

**Primary KPI:** Incremental attributed leads per offer, supported by impression-to-conversion rate.

**Degraded behavior:** Failed attribution does not erase the conversion. It is shown as unattributed with diagnostic context.

### 7.3 Reputation Rescue

**Promise:** Surface reputation risks that require action, help the operator respond, and track response time and resolution.

**Reuse:** Existing reputation scans, mentions, sentiment, response drafting, review-request workflow, and analytics.

**Activation proof:** A configured property produces a real scan, imports supported mentions, identifies an actionable item, and completes a response or resolution workflow.

**Primary KPI:** Actionable reputation issues resolved, supported by median response time and unresolved backlog.

**Degraded behavior:** Coverage is stated by source. LeaseStack never claims to monitor every public mention or offer direct replies where a source does not support them.

### 7.4 Search Opportunity Engine

**Promise:** Turn search and AI-discovery gaps into property-specific actions and measure whether visibility and qualified traffic improve.

**Reuse:** Existing GA4, GSC, DataForSEO, AI visibility scans, recommendations, content drafts, neighborhood pages, and content approval workflows.

**Activation proof:** Verified data identifies a specific opportunity, produces an operator-reviewable action or draft, records execution, and establishes a baseline for later measurement.

**Primary KPI:** Qualified search opportunities acted on, supported by ranking, citation, organic lead, and landing-page movement.

**Degraded behavior:** Recommendations distinguish observed facts from inferred opportunity. LeaseStack never guarantees rankings or AI citations.

### 7.5 Monday Action Brief

**Promise:** Deliver a concise weekly summary of what changed and several evidence-backed actions the operator can take next.

**Reuse:** Existing briefing queries, insight detectors, scheduled reports, weekly digests, action links, and report infrastructure.

**Activation proof:** A scheduled brief is generated from verified available data, delivered to the configured recipient, opened, and links each recommendation to a valid LeaseStack action surface.

**Primary KPI:** Recommended actions completed, supported by delivery/open rate and subsequent metric movement.

**Degraded behavior:** Sparse-data briefs explicitly say which sources are missing and provide setup or recovery actions. They do not fabricate trends, causal impact, or dollar values.

## 8. Admin activation workflow

Admin-led onboarding uses one activation workspace:

1. Create or select the organization.
2. Add and verify properties, domains, and access scope.
3. Connect available sources.
4. Run capability scans per source and property.
5. Reconcile imported and LeaseStack properties without guessing.
6. Run historical backfills within supported source limits.
7. Review freshness, coverage, rejected records, and unavailable lanes.
8. Select candidate outcome products based on verified capabilities.
9. Run each product's activation proof.
10. Activate only products that pass; record partial or blocked products with remediation.
11. Deliver a customer-facing activation summary showing what works, what is partial, and what comes next.

The future self-serve flow reuses these APIs and states. It changes who performs the steps, not the underlying safety or readiness contract.

## 9. Data normalization and edge cases

Source adapters map third-party payloads into existing canonical LeaseStack entities. Source-specific fields and raw payload evidence remain available for diagnostics.

Required safeguards:

- Organization and property scope on every read and write.
- Explicit property reconciliation; no name-only cross-property guessing.
- Idempotent upserts and stable external identifiers.
- Promote-only state transitions where sync data could otherwise demote a lead or application.
- Per-endpoint and per-lane failure isolation.
- Unknown fields and unmatched records enter a review state instead of being discarded silently.
- Fresh data never gets overwritten by an older backfill.
- Partial syncs retain prior good data and expose staleness.
- Disconnect behavior is explicit and property-aware.
- Customer-visible errors never expose secrets, raw credentials, internal IDs, or stack traces.

AppFolio contract fixtures must cover multiple plans, report permissions, missing endpoints, alternative field names, student-housing/per-bed units, conventional multifamily, multiple properties, empty reports, pagination, duplicates, and partial failures.

## 10. Catalog, entitlement, and Stripe alignment

The initial implementation must not mutate Stripe or customer subscriptions.

Sequence:

1. Introduce the registry as an adapter over existing definitions.
2. Generate a discrepancy report across pricing, marketplace, proposal catalog, module flags, marketing claims, and Stripe mappings.
3. Approve the canonical mapping product by product.
4. Update read-only commercial surfaces to derive from the registry.
5. Add catalog-to-entitlement consistency tests.
6. Generate a Stripe reconciliation preview listing creates, archives, price changes, entitlement changes, and affected subscriptions.
7. Require explicit written approval before any Stripe mutation.

Existing subscriptions, stable lookup keys, prices, and entitlements remain unchanged until an approved migration plan exists. Blocked, beta, concierge, and internal products cannot appear as ordinary self-serve purchases.

## 11. Product and marketing truth

Approved positioning:

- LeaseStack is software with admin-assisted activation.
- LeaseStack connects and interprets leasing data; it does not manage properties.
- LeaseStack does not manage advertising or produce creative services.
- Website Build is a separate service upsell.
- Attribution claims describe measured coverage and uncertainty.
- Third-party coverage, rankings, citations, identity resolution, and timelines are never guaranteed beyond verified contracts.

Immediate claim conflicts to reconcile during implementation include managed-ads language, creative-service language, universal PMS support, universal attribution, universal reputation coverage, and unsupported audience destinations.

## 12. Testing and release gates

Every product must pass:

- Tenant and property-isolation tests.
- Registry-to-surface consistency tests.
- Registry-to-entitlement tests.
- Stripe mapping round-trip tests without external mutation.
- Multiple realistic integration contract fixtures.
- Empty, partial, stale, disconnected, permission-denied, rate-limited, and recovery-state tests.
- Idempotent backfill and retry tests.
- One browser-verified end-to-end operator outcome.
- Mobile, keyboard, focus, screen-reader, loading, and reduced-motion checks.
- Plain-language review of statuses, errors, and remediation.

A product cannot be `sellable` until its activation proof and end-to-end outcome test pass. A source connection cannot be `READY` solely because credentials were accepted.

## 13. Rollout

### Phase A: Product truth

- Add the canonical registry without changing runtime behavior.
- Generate and review catalog/marketing/Stripe discrepancies.
- Freeze new unsupported sales claims.

### Phase B: Capability foundation

- Add the capability model and lane-specific health/readiness.
- Build the admin activation workspace over existing setup flows.
- Add AppFolio and other source contract fixtures.

### Phase C: Outcome products

- Formalize Chatbot first as the activation benchmark.
- Complete Conversion Offers.
- Complete Reputation Rescue.
- Complete Search Opportunity Engine.
- Complete Monday Action Brief.

### Phase D: Commercial alignment

- Align pricing, marketplace, proposals, onboarding, and marketing.
- Prepare, review, and separately approve any Stripe migration.

### Phase E: Validation and release

- Validate internally.
- Validate with Telegraph Commons as the known reference implementation.
- Validate with a materially different AppFolio customer and website arrangement.
- Resolve portability failures before broad release.

## 14. Success criteria

- One registry defines every sellable LeaseStack product and commercial surface.
- No self-serve surface sells blocked, internal, or unverified functionality.
- Every property shows source freshness and capability truth.
- AppFolio customers receive only the lanes their plan and permissions support.
- Each outcome product has a proven end-to-end workflow and primary KPI.
- Customers using existing websites can activate portable LeaseStack products per property.
- Website Build customers receive the same products with deeper first-party integration.
- Existing customer subscriptions remain unchanged until separately approved.
- LeaseStack can onboard a materially different customer without Telegraph Commons-specific code or manual database improvisation.

## 15. First implementation slice

The first implementation plan should cover only Product Truth:

1. Define the typed canonical registry around existing product metadata.
2. Build read-only adapters for pricing, marketplace, proposals, current module flags, marketing claims, and Stripe mappings.
3. Generate a discrepancy report.
4. Add consistency tests.
5. Make no customer-visible pricing, entitlement, Stripe, or marketing changes in this slice.

This slice creates the safe foundation for later capability and product work without rebuilding or prematurely changing production behavior.
