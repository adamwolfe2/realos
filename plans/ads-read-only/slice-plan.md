# Ads: read-only connect + creative performance (2026-10-29)

Adam: "We're not running their Google Ads or Meta Ads. We're simply connecting to their marketing API ... pull in their paid ad data and show them all of that visually, and pull in the ad creatives ... and show how good they're doing." Tier-1 (OAuth tokens, tenant data, migration).

## Invariants
- LeaseStack never runs, edits or pauses a customer's ads. Read-only: Meta `ads_read` only; Google Ads (single `adwords` scope) is read by code only, no mutate calls.
- The customer owns the connection: they sign in with their own Google/Meta login (existing OAuth flows `/api/oauth/{google-ads,meta-ads}/start` -> account picker). No partner/MCC links, no "we run your ads" copy anywhere.
- Tenant + property scoping unchanged (OAuth start: requireWorkspaceAdmin + propertyInScope).

## Slices
| # | Slice | Migration | Status |
|---|-------|-----------|--------|
| S1 | Setup panels use read-only OAuth; copy fixed (setup tiles, catalog); Google leaf accounts no longer get our MCC as login-customer-id | no | done (PR #212, awaiting merge) |
| S2 | Per-ad sync: AdCreative (ad + creative: thumbnail, image, headline, body, CTA, URL, status) + AdCreativeMetricDaily; Meta /ads + insights level=ad, Google ad_group_ad | YES (additive, `20261029_add_ad_creatives`) | done 2026-10-29 (stacked on S1 branch); migration applies on merge to main only: vercel-build skips `migrate deploy` on preview |
| S3 | /portal/ads creative gallery: thumbnails ranked by results (spend, CTR, CPC, leads, cost per lead), per platform | no | done 2026-10-29 (app/portal/ads/ad-creative-gallery.tsx, "Your ads" panel); runtime check needs Adam on the Vercel preview (no local sign-in) |

## Notes
- Meta creative image URLs are signed CDN links that expire; S2 refreshes them each sync and S3 falls back to a placeholder on load error.
- Google: login-customer-id comes from the picker metadata. A bound leaf account stores `loginCustomerId: null`; that null must NOT fall back to GOOGLE_ADS_LOGIN_CUSTOMER_ID (our MCC 912-000-4237) or every direct customer's sync fails with permission denied.
- S2: creative phase runs after the campaign phase inside `syncCreatives`; a creative-side API failure is a warning + failedWrites (watermark held), campaign data is kept and the run still reports ok. Google ads have no image URLs yet (display/PMax images are asset resource names); gallery shows them as text cards.
- S2 known gap: `lib/billing/ad-retention-job.ts` does not roll up AdCreativeMetricDaily. Add when per-ad rows matter for storage (30-day window re-pulls, so growth is ads x days).
