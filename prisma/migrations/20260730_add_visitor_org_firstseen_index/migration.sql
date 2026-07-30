-- Backs the visitors page's 30-day visit-pulse query (filter on orgId +
-- firstSeenAt, select firstSeenAt only) and the page's firstSeenAt DESC
-- sort. Without it every pulse render heap-scans the tenant's visitor rows.
--
-- Additive and idempotent.
CREATE INDEX IF NOT EXISTS "Visitor_orgId_firstSeenAt_idx" ON "Visitor"("orgId", "firstSeenAt");
