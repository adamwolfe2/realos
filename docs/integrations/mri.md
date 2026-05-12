# MRI Software — Integration Plan

**Status:** Coming soon. Scoped at a high level only.

**Strategic priority:** Medium. MRI is dominant in commercial real
estate (office, retail, industrial); it has a residential product too
but loses to Yardi/RealPage there. We'd target MRI to expand into
commercial RE operators.

## API summary

MRI exposes a SOAP API and a partial REST API.

- Authentication: API user provisioned by the customer's MRI admin.
- Endpoint: `{customerInstance}.mrisoftware.com/api/`
- Format: SOAP/XML (legacy) or REST/JSON (newer modules only).
- Webhooks: limited.

## Provisioning flow

Similar to Yardi:

1. Customer's MRI admin creates a service account.
2. We get URL + username + password.
3. We test against `/api/properties` (REST) or the equivalent SOAP
   `getProperties` operation.

## Build estimate

Significantly more work than the others because:

- MRI is the most fragmented API across the major PMS players.
- The customer's product configuration (CommercialManagement vs.
  ResidentialManagement vs. Financials) determines which endpoints
  even exist.
- SOAP for the older entities means more verbose code.

**Total: ~10 days.** Lower priority than Yardi / Buildium / Entrata
unless we see strong commercial RE demand.

## Open questions

- **Commercial vs. residential.** Our property data model leans
  residential. MRI commercial customers need different surface
  (tenant rep info, square footage, lease abstract).
- **Module licensing.** A customer might have only the residential
  module licensed, only the commercial module, or both. Need detect.
