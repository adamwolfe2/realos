-- Nav visibility preference (2026-08-03): let an org hide a sidebar row
-- without touching what it's entitled to.
--
-- Why: SG wanted the Insights row gone, but visibility rode the billed
-- "Insights & Reports" SKU (moduleInsights), which ALSO gates the reports
-- pages via requireModule. Turning the flag off 403'd the report they
-- actually pay for; decoupling the flag in code would have handed the paid
-- feature to every org. This column separates the two concerns: entitlement
-- stays on moduleInsights, visibility moves here.
--
-- Keyed by nav item HREF, not module name, because moduleInsights owns two
-- rows (/portal/insights and /portal/reports) and the whole point is to
-- hide one and keep the other.
--
-- Cosmetic only: no authorization path reads this column. Additive,
-- non-destructive, safe to re-run — existing rows default to an empty
-- array, i.e. "hide nothing", preserving today's sidebar for every org.

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "navHiddenItems" TEXT[] NOT NULL DEFAULT '{}';
