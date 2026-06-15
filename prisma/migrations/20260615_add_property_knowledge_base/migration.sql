-- Structured per-property knowledge base (slice "Property Knowledge Base" S1).
-- One optional row per property feeding the chatbot grounded PROPERTY FACTS.
-- Additive, no backfill needed. Idempotent so `migrate deploy` is safe even
-- if applied to prod directly (Vercel build does not run migrate deploy).
CREATE TABLE IF NOT EXISTS "PropertyKnowledgeBase" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "floorPlans" JSONB,
    "communityAmenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unitAmenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "petPolicy" TEXT,
    "parkingInfo" TEXT,
    "laundryInfo" TEXT,
    "utilitiesIncluded" TEXT,
    "smokingPolicy" TEXT,
    "leaseTerms" TEXT,
    "depositInfo" TEXT,
    "currentSpecials" TEXT,
    "applicationProcess" TEXT,
    "applicationRequirements" TEXT,
    "neighborhoodInfo" TEXT,
    "transitInfo" TEXT,
    "tourInfo" TEXT,
    "additionalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PropertyKnowledgeBase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PropertyKnowledgeBase_propertyId_key" ON "PropertyKnowledgeBase"("propertyId");
CREATE INDEX IF NOT EXISTS "PropertyKnowledgeBase_orgId_idx" ON "PropertyKnowledgeBase"("orgId");

DO $$ BEGIN
  ALTER TABLE "PropertyKnowledgeBase" ADD CONSTRAINT "PropertyKnowledgeBase_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PropertyKnowledgeBase" ADD CONSTRAINT "PropertyKnowledgeBase_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
