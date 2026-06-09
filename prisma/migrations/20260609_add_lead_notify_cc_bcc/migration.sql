-- Adds optional CC + BCC recipients for lead-capture notification emails on
-- the Organization. Lets an owner/manager be copied on every chatbot/lead
-- email without being the primary recipient. Both nullable + comma-separated
-- for multiple, mirroring notifyLeadEmail. Additive, zero-downtime.

ALTER TABLE "Organization"
  ADD COLUMN "notifyLeadCcEmail" TEXT,
  ADD COLUMN "notifyLeadBccEmail" TEXT;
