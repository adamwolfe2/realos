-- ============================================================================
-- MarketplaceAuditEvent — append-only event log for marketplace lifecycle
-- (SOLD / REFUNDED / EXPIRED / COMP / PAYOUT). Lives outside the org-scoped
-- AuditEvent model because marketplace buyers + sellers are standalone
-- magic-link accounts, not tenants. Idempotent — safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "MarketplaceAuditEvent" (
  "id"               TEXT NOT NULL,
  "action"           TEXT NOT NULL,
  "leadId"           TEXT,
  "purchaseId"       TEXT,
  "buyerId"          TEXT,
  "sellerId"         TEXT,
  "amountCents"      INTEGER,
  "sellerShareCents" INTEGER,
  "description"      TEXT,
  "metadata"         JSONB,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MarketplaceAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MarketplaceAuditEvent_leadId_createdAt_idx"
  ON "MarketplaceAuditEvent"("leadId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "MarketplaceAuditEvent_purchaseId_idx"
  ON "MarketplaceAuditEvent"("purchaseId");
CREATE INDEX IF NOT EXISTS "MarketplaceAuditEvent_sellerId_createdAt_idx"
  ON "MarketplaceAuditEvent"("sellerId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "MarketplaceAuditEvent_buyerId_createdAt_idx"
  ON "MarketplaceAuditEvent"("buyerId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "MarketplaceAuditEvent_action_createdAt_idx"
  ON "MarketplaceAuditEvent"("action", "createdAt" DESC);
