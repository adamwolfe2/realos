-- Split pixel identity resolution out of the INGEST notification channel.
--
-- Pixel identifications are not inbound enquiries: nobody raised a hand, we
-- resolved an anonymous browser to an identity. They arrive in volume, so
-- emailing one per resolution is noise. This gives them their own channel,
-- defaulted OFF, while genuine webhook/Zapier leads on INGEST keep notifying.
--
-- Additive and idempotent. ALTER TYPE ... ADD VALUE is transaction-safe on
-- PostgreSQL 12+ provided the new value is not USED in the same transaction —
-- we only add the label and a column here, so this is safe on Neon.

ALTER TYPE "LeadNotifyChannel" ADD VALUE IF NOT EXISTS 'PIXEL';

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "notifyOnPixelLead" BOOLEAN NOT NULL DEFAULT false;
