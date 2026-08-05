# LeaseStack Product Truth Baseline

Generated deterministically from version-controlled product sources.
No database, Stripe, environment, or external API access is used.

Status: **BLOCKED**

| Products | Source records | Critical | Warning | Info | Total |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 8 | 135 | 42 | 21 | 18 | 81 |

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

### `tier_readiness_conflict:billing_catalog:growth.annual:search-opportunity-engine`

- Owner: product
- Product: search-opportunity-engine
- Source: billing_catalog / growth.annual
- Evidence: `lib/billing/catalog.ts`
- Reason: Search Opportunity Engine is beta but the growth tier family grants it across billing variants.

### `tier_readiness_conflict:billing_catalog:scale.annual:search-opportunity-engine`

- Owner: product
- Product: search-opportunity-engine
- Source: billing_catalog / scale.annual
- Evidence: `lib/billing/catalog.ts`
- Reason: Search Opportunity Engine is beta but the scale tier family grants it across billing variants.

### `tier_unsupported_entitlement:billing_catalog:growth.annual:moduleCreativeStudio`

- Owner: product
- Product: unmapped
- Source: billing_catalog / growth.annual
- Evidence: `lib/billing/catalog.ts`
- Reason: The growth tier family grants unsupported entitlement moduleCreativeStudio across billing variants.

### `tier_unsupported_entitlement:billing_catalog:growth.annual:moduleGoogleAds`

- Owner: product
- Product: unmapped
- Source: billing_catalog / growth.annual
- Evidence: `lib/billing/catalog.ts`
- Reason: The growth tier family grants unsupported entitlement moduleGoogleAds across billing variants.

### `tier_unsupported_entitlement:billing_catalog:growth.annual:moduleMetaAds`

- Owner: product
- Product: unmapped
- Source: billing_catalog / growth.annual
- Evidence: `lib/billing/catalog.ts`
- Reason: The growth tier family grants unsupported entitlement moduleMetaAds across billing variants.

### `tier_unsupported_entitlement:billing_catalog:growth.annual:modulePixel`

- Owner: product
- Product: unmapped
- Source: billing_catalog / growth.annual
- Evidence: `lib/billing/catalog.ts`
- Reason: The growth tier family grants unsupported entitlement modulePixel across billing variants.

### `tier_unsupported_entitlement:billing_catalog:scale.annual:moduleCreativeStudio`

- Owner: product
- Product: unmapped
- Source: billing_catalog / scale.annual
- Evidence: `lib/billing/catalog.ts`
- Reason: The scale tier family grants unsupported entitlement moduleCreativeStudio across billing variants.

### `tier_unsupported_entitlement:billing_catalog:scale.annual:moduleEmail`

- Owner: product
- Product: unmapped
- Source: billing_catalog / scale.annual
- Evidence: `lib/billing/catalog.ts`
- Reason: The scale tier family grants unsupported entitlement moduleEmail across billing variants.

### `tier_unsupported_entitlement:billing_catalog:scale.annual:moduleGoogleAds`

- Owner: product
- Product: unmapped
- Source: billing_catalog / scale.annual
- Evidence: `lib/billing/catalog.ts`
- Reason: The scale tier family grants unsupported entitlement moduleGoogleAds across billing variants.

### `tier_unsupported_entitlement:billing_catalog:scale.annual:moduleMetaAds`

- Owner: product
- Product: unmapped
- Source: billing_catalog / scale.annual
- Evidence: `lib/billing/catalog.ts`
- Reason: The scale tier family grants unsupported entitlement moduleMetaAds across billing variants.

### `tier_unsupported_entitlement:billing_catalog:scale.annual:moduleOutboundEmail`

- Owner: product
- Product: unmapped
- Source: billing_catalog / scale.annual
- Evidence: `lib/billing/catalog.ts`
- Reason: The scale tier family grants unsupported entitlement moduleOutboundEmail across billing variants.

### `tier_unsupported_entitlement:billing_catalog:scale.annual:modulePixel`

- Owner: product
- Product: unmapped
- Source: billing_catalog / scale.annual
- Evidence: `lib/billing/catalog.ts`
- Reason: The scale tier family grants unsupported entitlement modulePixel across billing variants.

### `tier_unsupported_entitlement:billing_catalog:scale.annual:moduleReferrals`

- Owner: product
- Product: unmapped
- Source: billing_catalog / scale.annual
- Evidence: `lib/billing/catalog.ts`
- Reason: The scale tier family grants unsupported entitlement moduleReferrals across billing variants.

### `unsupported_claim:marketing:features.ads.managed-end-to-end`

- Owner: marketing
- Product: unmapped
- Source: marketing / features.ads.managed-end-to-end
- Evidence: `lib/copy/product-claims.ts`
- Reason: LeaseStack is software and does not operate advertising for customers.

### `unsupported_claim:marketing:features.ads.universal-attribution`

- Owner: marketing
- Product: lead-to-lease-attribution
- Source: marketing / features.ads.universal-attribution
- Evidence: `lib/copy/product-claims.ts`
- Reason: Paid-media attribution cannot guarantee every dollar maps to a signed lease.

### `unsupported_claim:marketing:features.ads.weekly-creative-refresh`

