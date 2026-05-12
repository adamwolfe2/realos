# AppFolio — Integration Plan

**Status:** Live. Self-serve onboarding works today.

**Source:** `lib/integrations/appfolio.ts`, `lib/integrations/appfolio-sync.ts`,
`lib/actions/appfolio-connect.ts`.

## Connection modes

AppFolio offers two access paths depending on the customer's plan tier:

### 1. Embed mode (Property Manager Core)

Core customers don't get Developer Portal credentials. Instead we
scrape the public listings page at
`https://{subdomain}.appfolio.com/listings` with `cheerio`.

- **What we get:** listing metadata (unit, beds, baths, price,
  availability, photos), plus the property name.
- **What we don't get:** residents, leases, work orders,
  applications, accounting. Anything not public.
- **How customer connects:** subdomain only.

This is the default path. ~90% of AppFolio customers come in this way.

### 2. REST v2 mode (Plus / Max)

Plus and Max customers can request access to the Developer Portal,
which gives us clientId + clientSecret for the v2 REST API.

- **What we get:** the full v2 surface — properties, units, residents,
  leases, work orders, delinquency, prospects, communications.
- **How customer connects:** subdomain + clientId + clientSecret.

The same `connectAppfolio` server action handles both paths; mode is
detected by whether clientId + clientSecret were provided.

## Entities synced (REST mode)

| AppFolio entity            | LeaseStack model    |
|----------------------------|---------------------|
| `properties.directory`     | `Property`          |
| `unit_directory`           | `Listing`           |
| `tenant_directory`         | `Resident`          |
| `tenant_directory`         | `Lease` (via tenant)|
| `work_order_directory`     | `WorkOrder`         |
| `delinquency`              | `Lead` flag         |
| `vacant_units`             | `Listing.isAvailable`|

## Sync frequency

- **Full sync nightly** at 3am local-time-of-property via
  `runAppfolioSync()` (called from the daily cron).
- **Manual sync** available from `/portal/integrations` via the
  `triggerAppfolioSync` server action.
- **Incremental sync** every 30 minutes for `unit_directory` (drives
  the live availability widget).

## Known gotchas

- AppFolio's `unit_directory` doesn't expose bedrooms / bathrooms /
  unitType for some unit configurations (notably per-room student
  housing). Norman flagged this; the per-unit listings table now
  hides those columns when 100% empty and surfaces a sync-gap banner.
- `Property.lastSyncedAt` is updated at the end of the sync run; if
  the sync fails partway through, the timestamp doesn't move.
- Embed mode is **rate-limited by AppFolio's CDN**, not by us. Heavy
  scrape activity gets us 429'd; we back off exponentially.

## Disconnection

`disconnectAppfolio` clears the AppFolioIntegration row and stops
the daily sync. Existing Property + Listing + Resident rows stay (they
were the customer's data, not just AppFolio's view of it). Customer
can reconnect anytime without data loss.
