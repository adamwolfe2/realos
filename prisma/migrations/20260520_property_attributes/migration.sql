-- Property attributes — Norman feedback (issue #68).
--
-- Adds two new operator-editable attributes to Property so the
-- portfolio table + filter UI (issue #54) can group / segment
-- properties by category and free-form profile tags. Asset class
-- and size band are derived from existing columns:
--   - Asset class  ← residentialSubtype / commercialSubtype + propertyType
--   - Size band    ← totalUnits (0-25 / 26-50 / 51-100 / 101-250 / 251-1000)
--
-- New fields:
--   - assetCategory:  free-form short label that depends on asset class
--                     (e.g. "dorm-style", "apartment-style", "warehouse")
--   - profileTags:    operator-curated tag array
--                     (e.g. {"affordable","near campus","downtown"})
--
-- Both are nullable / empty by default so existing rows survive without
-- a backfill. The properties list filter UI degrades to "no tag" when
-- the field is empty.

ALTER TABLE "Property"
  ADD COLUMN "assetCategory" TEXT,
  ADD COLUMN "profileTags"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- GIN index on profileTags so filter chips ("show me everything tagged
-- 'near campus'") stay O(matches) instead of O(total rows). Most queries
-- will use the @> contains operator which GIN handles natively.
CREATE INDEX IF NOT EXISTS "Property_profileTags_idx"
  ON "Property" USING GIN ("profileTags");

-- Plain btree index on assetCategory for the equality filter
-- (`WHERE assetCategory = 'dorm-style'`).
CREATE INDEX IF NOT EXISTS "Property_assetCategory_idx"
  ON "Property" ("assetCategory");
