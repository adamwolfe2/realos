# PMS Integrations

LeaseStack is built to operate on top of whichever property management
system a customer already uses. AppFolio is live today; this folder
captures the implementation plan for every connector we've scoped.

## Status taxonomy

The `status` field on each connector (see `lib/integrations/pms/registry.ts`)
controls UI gating across the onboarding wizard:

| Status        | UI behavior                                          | Build state                           |
|---------------|------------------------------------------------------|----------------------------------------|
| `live`        | Inline auth form, customers self-serve connect       | Fully implemented, in production       |
| `beta`        | Form visible but flag warns we provision credentials | Working but requires our team's hand-off |
| `coming_soon` | Card shows logo + "Notify me" button; collects interest | Scoped; not yet built                |
| `manual_only` | Customer skips PMS and manages properties by hand    | No connector planned                   |

## Live connectors

- [AppFolio](./appfolio.md) — Property Manager Core (embed) + Plus/Max (REST v2)

## Scoped connectors (coming soon)

These are the PMS platforms we've scoped to varying levels of detail.
Order roughly mirrors strategic priority for the multifamily + student
housing operators we sell to.

- [Yardi Voyager](./yardi.md) — Voyager 7s, Breeze, Genesis2
- [Buildium](./buildium.md) — SMB-focused; clean REST API
- [Entrata](./entrata.md) — Multifamily + student housing at scale
- [RealPage / OneSite](./realpage.md) — Enterprise multifamily / student
- [MRI Software](./mri.md) — Commercial + residential enterprise
- [ResMan](./resman.md) — Multifamily mid-market
- [Propertyware](./propertyware.md) — Single-family rental focus

## How to graduate a connector from "coming soon" to "live"

1. Implement the connector in `lib/integrations/{pms_id}/` following the
   AppFolio pattern: a client module (auth + raw API calls), a sync
   runner module (the equivalent of `appfolio-sync.ts`), and entity
   mappers (the equivalent of `mapListingPayload` etc.).
2. Add a server action under `lib/actions/{pms_id}-connect.ts` mirroring
   `appfolio-connect.ts`'s `connect{Pms}` / `disconnect{Pms}` /
   `trigger{Pms}Sync` shape.
3. Wire the connect action into `/api/onboarding/wizard/integrations`'s
   `connect_pms` branch.
4. Flip the registry entry's `status` from `coming_soon` to `live`.
5. Update the corresponding entity sync tests, then deploy.

The UI requires no changes — the registry is the contract.

## What every connector needs to provide

Each PMS connector is responsible for these operations, in priority
order. Some PMS platforms expose more (rent-roll budgets, accounting),
but these eight are the minimum viable surface for LeaseStack's value
proposition (listings + leads + leasing automation).

| Capability                  | Why we need it                                    |
|-----------------------------|---------------------------------------------------|
| **Property directory**      | Drives the property list, dashboard rollups       |
| **Unit / listing directory**| Drives the live availability widget + chatbot     |
| **Resident roster**         | Powers the resident portal + renewal pipeline     |
| **Lease records**           | Powers rent roll + occupancy + renewal triggers   |
| **Work orders**             | Powers the maintenance dashboard                  |
| **Applications**            | Powers the application funnel                    |
| **Tours / showings**        | Powers the tour calendar                          |
| **Webhooks (or poll fallback)** | Keeps everything fresh without hammering APIs |

If a PMS doesn't expose a capability, we degrade gracefully (e.g.
AppFolio Core doesn't expose tours, so we collect them via our own
public booking form instead).
