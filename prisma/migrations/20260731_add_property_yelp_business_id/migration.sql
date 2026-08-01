-- `Property.yelpBusinessId` has been declared in schema.prisma and read by
-- the reputation-scan cron + Yelp source (lib/reputation/yelp.ts) for some
-- time, but no migration ever created the column — pure schema/DB drift.
-- Additive and idempotent; matches the existing operator-facing DB state
-- if the column already exists via a manual `db push`.
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "yelpBusinessId" TEXT;
