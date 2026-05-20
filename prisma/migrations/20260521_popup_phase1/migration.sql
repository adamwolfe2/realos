-- Popup phase 1 — design parity with Adam's custom Telegraph Commons popup
-- + a small set of polished, brandable templates the operator can pick from
-- when creating a new campaign.
--
-- All changes are additive and backward-compatible. Existing rows have NULL
-- values for every new field, which the embed renderer and editor preview
-- both treat as "render with the legacy v1 treatment" so already-published
-- popups keep their exact pre-migration look.
--
-- New PopupTheme enum — controls the global treatment of the card:
--   LIGHT     → default (white card, dark text) — backward-compatible
--   DARK      → Telegraph-style navy card, white-on-dark text hierarchy
--   GRADIENT  → light card with a gradient accent bar across the top
--
-- New PopupCampaign columns:
--   eyebrowText       → small caps label above headline ("LIMITED AVAILABILITY")
--   accentColor       → second accent (e.g. gold) used for eyebrow + featured value
--   theme             → PopupTheme enum, see above
--   template          → slug of the template used to seed this row
--   featuredLabel     → tiny uppercase label above featured value ("RATES AS LOW AS")
--   featuredValue     → headline-size featured value ("$765")
--   featuredUnit      → smaller suffix next to the value ("/mo")
--   featuredCaption   → muted sub-caption below ("+ $85/mo amenity fee")
--   secondaryCtaText  → outlined secondary button label ("Schedule Tour")
--   secondaryCtaUrl   → secondary button href
--   secondaryCtaIcon  → icon slug for the secondary button (calendar|phone|external|arrow|none)
--   primaryCtaIcon    → icon slug for the primary button (same enum)
--   dismissText       → tertiary text link below CTAs ("Not yet, thanks")
--   gradientColors    → JSON array of hex stops for the top gradient accent
--                       e.g. ["#F5BC1A","#EC4899","#3B82F6"]

CREATE TYPE "PopupTheme" AS ENUM ('LIGHT', 'DARK', 'GRADIENT');

ALTER TABLE "PopupCampaign"
  ADD COLUMN "eyebrowText"       TEXT,
  ADD COLUMN "accentColor"       TEXT,
  ADD COLUMN "theme"             "PopupTheme" NOT NULL DEFAULT 'LIGHT',
  ADD COLUMN "template"          TEXT,
  ADD COLUMN "featuredLabel"     TEXT,
  ADD COLUMN "featuredValue"     TEXT,
  ADD COLUMN "featuredUnit"      TEXT,
  ADD COLUMN "featuredCaption"   TEXT,
  ADD COLUMN "secondaryCtaText"  TEXT,
  ADD COLUMN "secondaryCtaUrl"   TEXT,
  ADD COLUMN "secondaryCtaIcon"  TEXT,
  ADD COLUMN "primaryCtaIcon"    TEXT,
  ADD COLUMN "dismissText"       TEXT,
  ADD COLUMN "gradientColors"    JSONB;
