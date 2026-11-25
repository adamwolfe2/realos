-- SG portfolio cockpit data fixes. Additive only: one nullable column on
-- Listing (catalog-only change, no rewrite) and one new table. No existing
-- row is rewritten; the running app ignores both until the new code reads
-- them.

ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "listedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PropertyAvailabilityDaily" (
    "propertyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rooms" INTEGER NOT NULL,
    "units" INTEGER NOT NULL,
    "other" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyAvailabilityDaily_pkey" PRIMARY KEY ("propertyId", "date")
);

DO $$ BEGIN
  ALTER TABLE "PropertyAvailabilityDaily"
    ADD CONSTRAINT "PropertyAvailabilityDaily_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
