import { z } from "zod";

// ---------------------------------------------------------------------------
// Canonical validation schema for the site-engine intake form. The same
// schema is enforced on the client (react-hook-form resolver) and on the
// server (api/site-requests POST). The form is intentionally lenient —
// most fields are optional so the form never blocks a submission on a
// missing nice-to-have. The triage step in /admin/site-engine flags
// incomplete intakes via NEEDS_INFO.
// ---------------------------------------------------------------------------

export const IDENTITY_TYPES = [
  "solo_agent",
  "team",
  "brokerage",
  "property_manager",
  "developer",
  "other",
] as const;

export const VERTICALS = [
  "residential",
  "commercial",
  "mixed",
  "student_housing",
  "senior_living",
  "multifamily",
] as const;

export const PRESETS = [
  "editorial_luxury",
  "editorial_cream",
  "cinematic_portfolio",
  "soft_luxury",
  "modern_premium",
  "pnw_editorial",
] as const;

export const TIMELINE_OPTIONS = [
  "asap",
  "1_month",
  "3_month",
  "flexible",
] as const;

export const TIER_OPTIONS = [
  "TIER1_MARKETING",
  "TIER2_PORTAL",
  "TIER3_CUSTOM",
] as const;

const optionalString = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

const optionalLongText = z
  .string()
  .trim()
  .max(20000)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

const urlOrEmpty = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined))
  .refine(
    (v) => !v || /^https?:\/\//i.test(v),
    "Must be an http(s) URL",
  );

const assetInputSchema = z.object({
  type: z.enum([
    "LOGO",
    "HERO",
    "HEADSHOT",
    "PROPERTY_PHOTO",
    "LISTING_PHOTO",
    "BRAND_GUIDE",
    "INSPIRATION",
    "OTHER",
  ]),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  size: z.number().int().min(0).max(50 * 1024 * 1024),
  blobUrl: z.string().url(),
  pathname: z.string().optional(),
  label: z.string().max(300).optional(),
});

export const intakeFormSchema = z.object({
  // Submitter (auto-filled when logged in)
  submittedByName: z.string().trim().min(1, "Name required").max(200),
  submittedByEmail: z.string().trim().email("Valid email required").max(320),
  submittedByPhone: optionalString,
  submittedByCompany: optionalString,

  // Identity + tier
  identityType: z.enum(IDENTITY_TYPES).optional(),
  tier: z.enum(TIER_OPTIONS).default("TIER1_MARKETING"),

  // Brand basics
  brandName: z.string().trim().min(1, "Brand name required").max(200),
  tagline: optionalString,
  brandColorHex: z
    .string()
    .trim()
    .regex(/^#?[0-9a-f]{6}$/i, "Hex color, e.g. #1a1a2e")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? (v.startsWith("#") ? v : `#${v}`) : undefined)),
  vertical: z.enum(VERTICALS).optional(),

  // Compliance
  licenseNumber: optionalString,
  brokerageName: optionalString,
  licenseState: optionalString,

  // Service area
  serviceAreas: z.array(z.string().trim().max(120)).max(20).default([]),
  hqCity: optionalString,
  hqState: optionalString,

  // Existing presence
  currentSiteUrl: urlOrEmpty,
  domain: optionalString,
  domainNeeded: z.boolean().optional(),
  dnsAccess: z.boolean().optional(),

  // Visual direction — legacy single-pick fields kept for back-compat with
  // older submissions. Prefer the structured `visualDirection` block below.
  inspirationUrls: z
    .array(z.string().trim().url("Must be a URL").max(2000))
    .max(20)
    .default([]),
  presetChoice: z.enum(PRESETS).optional(),

  // Multi-modal visual direction picker. Either or all of:
  //   - inspirationUrls (already captured above as URLs only)
  //   - uploadedScreenshots (referenced via assets[] with type=INSPIRATION)
  //   - chosenPresetSlug (one of the kit's 4-6 preset slugs)
  //   - chosenDesignLanguageSlug (one of 71 imported design-language slugs)
  //   - chosenPaletteSlug (one of the 36 curated palette slugs)
  //   - negativeInputs (free-text "I don't want anything that...")
  visualDirection: z
    .object({
      chosenPresetSlug: z.string().trim().max(200).optional(),
      chosenDesignLanguageSlug: z.string().trim().max(200).optional(),
      chosenPaletteSlug: z.string().trim().max(200).optional(),
      negativeInputs: z.string().trim().max(4000).optional(),
    })
    .optional()
    .default({}),

  // Voice & content
  voiceSample: optionalLongText,
  bio: optionalLongText,
  services: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(2000).optional().or(z.literal("")),
      }),
    )
    .max(40)
    .optional()
    .default([]),
  testimonials: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        quote: z.string().trim().min(1).max(2000),
        role: z.string().trim().max(200).optional().or(z.literal("")),
      }),
    )
    .max(40)
    .optional()
    .default([]),
  keyStats: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        value: z.string().trim().min(1).max(120),
      }),
    )
    .max(20)
    .optional()
    .default([]),

  // Integrations
  calendlyUrl: urlOrEmpty,
  crmChoice: optionalString,
  mlsPreference: optionalString,
  ga4Id: optionalString,

  // Timeline + budget
  timelineExpectation: z.enum(TIMELINE_OPTIONS).optional(),
  budgetConfirmed: z.boolean().optional(),
  budgetTier: optionalString,

  // Open
  anythingElse: optionalLongText,

  // Uploads (Vercel Blob already uploaded; we just receive the metadata)
  assets: z.array(assetInputSchema).max(40).default([]),

  // Attribution (set by the client from URL params)
  source: optionalString,
  utmSource: optionalString,
  utmMedium: optionalString,
  utmCampaign: optionalString,
  referrer: optionalString,
});

export type IntakeFormInput = z.infer<typeof intakeFormSchema>;
export type IntakeAssetInput = z.infer<typeof assetInputSchema>;
