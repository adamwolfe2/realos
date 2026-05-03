# Sync architecture — production-ready, cost-conscious "feels live"

## TL;DR

LeaseStack achieves a "real-time dashboard" feel without expensive
infrastructure (no Inngest, no websockets, no Pusher) by combining four
mechanisms — each chosen to match the underlying integration's update
cadence and cost profile.

| Mechanism | When it fires | Cost | Used for |
|---|---|---|---|
| **Webhooks (push)** | The moment an event occurs upstream | Free (one fn invocation per event) | Cursive pixel events, Stripe, Clerk, Resend bounces |
| **Vercel cron (pull)** | Fixed schedule | Free on Pro plan; bounded by `maxDuration` | AppFolio, Google Ads, Meta Ads, GA4, GSC, reputation scans |
| **Stale-on-load (pull)** | When an operator opens a stale page | One fn invocation per stale page-load, deduped per tab | Same set as cron; backfills the gap between cron ticks |
| **Client auto-refresh** | Every 15–45 s while a tab is open | DB read only (no integration API call) | Visitor feed (15s), dashboard (45s) |

## Hard rules (NO MORE FAKE DATA)

These are enforced in code, not just convention:

1. **`DEMO_MODE` cannot activate when `VERCEL_ENV=production` or
   `NODE_ENV=production`.** Guard lives in `lib/tenancy/scope.ts`. Even
   if the env var leaks into a prod env, unauthenticated traffic gets
   the normal sign-in flow — never a synthesized scope.
2. **`prisma/seed-demo.ts` requires three concurrent guards to clear**:
   `NODE_ENV !== "production"`, `VERCEL_ENV !== "production"`, AND an
   explicit `ALLOW_DEMO_SEED=true`. A fourth heuristic guard refuses
   when `DATABASE_URL` contains "prod" / "production" / "live" /
   "primary" unless `I_KNOW_THIS_IS_NOT_PROD=true` is also set.
3. **Per-page empty / stale / failed states are explicit.** Operations
   pages distinguish the four AppFolio sync states (not_connected,
   never_synced, syncing, synced+stale, failed) via
   `lib/integrations/appfolio-status.ts` and the matching banner
   component. Other integrations follow the same pattern via
   `lib/sync/freshness.ts`.

## Freshness budget per integration

Defined in `lib/sync/freshness.ts` → `FRESHNESS_BUDGET`.

| Integration | Stale after | Very stale after | Cron cadence |
|---|---|---|---|
| AppFolio | 1 h | 24 h | hourly |
| Google Ads | 30 m | 6 h | every 30 m |
| Meta Ads | 30 m | 6 h | every 30 m |
| GA4 | 6 h | 2 d | every 6 h |
| GSC | 1 d | 3 d | every 6 h (shared with GA4 cron) |
| Cursive pixel | 24 h *for the staleness banner only*; events themselves arrive in real time via webhook | 7 d | n/a (webhook-driven) |
| Reputation | 24 h | 7 d | daily |

If you tighten a freshness budget below the cron cadence, the page will
auto-trigger on every load — fine for low-traffic tenants, expensive for
busy ones. Default to `cron cadence × 2` when in doubt.

## Cost model

**Vercel functions on the Pro plan** (Adam's current account):

- Cron jobs are free up to 100 jobs/day per project. We use 18 cron
  paths; even the 30-min-cadence ones (ads-sync, lead-score-refresh,
  visitor-outreach) total well under that ceiling.
- On-demand (HTTP) function invocations: 1 M / month included.

**Per-tenant per-day estimate:**

| Source | Invocations / tenant / day |
|---|---|
| Cron AppFolio (1×/h, skip-if-fresh) | ~24 (some skipped) |
| Cron ads (2×/h) | ~48 |
| Cron SEO (4×/day) | 4 |
| Cron reputation (1×/day) | 1 |
| Stale-on-load AppFolio (1 active operator, 5 stale page-opens/day, deduped) | 5 |
| Auto-refresh (operator with dashboard open 30 min × 45s) | 40 (DB-only, no integration call) |
| Pixel webhook events | 100–10,000 depending on traffic |

For a 10-tenant account: ~120 cron invocations/hour at peak, well under
the Vercel limit. Pixel events dominate volume but each costs <50ms.

## On-demand sync — implementation

Components live under `components/portal/sync/`:

- `<StaleOnLoadTrigger endpoint=… dedupeKey=… />` — invisible client
  component that fires `fetch(endpoint, { method: "POST" })` once per
  tab session (sessionStorage-backed dedupe with a 60s cooldown), then
  calls `router.refresh()` 1.5s later. Drop it onto any server component
  that renders integration-backed data.

- `<AutoRefresh intervalMs />` — invisible client component that calls
  `router.refresh()` on a fixed interval. Use 15s for high-velocity
  pages (visitors), 30–45s for dashboards.

API endpoints:

- `POST /api/tenant/appfolio/sync` — tenant-scoped, runs the full REST
  sync (or embed-fallback scrape) and returns `AppfolioSyncStats`. Used
  by both the manual "Run sync" button and the `<StaleOnLoadTrigger>`.

To wire up a new integration:

1. Add the key + budget to `FRESHNESS_BUDGET` in `lib/sync/freshness.ts`.
2. Add a `lib/integrations/<name>-status.ts` helper returning a
   `{ state, lastSyncAt, lastError, … }` shape per the existing AppFolio
   pattern.
3. Add an `app/api/tenant/<name>/sync/route.ts` endpoint that wraps the
   existing sync function with `requireScope()` + a status JSON return.
4. Build a status banner component that drops in `<StaleOnLoadTrigger>`
   when `classifyFreshness(...).shouldAutoTrigger` is true.

## Webhooks (the actual real-time path)

Already wired and working in production:

- `POST /api/webhooks/cursive` and `/api/webhooks/cursive/[token]` —
  pixel events stream in here from AudienceLab/Cursive in real time.
  No polling needed — the visitor feed sees them within seconds.
- `POST /api/webhooks/stripe` — billing events.
- `POST /api/webhooks/clerk` — user lifecycle.
- `POST /api/webhooks/resend` — bounce / complaint tracking.

AppFolio does **not** offer webhooks (Developer Portal limitation), so
all AppFolio data is pull-only. This is the only major integration
where the freshness budget actually matters; everything else
self-updates.

## What you should NOT do

- ❌ Do not add Inngest / BullMQ / a websocket layer. Vercel cron +
  on-demand triggers + router.refresh covers the full surface area
  without recurring infra cost.
- ❌ Do not add a polling loop on the client that hits an integration
  API directly. All polling goes through our Server Components so the
  DB is the single source of truth and webhooks/crons stay
  authoritative.
- ❌ Do not seed demo data into a tenant's actual production org. If
  you need a demo surface, spin up a Neon branch (free) and point
  `DATABASE_URL` at it.
- ❌ Do not soften the `DEMO_MODE` production guard in
  `lib/tenancy/scope.ts`. It exists so an env-var typo can't leak
  synthetic scopes to real users.

## Future work

- Extend the on-demand sync pattern to ads + SEO so opening
  `/portal/campaigns` or `/portal/seo` on stale data triggers a refresh.
  Same pattern as AppFolio; about 30 minutes of work per integration.
- Per-tenant adaptive cadence: tenants with no leads in 30 days don't
  need ads synced every 30 min. Add `nextSyncAt` to the integration
  rows and skip when the org is dormant.
- Surface the freshness verdict (fresh / stale / very_stale / missing)
  as a chip on the dashboard's Integration Health bar so operators see
  at a glance which data is current.
