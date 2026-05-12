# Propertyware — Integration Plan

**Status:** Coming soon. Scoped at a high level only.

**Strategic priority:** Lower. Propertyware (RealPage-owned) dominates
the **single-family rental** segment. We'd target SFR-focused operators
expanding into LeaseStack from Propertyware.

## API summary

Propertyware exposes a REST API.

- Authentication: API key per customer.
- Endpoint: `https://api.propertyware.com/v1/`
- Format: JSON.
- Webhooks: limited; polling-first.

## Provisioning flow

Customer-side:

1. Owner / portfolio manager generates an API key in Propertyware
   settings.
2. Hands it to us.
3. We validate against `GET /properties`.

Faster than RealPage despite the same parent company.

## Entity mapping (high level)

Same shape as Buildium. The big difference is the unit grain: in SFR,
"property" and "unit" are usually 1:1, so our existing one-property-
to-many-units model is a slight over-engineering. That's not a blocker
for the connector — just a note for marketing copy.

## Build estimate

- REST client + auth — 0.5 day
- Entity mappers — 1 day
- Sync runner + cron — 0.5 day
- UI + onboarding wiring — 0.5 day
- End-to-end test — 0.5 day

**Total: ~3 days.**
