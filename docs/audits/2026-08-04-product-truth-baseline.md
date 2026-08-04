# LeaseStack Product Truth Baseline

Generated deterministically from version-controlled product sources.
No database, Stripe, environment, or external API access is used.

Status: **BLOCKED**

| Products | Source records | Critical | Warning | Info | Total |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 8 | 135 | 29 | 40 | 0 | 69 |

## Critical

### `readiness_conflict:billing_catalog:ls_addon_reputation_pro`

- Owner: product
- Product: reputation-rescue
- Source: billing_catalog / ls_addon_reputation_pro
- Evidence: `lib/billing/catalog.ts`
- Reason: Reputation Rescue is beta but this source sells it self-serve.

### `readiness_conflict:billing_features:moduleAttribution`

- Owner: product
- Product: lead-to-lease-attribution
- Source: billing_features / moduleAttribution
- Evidence: `lib/billing/features.ts`
- Reason: Lead-to-Lease Attribution is beta but this source sells it self-serve.

### `readiness_conflict:billing_features:moduleInsights`

- Owner: product
- Product: monday-action-brief
- Source: billing_features / moduleInsights
- Evidence: `lib/billing/features.ts`
- Reason: Monday Action Brief is beta but this source sells it self-serve.

### `readiness_conflict:billing_features:moduleMarketIntelligence`

- Owner: product
- Product: search-opportunity-engine
- Source: billing_features / moduleMarketIntelligence
- Evidence: `lib/billing/features.ts`
- Reason: Search Opportunity Engine is beta but this source sells it self-serve.

### `readiness_conflict:billing_features:modulePopups`

- Owner: product
- Product: conversion-offers
- Source: billing_features / modulePopups
- Evidence: `lib/billing/features.ts`
- Reason: Conversion Offers is beta but this source sells it self-serve.

### `readiness_conflict:billing_features:moduleReputation`

- Owner: product
- Product: reputation-rescue
- Source: billing_features / moduleReputation
- Evidence: `lib/billing/features.ts`
- Reason: Reputation Rescue is beta but this source sells it self-serve.

### `readiness_conflict:billing_features:moduleSEO`

- Owner: product
- Product: search-opportunity-engine
- Source: billing_features / moduleSEO
- Evidence: `lib/billing/features.ts`
- Reason: Search Opportunity Engine is beta but this source sells it self-serve.

### `readiness_conflict:marketplace:reputation-pro`

- Owner: product
- Product: reputation-rescue
- Source: marketplace / reputation-pro
- Evidence: `lib/marketplace/catalog.ts`
- Reason: Reputation Rescue is beta but this source sells it self-serve.

### `readiness_conflict:stripe_static:ls_reputation_pro_monthly_v1`

- Owner: product
- Product: reputation-rescue
- Source: stripe_static / ls_reputation_pro_monthly_v1
- Evidence: `lib/billing/price-ids.generated.ts`
- Reason: Reputation Rescue is beta but this source sells it self-serve.

### `unsupported_claim:marketing:features.ads.managed-end-to-end`

- Owner: marketing
- Product: unmapped
- Source: marketing / features.ads.managed-end-to-end
- Evidence: `app/(platform)/features/ads/page.tsx`
- Reason: LeaseStack is software and does not operate advertising for customers.

### `unsupported_claim:marketing:features.ads.universal-attribution`

- Owner: marketing
- Product: lead-to-lease-attribution
- Source: marketing / features.ads.universal-attribution
- Evidence: `app/(platform)/features/page.tsx`
- Reason: Paid-media attribution cannot guarantee every dollar maps to a signed lease.

### `unsupported_claim:marketing:features.ads.weekly-creative-refresh`

- Owner: marketing
- Product: unmapped
- Source: marketing / features.ads.weekly-creative-refresh
- Evidence: `app/(platform)/features/page.tsx`
- Reason: LeaseStack does not sell an ongoing creative-production service.

### `unsupported_claim:marketing:home.faq.ads-start-running`

- Owner: marketing
- Product: unmapped
- Source: marketing / home.faq.ads-start-running
- Evidence: `lib/copy/marketing.ts`
- Reason: LeaseStack does not launch or manage customer advertising.

