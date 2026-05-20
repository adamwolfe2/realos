-- Module parity pass — bring the admin toggle list and the schema in
-- sync with what the portal sidebar already exposes. Each new flag
-- gates a portal surface that was previously always-on (or hidden by
-- a soft data-presence check) so operators can flip features on per
-- tenant without code changes.
--
-- New flags:
--   moduleReputation     → /portal/reputation
--   moduleInsights       → /portal/insights, /portal/briefing, /portal/reports
--   moduleAttribution    → /portal/attribution
--   moduleResidents      → /portal/residents, /portal/renewals,
--                          /portal/work-orders, /portal/applications
--   moduleTours          → /portal/tours
--   moduleConversations  → /portal/conversations
--
-- All default false. The admin client detail page exposes them as
-- toggles so the agency can enable each module per tenant. See
-- app/admin/clients/[id]/page.tsx and lib/actions/admin-modules.ts.

ALTER TABLE "Organization"
  ADD COLUMN "moduleReputation"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "moduleInsights"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "moduleAttribution"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "moduleResidents"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "moduleTours"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "moduleConversations" BOOLEAN NOT NULL DEFAULT false;
