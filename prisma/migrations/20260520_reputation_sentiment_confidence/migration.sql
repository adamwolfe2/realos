-- Reputation sentiment confidence.
-- Adds a confidence score (0..1) alongside the existing PropertyMention.sentiment
-- column so the unified reputation dashboard can:
--   * fade low-confidence pills,
--   * threshold negative-mention alerts on confidence ≥ 0.7,
--   * and let Claude express uncertainty on borderline content.
--
-- We intentionally keep PropertyMention.topics (Json) as the "themes" array —
-- existing rows are already populated through lib/reputation/analyze.ts and
-- renaming would force a destructive backfill. The UI surfaces it as "Themes".
--
-- Touched by:
--   * lib/reputation/analyze.ts          (writes sentimentConfidence)
--   * lib/reputation/sentiment.ts        (NEW — batch backfill classifier)
--   * lib/reputation/orchestrate.ts      (passes the new field through)
--   * app/portal/reputation/page.tsx     (renders the confidence-faded pill)

ALTER TABLE "PropertyMention"
  ADD COLUMN "sentimentConfidence" DOUBLE PRECISION;
