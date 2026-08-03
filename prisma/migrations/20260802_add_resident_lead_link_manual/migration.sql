-- Lead→lease proof chain (2026-08-02): distinguish an OPERATOR's decision
-- about a resident's lead link from the AppFolio sync's auto-match.
--
-- Why: Resident.leadId alone can't express intent. The sync's
-- first-write-wins rule (leadId ?? match) meant an operator who unlinked a
-- wrong auto-match set leadId = NULL, and the very next sync tick re-linked
-- the same wrong lead by the same rule — an unbreakable loop from the
-- operator's side. Rows with leadLinkManual = true are never touched by the
-- sync's link logic.
--
-- Additive, non-destructive, safe to re-run: existing rows default to false
-- (i.e. "no operator opinion yet"), preserving current sync behavior for
-- every historical row.

ALTER TABLE "Resident"
  ADD COLUMN IF NOT EXISTS "leadLinkManual" BOOLEAN NOT NULL DEFAULT false;
