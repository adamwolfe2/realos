import "server-only";
import { prisma } from "@/lib/db";
import {
  FEATURE_CATALOG,
  BASE_PLATFORM_CENTS,
  type FeatureDef,
} from "@/lib/billing/features";

// ---------------------------------------------------------------------------
// Effective feature pricing = admin overrides (FeaturePrice rows) layered over
// the code-default catalog (lib/billing/features.ts). The admin pricing editor
// writes FeaturePrice rows; everything that renders prices (the onboarding
// cart, and later the per-feature Stripe prices) reads through here so there's
// a single source of truth for "what does this feature cost right now."
//
// `base_platform` is the special key for the always-on base bundle price.
// ---------------------------------------------------------------------------

export const BASE_PLATFORM_KEY = "base_platform";

// A feature as the client cart consumes it — serializable (icon is a name
// string), price-resolved, with the admin `active` flag applied.
export type EffectiveFeature = Omit<FeatureDef, "monthlyCents"> & {
  monthlyCents: number;
};

export type EffectiveFeatureCatalog = {
  features: EffectiveFeature[];
  basePlatformCents: number;
};

export async function getEffectiveFeatureCatalog(): Promise<EffectiveFeatureCatalog> {
  const rows = await prisma.featurePrice.findMany().catch(() => []);
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const features: EffectiveFeature[] = FEATURE_CATALOG
    // An explicit active=false row hides the feature from onboarding.
    .filter((f) => byKey.get(f.key)?.active ?? true)
    .map((f) => ({
      ...f,
      monthlyCents: byKey.get(f.key)?.monthlyCents ?? f.monthlyCents,
    }));

  const basePlatformCents =
    byKey.get(BASE_PLATFORM_KEY)?.monthlyCents ?? BASE_PLATFORM_CENTS;

  return { features, basePlatformCents };
}

// Admin editor row: every catalog feature with its current effective price +
// active flag (whether or not a DB override exists yet), plus the base
// platform. Returned in catalog order with base platform first.
export type FeaturePriceRow = {
  key: string;
  label: string;
  monthlyCents: number;
  active: boolean;
  isBase: boolean;
};

export async function getFeaturePriceRows(): Promise<FeaturePriceRow[]> {
  const rows = await prisma.featurePrice.findMany().catch(() => []);
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const base: FeaturePriceRow = {
    key: BASE_PLATFORM_KEY,
    label: "LeaseStack platform (base)",
    monthlyCents: byKey.get(BASE_PLATFORM_KEY)?.monthlyCents ?? BASE_PLATFORM_CENTS,
    active: byKey.get(BASE_PLATFORM_KEY)?.active ?? true,
    isBase: true,
  };

  const featureRows: FeaturePriceRow[] = FEATURE_CATALOG.map((f) => ({
    key: f.key,
    label: f.name,
    monthlyCents: byKey.get(f.key)?.monthlyCents ?? f.monthlyCents,
    active: byKey.get(f.key)?.active ?? true,
    isBase: false,
  }));

  return [base, ...featureRows];
}

// Valid editable keys = every catalog feature key + base_platform. Guards the
// admin write action against arbitrary keys.
export function isValidFeaturePriceKey(key: string): boolean {
  if (key === BASE_PLATFORM_KEY) return true;
  return FEATURE_CATALOG.some((f) => f.key === key);
}
