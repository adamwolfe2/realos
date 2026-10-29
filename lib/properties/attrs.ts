/**
 * Property attribute helpers: canonical labels and profile tags for the
 * filter UI on /portal/properties.
 *
 * Norman feedback (issues #68 + #54): operators want to slice the
 * portfolio by Asset Class, Size, Category, and Profile. The first two
 * come "for free" from existing columns; the latter two are explicit
 * fields on Property (assetCategory, profileTags). This file is the
 * single source of truth for how those dimensions are labelled, so the list filter, the property meta card, and any
 * future export / report all agree.
 */
import type {
  CommercialSubtype,
  PropertyType,
  ResidentialSubtype,
} from "@prisma/client";

// ── Asset class ────────────────────────────────────────────────────────

export type AssetClass =
  | "STUDENT_HOUSING"
  | "MULTIFAMILY"
  | "SENIOR_LIVING"
  | "SINGLE_FAMILY"
  | "CO_LIVING"
  | "SHORT_TERM"
  | "OFFICE"
  | "RETAIL"
  | "INDUSTRIAL"
  | "MIXED_USE"
  | "FLEX_SPACE"
  | "MEDICAL_OFFICE"
  | "STORAGE" // synthetic — not on the prisma enums yet
  | "OTHER";

export type AssetClassInput = {
  propertyType: PropertyType;
  residentialSubtype: ResidentialSubtype | null;
  commercialSubtype: CommercialSubtype | null;
};

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  STUDENT_HOUSING: "Student housing",
  MULTIFAMILY: "Apartments",
  SENIOR_LIVING: "Senior living",
  SINGLE_FAMILY: "Single-family rental",
  CO_LIVING: "Co-living",
  SHORT_TERM: "Short-term rental",
  OFFICE: "Office",
  RETAIL: "Retail",
  INDUSTRIAL: "Industrial",
  MIXED_USE: "Mixed-use",
  FLEX_SPACE: "Flex space",
  MEDICAL_OFFICE: "Medical office",
  STORAGE: "Storage",
  OTHER: "Other",
};

// ── Size band ──────────────────────────────────────────────────────────
// Norman's bands: 0-25 / 26-50 / 51-100 / 101-250 / 251-1000

export type SizeBand =
  | "XS"   // 0-25 units
  | "S"    // 26-50
  | "M"    // 51-100
  | "L"    // 101-250
  | "XL";  // 251-1000

export const SIZE_BAND_LABEL: Record<SizeBand, string> = {
  XS: "0–25 units",
  S: "26–50 units",
  M: "51–100 units",
  L: "101–250 units",
  XL: "251–1,000 units",
};

// ── Profile tags ───────────────────────────────────────────────────────
// Suggested defaults — operators can add their own. Used to seed the
// filter UI and provide autocomplete in the property edit form.

export const SUGGESTED_PROFILE_TAGS = [
  "affordable",
  "luxury",
  "near campus",
  "downtown",
  "suburban",
  "transit-friendly",
  "pet-friendly",
  "furnished",
  "new construction",
  "historic",
] as const;
