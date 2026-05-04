-- Ad Library tracking — public Meta Ad Library snapshots per advertiser.

CREATE TYPE "AdLibrarySearchKind" AS ENUM ('PAGE_ID', 'SEARCH_TERM');

CREATE TABLE "AdLibraryAdvertiser" (
  "id"             TEXT NOT NULL,
  "orgId"          TEXT NOT NULL,
  "propertyId"     TEXT,
  "searchKind"     "AdLibrarySearchKind" NOT NULL,
  "searchValue"    TEXT NOT NULL,
  "displayName"    TEXT NOT NULL,
  "lastScannedAt"  TIMESTAMP(3),
  "lastScanError"  TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdLibraryAdvertiser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdLibraryAdvertiser_orgId_searchValue_key"
  ON "AdLibraryAdvertiser"("orgId", "searchValue");
CREATE INDEX "AdLibraryAdvertiser_orgId_idx" ON "AdLibraryAdvertiser"("orgId");
CREATE INDEX "AdLibraryAdvertiser_propertyId_idx"
  ON "AdLibraryAdvertiser"("propertyId");

ALTER TABLE "AdLibraryAdvertiser"
  ADD CONSTRAINT "AdLibraryAdvertiser_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdLibraryAdvertiser"
  ADD CONSTRAINT "AdLibraryAdvertiser_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AdLibraryAd" (
  "id"                 TEXT NOT NULL,
  "advertiserId"       TEXT NOT NULL,
  "externalId"         TEXT NOT NULL,
  "status"             TEXT NOT NULL,
  "creativeBody"       TEXT,
  "creativeTitle"      TEXT,
  "ctaText"            TEXT,
  "imageUrl"           TEXT,
  "videoUrl"           TEXT,
  "linkUrl"            TEXT,
  "impressionsLow"     INTEGER,
  "impressionsHigh"    INTEGER,
  "spendLow"           INTEGER,
  "spendHigh"          INTEGER,
  "currency"           TEXT,
  "publisherPlatforms" TEXT[],
  "adCreationTime"     TIMESTAMP(3),
  "adDeliveryStart"    TIMESTAMP(3),
  "adDeliveryStop"     TIMESTAMP(3),
  "raw"                JSONB,
  "firstSeenAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdLibraryAd_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdLibraryAd_advertiserId_externalId_key"
  ON "AdLibraryAd"("advertiserId", "externalId");
CREATE INDEX "AdLibraryAd_advertiserId_status_idx"
  ON "AdLibraryAd"("advertiserId", "status");

ALTER TABLE "AdLibraryAd"
  ADD CONSTRAINT "AdLibraryAd_advertiserId_fkey"
  FOREIGN KEY ("advertiserId") REFERENCES "AdLibraryAdvertiser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
