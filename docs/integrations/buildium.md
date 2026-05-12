# Buildium — Integration Plan

**Status:** Coming soon. Scoped, not yet built.

**Strategic priority:** High. Buildium owns the SMB end of the market
(typically 50–500 unit operators) and its API is among the cleanest of
the major PMSes, so it's the second-fastest integration to ship after
the AppFolio v2 REST one we already have.

## API summary

Buildium exposes a single REST API at `https://api.buildium.com/v1`.

- Authentication: API client ID + API client secret, sent as
  `x-buildium-client-id` and `x-buildium-client-secret` headers.
- The Open API plan tier is **required** for API access. Customers
  on the standard Premium plan have to call Buildium to enable it.
- Rate limit: 50 requests/minute per API client, 5,000 requests/day.
- Pagination: cursor-based via `offset` + `limit` (max 1000 per page).
- Response format: JSON.

## Provisioning credentials

Customer steps:

1. Sign in to Buildium as the account owner.
2. Settings → Application settings → API keys.
3. "Create API key" → name it `LeaseStack`.
4. Buildium displays the client ID + client secret once. Customer
   pastes both into our onboarding flow.

We then validate the credentials by calling `GET /rentals/properties`
with `limit=1`; success = green check, 401 = invalid creds, anything
else = surface the API error to the operator.

## Entity mapping

| Buildium endpoint                | Maps to LeaseStack       | Notes                              |
|----------------------------------|--------------------------|------------------------------------|
| `GET /rentals/properties`        | `Property`               | One per building                   |
| `GET /rentals/units`             | `Listing`                | Filter by `PropertyId`             |
| `GET /leases`                    | `Lease`                  | Filter by `Status=Active`          |
| `GET /tenants`                   | `Resident`               | Cross-reference active leases      |
| `GET /tasks`                     | `WorkOrder`              | `Category=Maintenance` filter      |
| `GET /applicants`                | `Lead` (via mapping)     | Optional; depends on customer flow |
| `GET /tenants/{id}/notes`        | Used for chatbot context | Optional                           |

## Sync strategy

Buildium has limited webhook support (only for new tasks). For
everything else we poll:

- **Full sync** nightly (3am customer-local).
- **Incremental sync** every 30 minutes using the
  `LastUpdatedDateTimeFrom` filter where available.
- **Real-time** for new maintenance tasks via the webhook endpoint
  we'd register at `/api/webhooks/buildium`.

## Build estimate

- REST client + auth — 0.5 day
- Entity mappers — 1 day
- Sync runner + cron — 0.5 day
- Webhook handler for tasks — 0.5 day
- UI + onboarding wiring — 0.5 day
- End-to-end test — 0.5 day

**Total: ~3 days.** Fastest integration to ship after AppFolio.

## Open questions

- **Custom fields.** Buildium lets customers define custom fields on
  every entity. Our v1 ignores them; v2 should let operators pick
  which custom fields surface in the dashboard.
- **Multi-portfolio.** Buildium supports multiple portfolios under one
  account. Need to decide whether we sync all portfolios into one
  LeaseStack workspace or require one workspace per portfolio.
