# Ads: read-only connect + creative performance (2026-10-29)

Adam: "We're not running their Google Ads or Meta Ads. We're simply connecting to their marketing API ... pull in their paid ad data and show them all of that visually, and pull in the ad creatives ... and show how good they're doing." Tier-1 (OAuth tokens, tenant data, migration).

## Invariants
- LeaseStack never runs, edits or pauses a customer's ads. Read-only: Meta `ads_read` only; Google Ads (single `adwords` scope) is read by code only, no mutate calls.
- The customer owns the connection: they sign in with their own Google/Meta login (existing OAuth flows `/api/oauth/{google-ads,meta-ads}/start` -> account picker). No partner/MCC links, no "we run your ads" copy anywhere.
- Tenant + property scoping unchanged (OAuth start: requireWorkspaceAdmin + propertyInScope).

## Slices
| # | Slice | Migration | Status |
|---|-------|-----------|--------|
| S1 | Setup panels use read-only OAuth; copy fixed (setup tiles, catalog); Google leaf accounts no longer get our MCC as login-customer-id | no | in_progress |
| S2 | Per-ad sync: AdCreative (ad + creative: thumbnail, image, headline, body, CTA, URL, status) + AdCreativeMetricDaily; Meta /ads + insights level=ad, Google ad_group_ad | YES (additive) | pending, push needs Adam OK (preview build runs migrate deploy on prod DB) |
| S3 | /portal/ads creative gallery: thumbnails ranked by results (spend, CTR, CPC, leads, cost per lead), per platform | no | pending (after S2) |

## Notes
- Meta creative image URLs are signed CDN links that expire; S2 refreshes them each sync and S3 falls back to a placeholder on load error.
- Google: login-customer-id comes from the picker metadata. A bound leaf account stores `loginCustomerId: null`; that null must NOT fall back to GOOGLE_ADS_LOGIN_CUSTOMER_ID (our MCC 912-000-4237) or every direct customer's sync fails with permission denied.
