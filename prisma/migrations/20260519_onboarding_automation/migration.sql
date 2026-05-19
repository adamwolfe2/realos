-- Self-serve onboarding automation: three-phase state machine.
--
-- FOUNDATION (week 1, time-bounded) → platform working state
-- GROWTH     (week 2, time-bounded) → first lead captured
-- POLISH     (anytime, NOT auto-completed) → optional enhancements
--
-- See:
--   * lib/onboarding/state-machine.ts   (phase advancement + helpers)
--   * lib/onboarding/step-detectors.ts  (per-step "is it done" checks)
--   * components/portal/onboarding/onboarding-checklist.tsx
--   * app/api/cron/onboarding-drip/route.ts (extended email drip)

CREATE TYPE "OnboardingPhase" AS ENUM ('FOUNDATION', 'GROWTH', 'POLISH', 'COMPLETED');

CREATE TYPE "OnboardingStepKey" AS ENUM (
  'ADD_PROPERTY',
  'CONNECT_DATA_SOURCE',
  'CONFIRM_CONTACT_PREFS',
  'APPROVE_CHATBOT_PERSONA',
  'INSTALL_PIXEL',
  'VERIFY_LEAD_CAPTURE',
  'CONNECT_ADS',
  'REVIEW_FIRST_REPORT',
  'SET_REPUTATION_QUERIES',
  'CUSTOM_DOMAIN',
  'WHITE_LABEL',
  'GENERATE_NEIGHBORHOOD_PAGE',
  'CUSTOM_REPORT_PREFS',
  'INVITE_TEAMMATE'
);

CREATE TYPE "OnboardingStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

CREATE TABLE "OnboardingProgress" (
  "id"                    TEXT                 NOT NULL,
  "orgId"                 TEXT                 NOT NULL,
  "currentPhase"          "OnboardingPhase"    NOT NULL DEFAULT 'FOUNDATION',
  "foundationStartedAt"   TIMESTAMP(3),
  "foundationCompletedAt" TIMESTAMP(3),
  "growthStartedAt"       TIMESTAMP(3),
  "growthCompletedAt"     TIMESTAMP(3),
  "polishStartedAt"       TIMESTAMP(3),
  "completedAt"           TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3)         NOT NULL,

  CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnboardingProgress_orgId_key" ON "OnboardingProgress"("orgId");
CREATE INDEX "OnboardingProgress_currentPhase_idx" ON "OnboardingProgress"("currentPhase");

ALTER TABLE "OnboardingProgress"
  ADD CONSTRAINT "OnboardingProgress_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OnboardingStepProgress" (
  "id"            TEXT                   NOT NULL,
  "progressId"    TEXT                   NOT NULL,
  "phase"         "OnboardingPhase"      NOT NULL,
  "stepKey"       "OnboardingStepKey"    NOT NULL,
  "status"        "OnboardingStepStatus" NOT NULL DEFAULT 'PENDING',
  "completedAt"   TIMESTAMP(3),
  "skippedAt"     TIMESTAMP(3),
  "skippedReason" TEXT,
  "metadata"      JSONB,
  "createdAt"     TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)           NOT NULL,

  CONSTRAINT "OnboardingStepProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnboardingStepProgress_progressId_stepKey_key"
  ON "OnboardingStepProgress"("progressId", "stepKey");
CREATE INDEX "OnboardingStepProgress_progressId_phase_idx"
  ON "OnboardingStepProgress"("progressId", "phase");
CREATE INDEX "OnboardingStepProgress_progressId_status_idx"
  ON "OnboardingStepProgress"("progressId", "status");

ALTER TABLE "OnboardingStepProgress"
  ADD CONSTRAINT "OnboardingStepProgress_progressId_fkey"
  FOREIGN KEY ("progressId") REFERENCES "OnboardingProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