### `unsupported_claim:marketing:home.faq.every-major-pms`

- Owner: marketing
- Product: connected-data-foundation
- Source: marketing / home.faq.every-major-pms
- Evidence: `lib/copy/marketing.ts`
- Reason: PMS support is capability-specific and several listed connectors are not live.

### `unsupported_claim:marketing:home.hero.universal-attribution`

- Owner: marketing
- Product: lead-to-lease-attribution
- Source: marketing / home.hero.universal-attribution
- Evidence: `lib/copy/marketing.ts`
- Reason: Attribution must disclose measured coverage and cannot promise every outcome.

### `unsupported_self_serve_product:billing_catalog:ls_addon_email_overage`

- Owner: product
- Product: unmapped
- Source: billing_catalog / ls_addon_email_overage
- Evidence: `lib/billing/catalog.ts`
- Reason: Customer-visible self-serve product has no approved canonical contract.

### `unsupported_self_serve_product:billing_catalog:ls_addon_pixel_overage`

- Owner: product
- Product: unmapped
- Source: billing_catalog / ls_addon_pixel_overage
- Evidence: `lib/billing/catalog.ts`
- Reason: Customer-visible self-serve product has no approved canonical contract.

### `unsupported_self_serve_product:billing_catalog:ls_addon_white_label`

- Owner: product
- Product: unmapped
- Source: billing_catalog / ls_addon_white_label
- Evidence: `lib/billing/catalog.ts`
- Reason: Customer-visible self-serve product has no approved canonical contract.

### `unsupported_self_serve_product:billing_features:moduleCreativeStudio`

- Owner: product
- Product: unmapped
- Source: billing_features / moduleCreativeStudio
- Evidence: `lib/billing/features.ts`
- Reason: Customer-visible self-serve product has no approved canonical contract.

### `unsupported_self_serve_product:billing_features:moduleEmail`

- Owner: product
- Product: unmapped
- Source: billing_features / moduleEmail
- Evidence: `lib/billing/features.ts`
- Reason: Customer-visible self-serve product has no approved canonical contract.

### `unsupported_self_serve_product:billing_features:moduleGoogleAds`

- Owner: product
- Product: unmapped
- Source: billing_features / moduleGoogleAds
- Evidence: `lib/billing/features.ts`
- Reason: Customer-visible self-serve product has no approved canonical contract.

### `unsupported_self_serve_product:billing_features:moduleMetaAds`

- Owner: product
- Product: unmapped
- Source: billing_features / moduleMetaAds
- Evidence: `lib/billing/features.ts`
- Reason: Customer-visible self-serve product has no approved canonical contract.

### `unsupported_self_serve_product:billing_features:moduleOutboundEmail`

- Owner: product
- Product: unmapped
- Source: billing_features / moduleOutboundEmail
- Evidence: `lib/billing/features.ts`
- Reason: Customer-visible self-serve product has no approved canonical contract.

### `unsupported_self_serve_product:billing_features:modulePixel`

- Owner: product
- Product: unmapped
- Source: billing_features / modulePixel
- Evidence: `lib/billing/features.ts`
- Reason: Customer-visible self-serve product has no approved canonical contract.

### `unsupported_self_serve_product:billing_features:moduleReferrals`

- Owner: product
- Product: unmapped
- Source: billing_features / moduleReferrals
- Evidence: `lib/billing/features.ts`
- Reason: Customer-visible self-serve product has no approved canonical contract.

### `unsupported_self_serve_product:marketplace:referrals`

- Owner: product
- Product: unmapped
- Source: marketplace / referrals
- Evidence: `lib/marketplace/catalog.ts`
- Reason: Customer-visible self-serve product has no approved canonical contract.

### `unsupported_self_serve_product:stripe_static:ls_email_overage_per_send_v1`

- Owner: product
- Product: unmapped
- Source: stripe_static / ls_email_overage_per_send_v1
- Evidence: `lib/billing/price-ids.generated.ts`
- Reason: Customer-visible self-serve product has no approved canonical contract.

### `unsupported_self_serve_product:stripe_static:ls_pixel_overage_per_visitor_v1`

