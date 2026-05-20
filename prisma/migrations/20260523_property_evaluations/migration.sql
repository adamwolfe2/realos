-- PropertyEvaluation — Acquisitions / Building Evaluator persistence.
--
-- Backs the /portal/tools/value surface. Each row captures a single
-- operator-initiated evaluation of a candidate building (paste an
-- address, optionally asking price + beds/baths/sqft, and we cache the
-- value AVM + rent AVM + market stats + investor math). The raw
-- RentCast payloads are persisted as JSON so the report card can be
-- re-rendered offline (no extra credits) and so future report shapes
-- can mine additional fields without re-fetching.
--
-- Tenancy: orgId Cascade so deletes flow with the workspace. userId
-- SetNull so deactivating a user preserves the historical record of
-- what was evaluated. archived is a soft-delete column; the recent-list
-- view defaults to non-archived.

CREATE TABLE "PropertyEvaluation" (
  "id"              TEXT       NOT NULL,
  "orgId"           TEXT       NOT NULL,
  "userId"          TEXT,

  -- Normalized cache-key form ("2410-telegraph-ave-berkeley-ca-94704")
  -- + original casing so we can re-display what the operator typed.
  "address"         TEXT       NOT NULL,
  "addressDisplay"  TEXT       NOT NULL,

  -- Optional inputs. Asking price drives cap rate / cash-on-cash; when
  -- null we fall back to the value AVM mid-point so the math still
  -- renders something sane.
  "askingPriceCents" INTEGER,
  "propertyType"    TEXT,
  "bedrooms"        INTEGER,
  "bathrooms"       DOUBLE PRECISION,
  "squareFootageInt" INTEGER,

  -- Raw RentCast responses (full payload — not the typed parser shape)
  -- so future enrichments can read additional fields. The server action
  -- writes whatever shape the typed parsers returned, which is a
  -- subset of the raw JSON.
  "valuePayload"   JSONB     NOT NULL,
  "rentPayload"    JSONB     NOT NULL,
  "marketPayload"  JSONB     NOT NULL,

  -- Output of lib/zillow/calculations::computeCalculations. Persisted
  -- so the recent-evaluations list can show cap rate / cash-on-cash
  -- without re-running math (and so the saved view is stable even if
  -- the math implementation changes later).
  "calculations"   JSONB     NOT NULL,

  "notes"          TEXT,
  "archived"       BOOLEAN   NOT NULL DEFAULT FALSE,

  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PropertyEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PropertyEvaluation_orgId_archived_createdAt_idx"
  ON "PropertyEvaluation"("orgId", "archived", "createdAt");

CREATE INDEX "PropertyEvaluation_userId_idx"
  ON "PropertyEvaluation"("userId");

ALTER TABLE "PropertyEvaluation"
  ADD CONSTRAINT "PropertyEvaluation_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropertyEvaluation"
  ADD CONSTRAINT "PropertyEvaluation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
