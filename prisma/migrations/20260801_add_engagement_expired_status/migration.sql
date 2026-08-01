-- Stale-engagement TTL: ChatbotEngagement rows stuck in PENDING (widget
-- never polled, or polled from a session that's long gone) should read as
-- EXPIRED after ~24h instead of forever implying "still waiting to be
-- delivered." Piggybacks the chatbot-profile-digest cron (every 5 min,
-- same domain) rather than adding a new cron route.
--
-- Additive and idempotent. ALTER TYPE ... ADD VALUE is transaction-safe on
-- PostgreSQL 12+ provided the new value is not used in the same
-- transaction — we only add the label here, matching
-- 20260729_add_pixel_notify_channel.

ALTER TYPE "EngagementStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