- Owner: product
- Product: unmapped
- Source: stripe_static / ls_pixel_overage_per_visitor_v1
- Evidence: `lib/billing/price-ids.generated.ts`
- Reason: Customer-visible self-serve product has no approved canonical contract.

### `unsupported_self_serve_product:stripe_static:ls_white_label_monthly_v1`

- Owner: product
- Product: unmapped
- Source: stripe_static / ls_white_label_monthly_v1
- Evidence: `lib/billing/price-ids.generated.ts`
- Reason: Customer-visible self-serve product has no approved canonical contract.

## Warning

### `orphan_product_source:marketing:features.ads.managed-end-to-end`

- Owner: product
- Product: unmapped
- Source: marketing / features.ads.managed-end-to-end
- Evidence: `app/(platform)/features/ads/page.tsx`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:marketing:features.ads.weekly-creative-refresh`

- Owner: product
- Product: unmapped
- Source: marketing / features.ads.weekly-creative-refresh
- Evidence: `app/(platform)/features/page.tsx`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:marketing:home.faq.ads-start-running`

- Owner: product
- Product: unmapped
- Source: marketing / home.faq.ads-start-running
- Evidence: `lib/copy/marketing.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:marketplace:email-nurture`

- Owner: product
- Product: unmapped
- Source: marketplace / email-nurture
- Evidence: `lib/marketplace/catalog.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:marketplace:marketing-site`

- Owner: product
- Product: unmapped
- Source: marketplace / marketing-site
- Evidence: `lib/marketplace/catalog.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:marketplace:outbound-email`

- Owner: product
- Product: unmapped
- Source: marketplace / outbound-email
- Evidence: `lib/marketplace/catalog.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:marketplace:white-label`

- Owner: product
- Product: unmapped
- Source: marketplace / white-label
- Evidence: `lib/marketplace/catalog.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:proposal_catalog:addon-audience-sync`

- Owner: product
- Product: unmapped
- Source: proposal_catalog / addon-audience-sync
- Evidence: `lib/proposals/catalog.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:proposal_catalog:addon-commercial-retainer`

- Owner: product
- Product: unmapped
- Source: proposal_catalog / addon-commercial-retainer
- Evidence: `lib/proposals/catalog.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:proposal_catalog:addon-cursive-pixel-pro`

- Owner: product
- Product: unmapped
- Source: proposal_catalog / addon-cursive-pixel-pro
- Evidence: `lib/proposals/catalog.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:proposal_catalog:addon-custom-domain`

- Owner: product
- Product: unmapped
- Source: proposal_catalog / addon-custom-domain
- Evidence: `lib/proposals/catalog.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:proposal_catalog:addon-email-overage`

- Owner: product
- Product: unmapped
- Source: proposal_catalog / addon-email-overage
- Evidence: `lib/proposals/catalog.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:proposal_catalog:addon-outbound-email-engine`

- Owner: product
- Product: unmapped
- Source: proposal_catalog / addon-outbound-email-engine
- Evidence: `lib/proposals/catalog.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:proposal_catalog:addon-pixel-overage`

- Owner: product
- Product: unmapped
- Source: proposal_catalog / addon-pixel-overage
- Evidence: `lib/proposals/catalog.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:proposal_catalog:addon-portfolio-success`

- Owner: product
- Product: unmapped
- Source: proposal_catalog / addon-portfolio-success
- Evidence: `lib/proposals/catalog.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:proposal_catalog:addon-white-glove-coordination`

- Owner: product
- Product: unmapped
- Source: proposal_catalog / addon-white-glove-coordination
- Evidence: `lib/proposals/catalog.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:proposal_catalog:addon-white-label`

- Owner: product
- Product: unmapped
- Source: proposal_catalog / addon-white-label
- Evidence: `lib/proposals/catalog.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:proposal_catalog:setup-kickoff-workshop`

- Owner: product
- Product: unmapped
- Source: proposal_catalog / setup-kickoff-workshop
- Evidence: `lib/proposals/catalog.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:proposal_catalog:sprint-30-day-implementation`

