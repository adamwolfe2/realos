# Entrata — Integration Plan

**Status:** Coming soon. Scoped, not yet built.

**Strategic priority:** High for student housing + multifamily-at-scale.
Entrata is the dominant PMS for class-A student housing operators and
the largest multifamily portfolios; Yardi competes head-to-head here.

## API summary

Entrata's API is HTTP+XML. The endpoint base is
`https://api.entrata.com/utils/getEndpointDetails`.

- Authentication: API username + API password, transmitted in the XML
  envelope under `<auth>`.
- Access is gated behind Entrata's **Integration Partner Program**.
  We're already enrolled; customer credentials still take ~3 business
  days to provision through Entrata's ops.
- Rate limit: roughly 60 requests/minute per partner per customer.
- Response format: XML or JSON (we prefer JSON via `?responseType=json`).
- Documentation: gated developer portal; reference docs available to
  enrolled partners.

## Provisioning flow

1. Customer hands us their Entrata API username + password (theirs to
   share since we're an enrolled partner).
2. We ping `GET /api/properties/getProperties` to validate.
3. Entrata's account team is in the loop on the partner side; the
   customer typically doesn't have to do anything new beyond enabling
   our integration in their Entrata admin panel.

## Entity mapping

| Entrata endpoint              | Maps to LeaseStack | Notes                          |
|-------------------------------|--------------------|--------------------------------|
| `getProperties`               | `Property`         | Pull `propertyId` + addresses  |
| `getMarketingPreferences`     | `Listing` metadata | Marketing flags per property   |
| `getResidents`                | `Resident`         | Filter to `currentResident`    |
| `getLeases`                   | `Lease`            | Active + future leases         |
| `getWorkOrders`               | `WorkOrder`        | `status=open` filter           |
| `getApplications`             | Application funnel | Highly nuanced — see below     |
| `getMarketingFollowups`       | `Lead`             | The closest thing to leads     |
| `getTours`                    | `Tour`             | Includes self-guided tour info |

## Application funnel nuance

Entrata's application data model is famously deep. A single applicant
goes through `prospect` → `application` → `lease_signed` → `move_in`
stages with sub-stages for guarantor approval, deposit collection, etc.
Our v1 collapses this into the LeaseStack `Lead` + `Lease` shape.
Customers who want the deep funnel surface will see fewer Entrata
states than they're used to; we'd ship a v2 that exposes the richer
state machine via a dedicated Entrata-only tab.

## Sync strategy

- **Full sync** nightly (3am Eastern).
- **Incremental sync** every 15 minutes for leads + applications.
- Entrata supports webhooks for some events but the configuration
  surface is messy; we'll start with polling.

## Build estimate

- XML/JSON client + auth — 1 day
- Entity mappers (especially Application) — 2.5 days
- Sync runner + cron — 1 day
- UI + onboarding wiring — 0.5 day
- End-to-end test — 1 day

**Total: ~6 days.** Application funnel is the biggest variable.

## Open questions

- **Property-group hierarchies.** Entrata supports nested property
  groups (portfolio > region > property). LeaseStack is flat; we'd
  need to decide whether to surface the hierarchy or normalize.
- **Lease state machine.** Do we expose Entrata's full state machine
  somewhere or stay simple and collapse to active/pending/moving?
