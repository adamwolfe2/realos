-- Add Organization.moduleMarketIntelligence — gates the RentCast comparables
-- panel on /portal/properties/[id]. Off by default per Norman feedback
-- (May 22): residential operators don't want rent-comp data surfaced
-- alongside digital-marketing dashboards. Agency operators flip it on
-- per tenant from /admin/clients/[id] when needed.
ALTER TABLE "Organization"
  ADD COLUMN "moduleMarketIntelligence" BOOLEAN NOT NULL DEFAULT false;
