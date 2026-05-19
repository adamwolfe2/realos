-- AEO ↔ NeighborhoodPage link.
--
-- Extends AeoCitationCheck with a neighborhoodPageId (nullable) and a `claim`
-- column capturing the raw declarative claim from
-- NeighborhoodPage.aiCitations[] that the prompt was derived from. Lets us
-- group citation checks by claim in the neighborhood-page editor's
-- "AI citation health" panel.
--
-- Touched by:
--   * prisma/schema.prisma (AeoCitationCheck, NeighborhoodPage)
--   * lib/aeo/orchestrate.ts (runNeighborhoodScan)
--   * lib/aeo/prompts-neighborhood.ts (claim → prompt rewriter)
--   * app/api/portal/seo/neighborhoods/[id]/scan/route.ts (on-demand)
--   * app/api/cron/aeo-scan/route.ts (weekly sample scans)
--   * app/portal/seo/neighborhoods/[id]/page.tsx (citation health panel)

ALTER TABLE "AeoCitationCheck"
  ADD COLUMN "neighborhoodPageId" TEXT,
  ADD COLUMN "claim" TEXT;

CREATE INDEX "AeoCitationCheck_neighborhoodPageId_queryRunAt_idx"
  ON "AeoCitationCheck"("neighborhoodPageId", "queryRunAt");

ALTER TABLE "AeoCitationCheck"
  ADD CONSTRAINT "AeoCitationCheck_neighborhoodPageId_fkey"
  FOREIGN KEY ("neighborhoodPageId") REFERENCES "NeighborhoodPage"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
