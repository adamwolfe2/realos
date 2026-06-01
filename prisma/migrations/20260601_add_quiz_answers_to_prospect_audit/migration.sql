-- Add quizAnswers column on ProspectAudit so the Digital Performance
-- Score quiz can persist the operator's responses alongside the scan
-- output. Additive nullable column — safe for live audits and any
-- URL-only submissions that bypass the quiz.
ALTER TABLE "ProspectAudit"
  ADD COLUMN "quizAnswers" JSONB;
