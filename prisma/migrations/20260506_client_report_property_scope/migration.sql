-- Add optional propertyId scope to ClientReport so multi-property tenants
-- can generate per-property reports instead of always-portfolio rollups.
-- NULL = org-wide report (legacy behavior, default).

ALTER TABLE "ClientReport"
  ADD COLUMN "propertyId" TEXT;

ALTER TABLE "ClientReport"
  ADD CONSTRAINT "ClientReport_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ClientReport_orgId_propertyId_generatedAt_idx"
  ON "ClientReport" ("orgId", "propertyId", "generatedAt" DESC);
