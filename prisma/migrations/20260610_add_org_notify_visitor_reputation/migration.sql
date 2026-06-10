-- Adds two notification-preference booleans to Organization that existed in
-- schema.prisma but were never migrated to the database. The missing columns
-- caused every `prisma.user.findUnique({ include: { org: true } })` to throw
-- ("The column `(not available)` does not exist"), which nulled out getScope()
-- and surfaced as a bogus "Not authenticated" redirect/recovery loop on
-- /admin and /portal. Additive + backfilled by DEFAULT — zero downtime.
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "notifyOnNewVisitors" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "notifyOnReputationScan" BOOLEAN NOT NULL DEFAULT true;