- Owner: product
- Product: unmapped
- Source: proposal_catalog / sprint-30-day-implementation
- Evidence: `lib/proposals/catalog.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:terms:terms.no-managed-advertising`

- Owner: product
- Product: unmapped
- Source: terms / terms.no-managed-advertising
- Evidence: `app/(platform)/terms/page.tsx`
- Reason: Customer-visible source has no approved canonical product mapping.

### `price_drift:billing_features:moduleReputation`

- Owner: billing
- Product: reputation-rescue
- Source: billing_features / moduleReputation
- Evidence: `lib/billing/features.ts`
- Reason: Reputation Rescue has multiple self-serve prices: 7900, 9900.

### `price_drift:billing_features:moduleSEO`

- Owner: billing
- Product: search-opportunity-engine
- Source: billing_features / moduleSEO
- Evidence: `lib/billing/features.ts`
- Reason: Search Opportunity Engine has multiple self-serve prices: 14900, 7900.

### `stripe_mapping_unverified:billing_features:base_platform`

- Owner: billing
- Product: connected-data-foundation
- Source: billing_features / base_platform
- Evidence: `lib/billing/features.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:billing_features:moduleAttribution`

- Owner: billing
- Product: lead-to-lease-attribution
- Source: billing_features / moduleAttribution
- Evidence: `lib/billing/features.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:billing_features:moduleChatbot`

- Owner: billing
- Product: ai-leasing-chatbot
- Source: billing_features / moduleChatbot
- Evidence: `lib/billing/features.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:billing_features:moduleCreativeStudio`

- Owner: billing
- Product: unmapped
- Source: billing_features / moduleCreativeStudio
- Evidence: `lib/billing/features.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:billing_features:moduleEmail`

- Owner: billing
- Product: unmapped
- Source: billing_features / moduleEmail
- Evidence: `lib/billing/features.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:billing_features:moduleGoogleAds`

- Owner: billing
- Product: unmapped
- Source: billing_features / moduleGoogleAds
- Evidence: `lib/billing/features.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:billing_features:moduleInsights`

- Owner: billing
- Product: monday-action-brief
- Source: billing_features / moduleInsights
- Evidence: `lib/billing/features.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:billing_features:moduleMarketIntelligence`

- Owner: billing
- Product: search-opportunity-engine
- Source: billing_features / moduleMarketIntelligence
- Evidence: `lib/billing/features.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:billing_features:moduleMetaAds`

- Owner: billing
- Product: unmapped
- Source: billing_features / moduleMetaAds
- Evidence: `lib/billing/features.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:billing_features:moduleOutboundEmail`

- Owner: billing
- Product: unmapped
- Source: billing_features / moduleOutboundEmail
- Evidence: `lib/billing/features.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:billing_features:modulePixel`

- Owner: billing
- Product: unmapped
- Source: billing_features / modulePixel
- Evidence: `lib/billing/features.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:billing_features:modulePopups`

- Owner: billing
- Product: conversion-offers
- Source: billing_features / modulePopups
- Evidence: `lib/billing/features.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:billing_features:moduleReferrals`

- Owner: billing
- Product: unmapped
- Source: billing_features / moduleReferrals
- Evidence: `lib/billing/features.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:billing_features:moduleReputation`

- Owner: billing
- Product: reputation-rescue
- Source: billing_features / moduleReputation
- Evidence: `lib/billing/features.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:billing_features:moduleSEO`

- Owner: billing
- Product: search-opportunity-engine
- Source: billing_features / moduleSEO
- Evidence: `lib/billing/features.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:marketplace:ai-chatbot`

- Owner: billing
- Product: ai-leasing-chatbot
- Source: marketplace / ai-chatbot
- Evidence: `lib/marketplace/catalog.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:marketplace:referrals`

- Owner: billing
- Product: unmapped
- Source: marketplace / referrals
- Evidence: `lib/marketplace/catalog.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

### `stripe_mapping_unverified:marketplace:reputation-pro`

- Owner: billing
- Product: reputation-rescue
- Source: marketplace / reputation-pro
- Evidence: `lib/marketplace/catalog.ts`
- Reason: A lookup key is declared but its live DB-backed Price mapping is unverified.

## Info

None.
