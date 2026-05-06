-- Performance indexes — added during the overnight ops audit.
--
-- Each index here was identified by the DB perf agent as missing
-- coverage for a query that fires on a high-traffic page. Adding the
-- index is non-breaking: no data changes, queries just get faster.
-- CONCURRENTLY would be safer for production but Prisma migrations
-- run inside a transaction that doesn't allow CONCURRENTLY, so we
-- accept a brief lock during deploy. Tables involved are small enough
-- that the lock is < 1s on Telegraph Commons-scale data.

-- 1. Visitor.intentScore — /portal/visitors filters by intentScore in
--    "Hot" tab; without this it scans every visitor for the org.
CREATE INDEX IF NOT EXISTS "Visitor_orgId_intentScore_idx"
  ON "Visitor" ("orgId", "intentScore" DESC);

-- 2. Visitor.lastSeenAt with intent — combined ordering for the
--    "highest intent" sort on the visitor feed (intent DESC, then
--    lastSeen DESC as tiebreaker).
CREATE INDEX IF NOT EXISTS "Visitor_orgId_intentScore_lastSeenAt_idx"
  ON "Visitor" ("orgId", "intentScore" DESC, "lastSeenAt" DESC);

-- 3. ChatbotConversation status + lastMessageAt — conversations page
--    filters by status (ACTIVE/CLOSED) AND orders by lastMessageAt.
--    Existing indexes are split: (orgId, status) and (orgId,
--    lastMessageAt) but neither covers both.
CREATE INDEX IF NOT EXISTS "ChatbotConversation_orgId_status_lastMessageAt_idx"
  ON "ChatbotConversation" ("orgId", "status", "lastMessageAt" DESC);

-- 4. Lead.createdAt — referrals page does a 30-day groupBy on
--    Lead.createdAt and needs an index for the date window. Existing
--    Lead indexes cover status and source but not createdAt.
CREATE INDEX IF NOT EXISTS "Lead_orgId_createdAt_idx"
  ON "Lead" ("orgId", "createdAt" DESC);

-- 5. AdMetricDaily.campaignId+date — campaigns page groups daily
--    metrics by campaign over a 28-day window. Existing
--    @@index([orgId, date]) helps the date scan, but campaign
--    relation lookups benefit from a campaignId-leading index.
CREATE INDEX IF NOT EXISTS "AdMetricDaily_campaignId_date_idx"
  ON "AdMetricDaily" ("campaignId", "date" DESC);

-- 6. Lease.endDate filter — renewals page picks leases ending in the
--    next 120 days. Without an endDate index this is a sequential
--    scan per render.
CREATE INDEX IF NOT EXISTS "Lease_orgId_endDate_idx"
  ON "Lease" ("orgId", "endDate");

-- 7. Resident.status + propertyId — residents page filters by status
--    and (with the new RBAC) by allowed property ids. The existing
--    Resident.status index doesn't include propertyId for the
--    multi-property filter.
CREATE INDEX IF NOT EXISTS "Resident_orgId_status_propertyId_idx"
  ON "Resident" ("orgId", "status", "propertyId");
