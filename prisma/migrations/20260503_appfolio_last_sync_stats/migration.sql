-- Add detailed sync-stats column so the UI can surface what each AppFolio
-- sync actually pulled (residents / leases / work orders / warnings),
-- not just the binary success/failure status.
ALTER TABLE "AppFolioIntegration" ADD COLUMN "lastSyncStats" JSONB;
