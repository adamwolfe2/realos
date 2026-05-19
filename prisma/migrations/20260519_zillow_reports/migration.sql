-- ZillowReport — operator-pasted Zillow listings parsed server-side into
-- a frozen snapshot plus pre-computed investor math. Lets operators
-- revisit a report later without re-fetching Zillow.

CREATE TABLE "ZillowReport" (
    "id"           TEXT NOT NULL,
    "orgId"        TEXT NOT NULL,
    "userId"       TEXT,
    "zillowUrl"    TEXT NOT NULL,
    "zpid"         TEXT NOT NULL,
    "payload"      JSONB NOT NULL,
    "calculations" JSONB NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZillowReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ZillowReport_orgId_createdAt_idx"
  ON "ZillowReport"("orgId", "createdAt");

ALTER TABLE "ZillowReport"
  ADD CONSTRAINT "ZillowReport_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
