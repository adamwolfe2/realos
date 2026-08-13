-- Funnel tag on operator prompts (2026-08-14 goal spec slice 8):
-- "branded" | "tof" | "bof". Nullable — legacy rows stay untagged.
ALTER TABLE "AeoCustomPrompt" ADD COLUMN "tag" TEXT;

-- Optional tracked rival on prospect audits (slice 13).
ALTER TABLE "ProspectAudit" ADD COLUMN "competitorName" TEXT;