- Owner: marketing
- Product: unmapped
- Source: marketing / features.ads.weekly-creative-refresh
- Evidence: `lib/copy/product-claims.ts`
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
- Evidence: `lib/copy/product-claims.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `orphan_product_source:marketing:features.ads.weekly-creative-refresh`

- Owner: product
- Product: unmapped
- Source: marketing / features.ads.weekly-creative-refresh
- Evidence: `lib/copy/product-claims.ts`
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
- Evidence: `lib/copy/product-claims.ts`
- Reason: Customer-visible source has no approved canonical product mapping.

### `price_drift:billing_features:moduleReputation:group-1`

- Owner: billing
- Product: reputation-rescue
- Source: billing_features / moduleReputation
- Evidence: `lib/billing/features.ts`
- Reason: Reputation Rescue has multiple self-serve prices: 7900, 9900.

## Info

### `stripe_live_verification_deferred:billing_features:base_platform`

- Owner: billing
- Product: connected-data-foundation
- Source: billing_features / base_platform
- Evidence: `lib/billing/features.ts`
- Reason: Lookup key ls_base_platform_monthly requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:billing_features:moduleAttribution`

- Owner: billing
- Product: lead-to-lease-attribution
- Source: billing_features / moduleAttribution
- Evidence: `lib/billing/features.ts`
- Reason: Lookup key ls_feat_moduleAttribution_monthly requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:billing_features:moduleChatbot`

- Owner: billing
- Product: ai-leasing-chatbot
- Source: billing_features / moduleChatbot
- Evidence: `lib/billing/features.ts`
- Reason: Lookup key ls_feat_moduleChatbot_monthly requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:billing_features:moduleCreativeStudio`

- Owner: billing
- Product: unmapped
- Source: billing_features / moduleCreativeStudio
- Evidence: `lib/billing/features.ts`
- Reason: Lookup key ls_feat_moduleCreativeStudio_monthly requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:billing_features:moduleEmail`

- Owner: billing
- Product: unmapped
- Source: billing_features / moduleEmail
- Evidence: `lib/billing/features.ts`
- Reason: Lookup key ls_feat_moduleEmail_monthly requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:billing_features:moduleGoogleAds`

- Owner: billing
- Product: unmapped
- Source: billing_features / moduleGoogleAds
- Evidence: `lib/billing/features.ts`
- Reason: Lookup key ls_feat_moduleGoogleAds_monthly requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:billing_features:moduleInsights`

- Owner: billing
- Product: monday-action-brief
- Source: billing_features / moduleInsights
- Evidence: `lib/billing/features.ts`
- Reason: Lookup key ls_feat_moduleInsights_monthly requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:billing_features:moduleMarketIntelligence`

- Owner: billing
- Product: search-opportunity-engine
- Source: billing_features / moduleMarketIntelligence
- Evidence: `lib/billing/features.ts`
- Reason: Lookup key ls_feat_moduleMarketIntelligence_monthly requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:billing_features:moduleMetaAds`

- Owner: billing
- Product: unmapped
- Source: billing_features / moduleMetaAds
- Evidence: `lib/billing/features.ts`
- Reason: Lookup key ls_feat_moduleMetaAds_monthly requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:billing_features:moduleOutboundEmail`

- Owner: billing
- Product: unmapped
- Source: billing_features / moduleOutboundEmail
- Evidence: `lib/billing/features.ts`
- Reason: Lookup key ls_feat_moduleOutboundEmail_monthly requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:billing_features:modulePixel`

- Owner: billing
- Product: unmapped
- Source: billing_features / modulePixel
- Evidence: `lib/billing/features.ts`
- Reason: Lookup key ls_feat_modulePixel_monthly requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:billing_features:modulePopups`

- Owner: billing
- Product: conversion-offers
- Source: billing_features / modulePopups
- Evidence: `lib/billing/features.ts`
- Reason: Lookup key ls_feat_modulePopups_monthly requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:billing_features:moduleReferrals`

- Owner: billing
- Product: unmapped
- Source: billing_features / moduleReferrals
- Evidence: `lib/billing/features.ts`
- Reason: Lookup key ls_feat_moduleReferrals_monthly requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:billing_features:moduleReputation`

- Owner: billing
- Product: reputation-rescue
- Source: billing_features / moduleReputation
- Evidence: `lib/billing/features.ts`
- Reason: Lookup key ls_feat_moduleReputation_monthly requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:billing_features:moduleSEO`

- Owner: billing
- Product: search-opportunity-engine
- Source: billing_features / moduleSEO
- Evidence: `lib/billing/features.ts`
- Reason: Lookup key ls_feat_moduleSEO_monthly requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:marketplace:ai-chatbot`

- Owner: billing
- Product: ai-leasing-chatbot
- Source: marketplace / ai-chatbot
- Evidence: `lib/marketplace/catalog.ts`
- Reason: Lookup key ls_addon_chatbot_v1 requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:marketplace:referrals`

- Owner: billing
- Product: unmapped
- Source: marketplace / referrals
- Evidence: `lib/marketplace/catalog.ts`
- Reason: Lookup key ls_addon_referrals_v1 requires separate live Stripe reconciliation.

### `stripe_live_verification_deferred:marketplace:reputation-pro`

- Owner: billing
- Product: reputation-rescue
- Source: marketplace / reputation-pro
- Evidence: `lib/marketplace/catalog.ts`
- Reason: Lookup key ls_reputation_pro_monthly_v1 requires separate live Stripe reconciliation.
