# ResMan — Integration Plan

**Status:** Coming soon. Scoped at a high level only.

**Strategic priority:** Medium. ResMan is popular with mid-market
multifamily operators (50–10,000 units) and routinely shows up in our
sales conversations as the existing PMS for prospects too small for
Yardi but too sophisticated for Buildium.

## API summary

ResMan exposes a REST API.

- Authentication: API key per integration partner + a per-customer
  account ID.
- Endpoint: `https://api.myresman.com/`
- Format: JSON (newer endpoints) and XML (legacy).
- Webhooks: yes, via their Marketplace partner program.

## Provisioning flow

ResMan requires partner enrollment:

1. We submit a Marketplace partner application (one-time).
2. Customer provides their AccountID and approves our integration
   inside ResMan's settings.
3. We get a partner-scoped API key + the customer-specific AccountID.

Faster than RealPage but slower than Buildium.

## Build estimate

- REST client + auth — 0.5 day
- Entity mappers — 1.5 days
- Webhook handler — 0.5 day
- Sync runner + cron — 0.5 day
- UI + onboarding wiring — 0.5 day
- End-to-end test against sandbox — 0.5 day

**Total: ~3.5 days.**
