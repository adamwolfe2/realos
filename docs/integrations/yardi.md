# Yardi Voyager / Breeze / Genesis2 — Integration Plan

**Status:** Coming soon. Scoped, not yet built.

**Strategic priority:** Highest. Yardi has the deepest enterprise
multifamily install base and is the single biggest blocker for moving
LeaseStack out of AppFolio-only operators.

## Product variants we'd support

Yardi sells three distinct property-management products. Same parent
company, different APIs:

| Product              | Auth mode                  | API surface                                   |
|----------------------|----------------------------|-----------------------------------------------|
| **Voyager 7S**       | SOAP API + Web Services    | Full ERP — accounting, leasing, ops          |
| **Voyager Genesis2** | SOAP API + REST            | Mid-market; subset of 7S                     |
| **Breeze / Breeze Premier** | REST (limited)      | SMB; fewer entities exposed                  |

The biggest target by AUM is Voyager 7S. Breeze customers tend to
prefer simpler tools and may not pay for the LeaseStack stack; Genesis2
sits in the middle.

## Auth model

Voyager uses a per-database service account. To enable LeaseStack:

1. The customer's Yardi admin provisions a service account (typically
   named `leasestack_integration` or similar) with read access to the
   relevant database.
2. Customer hands us four credentials:
   - **Server URL** (`https://{instance}.yardione.com` for hosted, or
     a self-hosted URL for on-prem)
   - **Database name** (e.g. `voyager_live`)
   - **Username**
   - **Password**
3. We hit the SOAP endpoint at `{ServerUrl}/Voyager{Version}/WebServices/ITFTenant.asmx`
   or the REST equivalent at `{ServerUrl}/api/{version}/`.

Some larger Yardi deployments also gate API access behind their
Interface system. We'd need a one-time setup call with the customer's
Yardi admin to walk through provisioning before the connector goes live.

## Entity mapping

The core entities we'd pull:

| Yardi entity            | Maps to LeaseStack         |
|-------------------------|----------------------------|
| `Property`              | `Property`                 |
| `Unit`                  | `Listing`                  |
| `Tenant` / `Resident`   | `Resident`                 |
| `LeaseChargeSchedule`   | `Lease`                    |
| `ServiceRequest`        | `WorkOrder`                |
| `Prospect`              | `Lead` (rented to convert) |
| `Tour` (custom forms)   | `Tour` (best-effort)       |

Yardi's data model is wider and more configurable than AppFolio's, so
the mapper will need to handle per-tenant `chargeCode`, `prospectType`
custom fields, and similar variations.

## Sync strategy

Voyager's SOAP API doesn't support webhooks. We'd:

1. Run a full sync nightly via `runYardiSync()` (cron at 3am Eastern).
2. Run targeted polls every 15 minutes on the entities that change
   often (prospects, lease activity, service requests).
3. Cache the underlying responses with `Cache-Control` headers + a
   `lastChangedAt`-style filter to keep API call volume low.

For Breeze (REST-only), we can poll the same way but at lower frequency
since the API has rate limits.

## Build estimate

- **SOAP client + auth** — 1 day
- **Entity mappers (properties, units, residents, leases)** — 2 days
- **Sync runner + cron** — 1 day
- **UI for connection + first-sync feedback** — 0.5 day
- **End-to-end test against a customer's sandbox** — 1 day

**Total: ~5–6 days of focused engineering.** Could ship faster if we
limit v1 to Properties + Units + Residents and defer work-orders to v2.

## Open questions

- **Multi-database Yardi tenants.** Some customers run multiple
  Voyager databases (e.g. one per regional ownership entity). Do we
  want to support multi-DB on a single LeaseStack workspace or insist
  on one workspace per database?
- **API call volume.** Voyager has soft per-day call limits depending
  on the customer's Yardi contract. Need to design our sync to stay
  under those without sacrificing freshness.
- **Self-hosted Voyager.** A meaningful share of large Yardi customers
  still run on-prem. Our cron service needs to reach their VPN — likely
  via a Tailscale exit node or a customer-installed sync agent.
