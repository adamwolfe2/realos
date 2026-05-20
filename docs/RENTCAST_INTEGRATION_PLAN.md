# RentCast Integration Plan

**Goal:** Make LeaseStack feel premium by surfacing real market intelligence (rent AVM, property value AVM, comparable inventory, market trends) on every surface where it adds operator value. Designed for residential, student housing, and small multifamily.

**API**: https://developers.rentcast.io
**Auth**: `X-Api-Key` header
**Rate limit**: 20 req/sec (well above anything we'd legitimately do)
**Key endpoints**:
- `GET /v1/properties` — property records lookup/search by address or geo (backfill attributes)
- `GET /v1/avm/value` — property value estimate + N comparables (default 15)
- `GET /v1/avm/rent/long-term` — long-term rent estimate + N comparables
- `GET /v1/avm/rent/short-term` — short-term / Airbnb rent estimate
- `GET /v1/listings/sale` — for-sale listings search
- `GET /v1/listings/rental/long-term` — rental listings search
- `GET /v1/markets` — zip-level aggregate stats with historical trend window

## Cost reality

| Plan | Monthly | Quota | Overage |
|------|---------|-------|---------|
| Developer (free) | $0 | 50 | $0.20 |
| Foundation | $74 | 1,000 | $0.06 |
| Growth | $199 | 5,000 | $0.03 |
| Scale | $449 | 25,000 | $0.015 |

**Free tier (50/mo) is a smoke-test budget, not production**. For SG (127 properties) a single baseline-fetch consumes ~381 calls. Caching strategy MUST treat every call as expensive. Recommendation: Foundation tier ($74/mo, 1K calls) for SG launch — gives ~3 baseline refreshes per property per month with headroom for ad-hoc operator-triggered lookups.

## Caching strategy (CRITICAL)

Two-layer cache:

1. **`RentCastSnapshot` table** — persistent cache keyed by `(endpoint, address_normalized | zip | propertyId)`. TTLs:
   - `value` AVM → 60 days (residential values don't move fast)
   - `rent/long-term` AVM → 30 days (market rents shift quarterly)
   - `rent/short-term` AVM → 14 days (more volatile)
   - `properties` records → 365 days (static attributes)
   - `markets` stats → 14 days (refreshed by RentCast monthly anyway)
   - `listings/*` → 24 hours (only fetched on operator-triggered searches)

2. **Per-org request budget** — `OrgRentCastUsage` row tracks `requestsThisMonth`, `monthlyBudget`, `costAccrued`. Hard cap at budget × 1.5 unless operator overrides. Surface "X/1000 used" in admin.

3. **Refresh policy**:
   - **First view** of a property triggers fetch (one-time)
   - **Operator clicks refresh** → re-fetch (1/property/day limit)
   - **Nightly cron** refreshes 1/30th of org's properties — spreads cost
   - **Renewal-coming-up trigger** (60 days before lease end) → guaranteed fresh fetch
   - **Never proactive across new orgs** — Foundation tier or above only

## Surfaces (where RentCast appears, ranked by "premium feel" payoff)

### Tier S — flagship

**1. Property detail page (`/portal/properties/[id]`) — "Market intelligence" section**

Hero card layout (matches the design language of the Telegraph popup):
- **Value AVM card**: huge gold number, confidence band ("$540K – $580K"), data-source pill "via RentCast • updated 3d ago"
- **Rent gap bar**: "Your $1,500/mo is $180 below market." Horizontal bar showing current rent / market mid / market high, with the delta called out
- **Market temperature pill**: HOT / WARM / COOL based on days-on-market and listing velocity in the zip
- **Comparables strip**: 3 horizontally-scrolling cards, each = address + rent + bed/bath/sqft + a tiny image if available + distance
- **Refresh button**: 1 request per property per day, shows freshness timestamp

API cost: 2-3 calls per property per refresh window. Cached 30 days for rent / 60 for value.

**2. Renewal pricing intelligence (`/portal/renewals`)**

Upcoming-renewals table gets new columns:
- **Current rent** | **Market rent** | **Suggested renewal** | **Lift $/mo** | **Risk**
- Suggested renewal = `min(market_rent_mid, current_rent × 1.07)` (cap at 7% YoY to avoid retention risk)
- Bulk action: "Apply 12 renewals → +$4,820/mo portfolio lift" with revenue-projection preview
- Risk badges: "Below market $180/mo — raise opportunity" / "At market — hold" / "Above market $250/mo — retention risk"

API cost: 1 rent AVM call per upcoming-renewal property, cached 30 days.

**3. Acquisitions pipeline (new, `/portal/acquisitions`)**

Replaces the parked Zillow tool with something genuinely useful:
- **Quick analysis**: paste address → full investor card in <2s (value, rent, cap rate at 20/25/30% down, cash-on-cash, comps)
- **Pipeline view**: save analyzed properties to a per-org pipeline with stage (researching / under contract / passed / acquired)
- **CSV bulk import**: drop a list of addresses, get a sortable table of opportunities ranked by cap rate

API cost: 3 calls per address (value + rent + market). One-time, no recurring cost.

### Tier A — operator daily drivers

**4. Portfolio dashboard widget (`/portal`)**

Two new KPI tiles:
- **Portfolio asset value**: sum of value AVMs across portfolio, with QoQ delta
- **Rent gap opportunity**: sum of (market_rent - current_rent) across units priced below market, displayed as "$X/mo recoverable"

Both backed by cached snapshots — zero new API calls on dashboard render.

**5. AppFolio import enrichment**

When AppFolio sync creates a property with missing beds/baths/sqft/year built:
- Fire one `/v1/properties` call to backfill
- Cache 365 days
- Falls back gracefully if RentCast has no record

Cost: 1 call per new property, ever.

**6. Chatbot market intelligence**

Chatbot gets a new tool / system-prompt augment:
- When a lead asks "is this a fair price?" or "what's market like here?", chatbot answers with cached RentCast data
- Pulls market mid + comp count + listing velocity
- Frames it: "Our $1,500/mo is right at the market median. Comparable 2BR units nearby are listing between $1,420 and $1,620."

Cost: zero new calls (uses cached snapshots).

**7. Briefing / morning insights (`/portal/briefing`)**

Admin briefing surfaces:
- "5 properties up 6%+ in AVM this quarter — consider HELOC for cap-ex"
- "3 renewals next month priced below market — $1,840/mo lift available"
- "Submarket rent dropped 2.3% MoM — pause planned rent increases on Building X"

Cost: zero new calls (queries cached snapshots, no live API hits).

### Tier B — content / marketing

**8. Neighborhood landing pages (`/portal/seo/neighborhoods`)**

Existing neighborhood pages get auto-populated market stats:
- Hero band: "Median 1BR rent: $1,420 · Median 2BR: $1,890 · Days on market: 18"
- Updated monthly by cron
- Data feeds AEO claims so neighborhood pages become more citation-worthy

Cost: 1 markets call per neighborhood/month.

**9. Tenant-facing "competitive pricing" badge**

On tenant marketing site property pages: "Priced at market median" or "Below market — limited availability". Visitor trust signal.

Cost: zero new calls (uses cached snapshots).

### Tier C — pricing & export tools

**10. PDF "Why this price" sheet for leasing agents**

One-click export per property: branded one-pager with comp summary, market context, value justification. Pre-tour ammunition for sales.

**11. Investor PDF export for acquisitions**

For Tier S #3 — every saved acquisition gets a deck-ready PDF.

### Tier D — admin / billing

**12. RentCast usage dashboard (`/admin/integrations/rentcast`)**

Per-org request count, cost accrued, monthly forecast, cache hit rate. Hard caps configurable per org so a runaway tenant can't blow the budget.

## Student-housing-specific value

RentCast doesn't have a "student housing" filter, but the platform can:

- **Campus-distance overlay**: pair every comp with distance to nearest campus (Google Maps Distance Matrix or pre-computed lookup table)
- **3-4 bedroom comp filter**: most student rentals are roommate setups; filter comps to match
- **Academic-calendar awareness**: market refresh in Aug/Jan (lease cycle) more important than monthly average
- **Pre-lease pricing**: compare units 6+ months ahead of campus lease cycle with historical pricing on the same date last year
- **Sub-campus markets**: Berkeley vs Albany vs Emeryville comps look very different — let operator pin a `campusId` on properties for tighter comp matching

## Premium-feel design language

Every RentCast surface follows the same visual treatment so the platform feels like a single intelligence layer, not "API data dumped into a card":

1. **Hero metric cards** with bold large numbers + uppercase eyebrow + accent color (matches the Telegraph popup design)
2. **Confidence bands on AVMs** — always show low/mid/high range, not single point estimate
3. **Data freshness chips** — "Updated 3d ago • via RentCast Intelligence" — confidence + attribution
4. **Sparklines + trend arrows** on every time-series stat (12-month rent trend, value trend)
5. **Insights as sentences, not raw fields** — "You're $340/mo below market. That's $4,080/yr per unit." Not "rent_delta: 340"
6. **One-tap action chips** next to insights — "Apply suggested renewal" / "Add to pipeline" / "Email tenant"
7. **Smooth fade-in transitions** as data loads — never a jarring pop-in
8. **Empty states with utility** — "First time pulling market data for this property — takes ~1s" with a small loader, then content slides in
9. **Cross-references** — every comp links to the source listing, every neighborhood stat links to deep market page
10. **Branded "intelligence" voice** — always interpreted, never raw

## Build phases

**Phase 0 — Foundation (~1 day, FRIDAY-SHIPPABLE)**

Pre-work that everything else builds on:
- `RentCastSnapshot` Prisma model + migration
- `OrgRentCastUsage` model for budget tracking
- `lib/rentcast/client.ts` — typed wrapper for all 7 endpoints
- `lib/rentcast/cache.ts` — get-or-fetch with per-endpoint TTLs
- `lib/rentcast/budget.ts` — per-org tracking + 1.5× hard cap
- `lib/rentcast/normalize.ts` — address normalization (so cache keys collapse)
- `RENTCAST_API_KEY` env var (Vercel only, never committed)
- Tests covering cache hit/miss, budget tracking, address normalization, error paths

**Phase 1 — Property detail + Portfolio dashboard (~1 day, FRIDAY-SHIPPABLE if Phase 0 is solid)**

The flagship "premium feel" win:
- `/portal/properties/[id]` — "Market intelligence" section with value card + rent gap bar + market temp + 3-comp strip + refresh button
- `/portal` dashboard — portfolio asset value + rent gap opportunity tiles
- Backfill cron — refreshes 1/30th of org's properties nightly
- AppFolio enrichment — backfill attributes on new property creates

**Phase 2 — Renewals intelligence (~0.5 day, POST-LAUNCH)**

Highest-leverage operator value:
- `/portal/renewals` columns for current vs market vs suggested
- Bulk-apply with revenue projection
- Risk badges
- 60-day-pre-renewal refresh trigger

**Phase 3 — Acquisitions tool (~1 day, POST-LAUNCH)**

Replaces parked Zillow tool:
- `/portal/tools/value` (new path, leaves Zillow page alone)
- Pipeline view at `/portal/acquisitions`
- CSV bulk import
- PDF export

**Phase 4 — Content + chatbot + briefing (~1.5 day, POST-LAUNCH)**

Cross-cutting intelligence:
- Neighborhood page market-stats injection
- Chatbot market-data tool
- Briefing insights from cached snapshots
- Tenant-facing competitive pricing badge

**Phase 5 — Admin + billing (~0.5 day, POST-LAUNCH)**

`/admin/integrations/rentcast` dashboard for ops control over costs.

## Open questions for Adam

1. **Plan tier**: Free → Foundation ($74) is recommended for SG launch. OK to commit to Foundation, or stay free and pay overage during testing?
2. **Phase 0 + 1 scope for Friday**: do these two, or push everything to post-launch and ship SG without market intelligence?
3. **Student-housing campus distance**: Google Maps API key already in env, or do we ship without distance-to-campus in v1?
4. **Hard cap behavior**: when an org hits 1.5× monthly budget, do we (a) silently fall back to cache-only, (b) show "upgrade prompt", or (c) require admin override? Recommendation: (b) — feels premium, drives upsell.
5. **Tenant-facing market badge**: ship in v1 (Tier B #9) or hold for testing? Recommendation: hold — wait for operator approval per property to avoid surprises.
