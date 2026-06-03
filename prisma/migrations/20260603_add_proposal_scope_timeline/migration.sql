-- Add scope narrative + delivery timeline to Proposal.
--
-- A proper proposal isn't just a price tag — it describes the work
-- the agency will deliver + when the prospect can expect it. Both
-- fields render on the PDF + share page between the title block and
-- the pricing tables.
--
-- Both NULL-safe; existing proposals continue to render correctly
-- (the PDF / share-page conditionally skip these sections when null).

ALTER TABLE "Proposal"
  ADD COLUMN "scopeNarrative" TEXT,
  ADD COLUMN "timeline"       JSONB;
