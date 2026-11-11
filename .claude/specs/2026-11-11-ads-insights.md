# Ads insights: ranges, drill-downs, suggestions, weekly brief

Stacked on PR #238 (feat/ads-demo-polish). Branch feat/ads-insights. Track, never manage: every suggestion is a recommendation, nothing edits campaigns.

## Acceptance checks
1. `/portal/ads?range=7|28|90` changes every number, the chart, and the campaign table (window totals, not lifetime), each compared with the prior equal window.
2. `/portal/ads/campaigns/[id]`: daily spend/leads/CPL trend, the campaign's ads, its leads with stage, funnel.
3. "By property" rows drill into `/portal/ads?property=<id>`; weekly funnel (leads, tours, leases by ISO week) on the page.
4. Ads: format comparison (image/video/carousel/text by cost per lead) and fatigue flag (CTR last 7d vs first 7d of window down >= 30%).
5. Suggestions panel on /portal/ads from the Insight table (category ads), fed by detectors:
   - fix: wasted-ad-spend skipped Meta (platform key META_ADS vs enum META)
   - new budget-shift: properties' cost per lease differ >= 2x with >= 2 leases each
   - new creative-fatigue: per ad, rule in check 4
   - existing vacancy-needs-boost / cpl-spike surface here too
6. Weekly brief: Claude writes a short read of last week (what moved, why, 2-3 decisions) from the numbers only; stored once per org per ISO week as an Insight (kind ads_weekly_brief); shown at top of /portal/ads. No API key -> rule-written fallback.

## Data gap to flag
Lead -> campaign attribution is platform-level (AppFolio guest-card source). The Lair/Den sites can carry utm_campaign into the AppFolio showing URL `source=` to make cost per lease per campaign real.
