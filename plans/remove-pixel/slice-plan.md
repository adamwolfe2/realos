# Remove the visitor pixel (and Audiences) completely

Decided by Adam 2026-10-11: no more pixel for anyone, current customers included. Remove it "like it never existed".
Answers: Audiences / AUDIENCE_SYNC / AL_PARTNER go too. Pixel-sourced leads stay as normal leads (source relabeled, visitor link dropped).
DB: ship the code removal first, then take a Neon backup branch and drop the tables in a final migration, run only after Adam confirms.

## Brief
- Invariant: no operator, prospect or admin surface mentions or depends on the pixel, visitors or audiences; leads, chatbot, ads, SEO, billing keep working unchanged.
- Unsafe outcomes: deleting real leads; breaking lead capture, chatbot, billing or tenant sites; a dropped table still read by live code; Stripe subscriptions referencing a removed price.
- Out of scope: the lead marketplace (sellers/buyers, `lib/marketplace/cursive-sync.ts`). It also pulls Cursive segments but it is a separate product. Ask Adam separately. Popups stay (not pixel).
- Removing tests for deleted code is intentional, not weakening. Tests for surviving code are only edited where they assert pixel behavior.

## Progress
| Slice | Status | Risk |
|---|---|---|
| S1 Marketing, pricing, catalogs, product claims | in_progress | T2 (customer-facing copy, billing catalog) |
| S2 Portal, APIs, crons, webhooks, lib, tests | pending | T1 (lead capture paths touch Lead.visitorId) |
| S3 Admin surfaces, AL_PARTNER role, AUDIENCE_SYNC product line in code | pending | T1 (roles) |
| S4 DB: backup branch, relabel PIXEL_OUTREACH leads, null visitorId, drop tables/columns/enums | blocked: needs Adam's go at run time | T1 (destructive) |

## Slices
- S1: delete `app/(platform)/features/pixel`, `app/(platform)/audiences`, home/platform pixel components and artifacts; strip pixel/visitor-ID/audience copy from homepage, pricing, features, FAQ, comparison, product-claims, `lib/billing/features.ts`, `lib/marketplace/catalog.ts`, proposals, sitemap, site-engine data. Accept: grep of marketing surfaces for pixel/visitor ID/audience returns nothing; build green.
- S2: delete `app/portal/{visitors,audiences}`, `app/api/{tenant/visitors,portal/pixel,ingest/visitor,webhooks/cursive}`, crons `pixel-segment-sync`, `pixel-weekly-digest`, `run-audience-syncs` (+ vercel.json), `lib/{visitors,pixel,audiences}`, cursive libs/actions/emails, pixel insight detectors, `components/{pixel,audiences,portal/visitors}`, pixel tests. Fix every importer: nav, cmd-K registry, dashboard funnel (drop Visitors stage), settings integrations, notification toggles, onboarding/setup/welcome steps, lead detail visitor panel, attribution, reports, tenant layout loader, lead-notify pixel channel. Accept: tsc 0, vitest green, build green, no live code reads the pixel models.
- S3: delete `app/admin/{pixel,pixel-requests}`, cursive panel; remove AL_PARTNER and AUDIENCE_SYNC handling from scope/roles/admin client creation. Accept: role tests green; agency/client gates unchanged.
- S4: Neon backup branch; migration: `UPDATE Lead SET source=OTHER WHERE source=PIXEL_OUTREACH`, null `visitorId`, drop Visitor/VisitorSession/VisitorEvent/CursiveIntegration/PixelProvisionRequest/Audience* tables, pixel columns on Organization/Property/etc., enums. Run in prod only on Adam's explicit go.
