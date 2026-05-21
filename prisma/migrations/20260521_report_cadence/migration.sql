-- Report cadence config — Norman bug #100.
--
-- Adds three columns to Organization driving the daily/weekly/monthly
-- cron auto-send loop. Default ("none" + empty array + false) preserves
-- the existing white-glove behavior — operator must still click Share
-- or Email manually unless they opt in via /portal/reports/settings.

ALTER TABLE "Organization"
  ADD COLUMN "reportCadence"    TEXT     NOT NULL DEFAULT 'none',
  ADD COLUMN "reportRecipients" TEXT[]   NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "reportAutoSend"   BOOLEAN  NOT NULL DEFAULT false;
