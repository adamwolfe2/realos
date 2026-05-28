-- ============================================================================
-- Pixel-hit telemetry split.
--
-- Adds:
--   * CursiveIntegration.lastPixelHitAt        — last raw webhook event
--   * CursiveIntegration.totalPixelHitsCount   — total raw webhook events
--
-- Why: the existing `lastEventAt` / `totalEventsCount` columns only tick when
-- AudienceLab resolves a new identity (firstName/lastName/email/HEM present).
-- Anonymous page_view events — the bulk of pixel traffic for any new pixel —
-- bail at the resolution gate in lib/webhooks/cursive-process.ts and never
-- increment the counter. Operators watching the integrations panel see "31
-- events, last 5/27" and conclude the pixel is dead, even when it's firing
-- thousands of anonymous hits per hour.
--
-- Split the counters: `*PixelHit*` ticks on EVERY processed webhook event
-- (before the resolution gate) so the UI can show "pulse" separately from
-- "resolved identities". The original columns stay untouched so existing
-- semantics — and any analytics/queries that read them — are preserved.
--
-- Apply with:
--   pnpm prisma migrate deploy           (CI / Vercel build)
-- or, in a local dev session against Neon's direct (non-pooler) endpoint:
--   DIRECT_DATABASE_URL=... pnpm prisma migrate dev
-- ============================================================================

-- AlterTable
ALTER TABLE "CursiveIntegration"
    ADD COLUMN     "lastPixelHitAt"      TIMESTAMP(3),
    ADD COLUMN     "totalPixelHitsCount" INTEGER NOT NULL DEFAULT 0;
