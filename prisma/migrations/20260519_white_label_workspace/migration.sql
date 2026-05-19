-- White-label workspace add-on.
-- Adds the master flag + per-org brand overrides used by:
--   * app/portal/layout.tsx          (portal chrome)
--   * app/(tenant)/layout.tsx        (public tenant marketing site)
--   * lib/email/shared.ts            (outbound email display name + footer)
-- See lib/brand/effective.ts for the resolver. Activation is wired
-- through app/api/webhooks/stripe/route.ts when the
-- ls_white_label_monthly_v1 price lands on a subscription.

ALTER TABLE "Organization"
  ADD COLUMN "whiteLabel"             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "whiteLabelBrandName"    TEXT,
  ADD COLUMN "whiteLabelLogoUrl"      TEXT,
  ADD COLUMN "whiteLabelPrimaryColor" TEXT;
