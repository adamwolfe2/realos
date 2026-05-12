# RealPage / OneSite — Integration Plan

**Status:** Coming soon. Scoped, not yet built.

**Strategic priority:** High for enterprise multifamily + student. RealPage
(OneSite, OneSite Leasing & Rents, OneSite Facilities) competes with
Yardi at the top end of the market.

## API summary

RealPage's API is exposed through the **Enterprise Data Exchange (EDX)**.

- Authentication: tenant ID + API key, plus a CSM-coordinated enabling
  step on RealPage's side. Not self-serve.
- Endpoints: `https://api.realpage.com/v1/`
- Format: REST + JSON.
- Rate limit: customer-dependent (set during EDX enablement).
- Webhooks: yes, registered via the EDX portal.

## Provisioning flow

RealPage integrations are the slowest to onboard:

1. Customer requests EDX access through their RealPage CSM.
2. RealPage provisions credentials + grants access to specific
   entities (often we have to negotiate access to e.g. work orders
   separately from leases).
3. We hand the customer the EDX manifest of what we need; they get
   it approved internally.
4. Credentials land 1–3 weeks after request.

This is why RealPage stays "coming soon" for longer than the others.

## Entity mapping

| RealPage entity        | Maps to LeaseStack | Notes                            |
|------------------------|--------------------|----------------------------------|
| `Property`             | `Property`         |                                  |
| `Unit`                 | `Listing`          |                                  |
| `Lease`                | `Lease`            | OneSite has rich lease metadata  |
| `Resident`             | `Resident`         |                                  |
| `Prospect`             | `Lead`             |                                  |
| `WorkOrder`            | `WorkOrder`        | OneSite Facilities module        |
| `Tour` / `Showing`     | `Tour`             | Self-guided tour data            |

## Sync strategy

- **Webhooks** for lease + work order events (registered via EDX).
- **Polling** every 30 minutes for prospects + tours.
- **Nightly full sync** for property + unit drift.

## Build estimate

- REST client + auth — 1 day
- Entity mappers — 2 days
- Webhook handler + signature verification — 1 day
- Sync runner + cron — 1 day
- UI + onboarding wiring — 0.5 day
- End-to-end test against sandbox — 1.5 days

**Total: ~7 days.** Slower than Buildium because of the EDX
provisioning dance.

## Open questions

- **OneSite vs. OneSite Leasing & Rents vs. OneSite Facilities.**
  These are sold as separate modules; not every customer has all
  three. Need to gracefully detect which modules they're licensed for.
- **Pricing model implications.** RealPage customers expect enterprise
  contracts. They may not be a fit for self-serve LeaseStack Foundation
  / Growth — likely Scale + Enterprise only.
