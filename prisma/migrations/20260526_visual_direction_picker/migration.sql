-- ============================================================================
-- Visual direction picker — extends IntakeResponse with the multi-modal picker
-- fields (chosen preset, design language, palette, negative inputs).
-- Every column is nullable so legacy submissions remain valid as-is.
-- Idempotent (safe to re-apply on partial / failed migration runs).
-- ============================================================================

ALTER TABLE "IntakeResponse"
  ADD COLUMN IF NOT EXISTS "chosenPresetSlug"         TEXT,
  ADD COLUMN IF NOT EXISTS "chosenDesignLanguageSlug" TEXT,
  ADD COLUMN IF NOT EXISTS "chosenPaletteSlug"        TEXT,
  ADD COLUMN IF NOT EXISTS "negativeInputs"           TEXT;
