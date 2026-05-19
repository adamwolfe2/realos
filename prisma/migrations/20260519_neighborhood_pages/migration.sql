-- NeighborhoodPage — operator-generated per-neighborhood landing pages
-- rendered on the tenant marketing site at /n/<slug>. Optimized for
-- ranking in Google search AND for being cited by AI answer engines.

CREATE TYPE "NeighborhoodPageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "NeighborhoodPage" (
    "id"              TEXT NOT NULL,
    "orgId"           TEXT NOT NULL,
    "propertyId"      TEXT,
    "city"            TEXT NOT NULL,
    "state"           TEXT,
    "neighborhood"    TEXT NOT NULL,
    "slug"            TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "intro"           TEXT NOT NULL,
    "sections"        JSONB NOT NULL,
    "faqs"            JSONB NOT NULL,
    "aiCitations"     JSONB,
    "status"          "NeighborhoodPageStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt"     TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NeighborhoodPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NeighborhoodPage_orgId_slug_key"
  ON "NeighborhoodPage"("orgId", "slug");

CREATE INDEX "NeighborhoodPage_orgId_status_idx"
  ON "NeighborhoodPage"("orgId", "status");

ALTER TABLE "NeighborhoodPage"
  ADD CONSTRAINT "NeighborhoodPage_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NeighborhoodPage"
  ADD CONSTRAINT "NeighborhoodPage_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
