import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  prisma: {},
}));

// PROPOSAL_CATALOG is static, but its module also exports DB-backed helpers.
// Replace the DB boundary so characterization can import the constant without
// constructing a Prisma client or making any database call.
vi.mock("@/lib/db", () => ({ prisma: h.prisma }));

import {
  ALWAYS_ON_MODULE_KEYS,
  BASE_PLATFORM_CENTS,
  FEATURE_CATALOG,
  buildModuleStateFromSelection,
  cartMonthlyCentsPerProperty,
} from "@/lib/billing/features";
import {
  ADDONS,
  TIERS,
  WEBSITE_BUILDS,
  getModulesForTier,
} from "@/lib/billing/catalog";
import { STRIPE_PRICE_IDS } from "@/lib/billing/price-ids.generated";
import {
  MARKETPLACE_ENTRIES,
  groupModulesByCategory,
} from "@/lib/marketplace/catalog";
import { PROPOSAL_CATALOG } from "@/lib/proposals/catalog";

const featureStripeSource = fs.readFileSync(
  path.resolve(process.cwd(), "lib/billing/feature-stripe.ts"),
  "utf8",
);

describe("product truth — current billing feature contract", () => {
  it("preserves the stable à-la-carte module keys", () => {
    expect(FEATURE_CATALOG.map(({ key }) => key)).toEqual([
      "moduleChatbot",
      "modulePixel",
      "moduleSEO",
      "moduleReputation",
      "moduleGoogleAds",
      "moduleMetaAds",
      "modulePopups",
      "moduleCreativeStudio",
      "moduleEmail",
      "moduleOutboundEmail",
      "moduleReferrals",
      "moduleInsights",
      "moduleMarketIntelligence",
      "moduleAttribution",
    ]);
  });

  it("calculates the cart as base plus each recognized selection once", () => {
    const selected = ["moduleChatbot", "modulePixel", "moduleChatbot"];
    const selectedKeys = new Set(selected);
    const selectedFeatureTotal = FEATURE_CATALOG.filter(({ key }) =>
      selectedKeys.has(key),
    ).reduce((total, feature) => total + feature.monthlyCents, 0);

    expect(cartMonthlyCentsPerProperty(selected)).toBe(
      BASE_PLATFORM_CENTS + selectedFeatureTotal,
    );
  });

  it("keeps base modules on while revoking every unselected paid module", () => {
    const state = buildModuleStateFromSelection([]);

    expect(ALWAYS_ON_MODULE_KEYS).toEqual([
      "moduleWebsite",
      "moduleLeadCapture",
    ]);
    expect(
      Object.fromEntries(
        FEATURE_CATALOG.map(({ key }) => [key, state[key]]),
      ),
    ).toEqual(
      Object.fromEntries(FEATURE_CATALOG.map(({ key }) => [key, false])),
    );
    expect(state.moduleWebsite).toBe(true);
    expect(state.moduleLeadCapture).toBe(true);
  });

  it("enables the conversations companion only with a selected chatbot", () => {
    const chatbotState = buildModuleStateFromSelection(["moduleChatbot"]);
    const emptyState = buildModuleStateFromSelection([]);

    expect(chatbotState.moduleChatbot).toBe(true);
    expect(chatbotState.moduleConversations).toBe(true);
    expect(emptyState.moduleConversations).toBeUndefined();
  });
});

describe("product truth — legacy tier and Stripe contract", () => {
  it("preserves stable tier ids and immutable Stripe lookup keys", () => {
    expect(
      TIERS.map((tier) => ({
        id: tier.id,
        tier: tier.tier,
        product: tier.productLookupKey,
        monthly: tier.monthly.lookupKey,
        annual: tier.annual.lookupKey,
        graduatedMonthly: tier.graduatedMonthly.lookupKey,
        graduatedAnnual: tier.graduatedAnnual.lookupKey,
      })),
    ).toEqual([
      {
        id: "starter",
        tier: "STARTER",
        product: "ls_foundation_product",
        monthly: "ls_foundation_monthly_v1",
        annual: "ls_foundation_annual_v1",
        graduatedMonthly: "ls_foundation_graduated_monthly_v1",
        graduatedAnnual: "ls_foundation_graduated_annual_v1",
      },
      {
        id: "growth",
        tier: "GROWTH",
        product: "ls_growth_product",
        monthly: "ls_growth_monthly_v1",
        annual: "ls_growth_annual_v1",
        graduatedMonthly: "ls_growth_graduated_monthly_v1",
        graduatedAnnual: "ls_growth_graduated_annual_v1",
      },
      {
        id: "scale",
        tier: "SCALE",
        product: "ls_scale_product",
        monthly: "ls_scale_monthly_v1",
        annual: "ls_scale_annual_v1",
        graduatedMonthly: "ls_scale_graduated_monthly_v1",
        graduatedAnnual: "ls_scale_graduated_annual_v1",
      },
    ]);
  });

  it("preserves legacy tier fallback and cumulative module grants", () => {
    const starter = getModulesForTier("STARTER");
    const growth = getModulesForTier("GROWTH");
    const scale = getModulesForTier("SCALE");

    expect(starter).toMatchObject({
      moduleWebsite: true,
      moduleChatbot: true,
      moduleLeadCapture: true,
      modulePixel: false,
    });
    expect(growth).toMatchObject({
      ...starter,
      modulePixel: true,
      moduleGoogleAds: true,
      moduleMetaAds: true,
      moduleSEO: true,
      moduleCreativeStudio: true,
    });
    expect(scale).toMatchObject({
      ...growth,
      moduleEmail: true,
      moduleOutboundEmail: true,
      moduleReferrals: true,
    });
    expect(getModulesForTier("CUSTOM")).toBeNull();
  });

  it("keeps every static billable lookup key mapped without asserting price ids", () => {
    const declaredLookupKeys = [
      ...TIERS.flatMap((tier) => [
        tier.monthly.lookupKey,
        tier.annual.lookupKey,
        tier.graduatedMonthly.lookupKey,
        tier.graduatedAnnual.lookupKey,
      ]),
      ...ADDONS.map((addon) => addon.priceLookupKey),
      ...WEBSITE_BUILDS.map((build) => build.priceLookupKey),
    ];

    expect(
      declaredLookupKeys.filter(
        (lookupKey) => !(lookupKey in STRIPE_PRICE_IDS),
      ),
    ).toEqual([]);
  });

  it("preserves the per-feature lookup-key namespace and safe legacy fallback", () => {
    expect(featureStripeSource).toContain(
      'key === BASE_PLATFORM_KEY ? "ls_base_platform_monthly" : `ls_feat_${key}_monthly`',
    );
    expect(featureStripeSource).toContain(
      "if (rows.length === 0 && metadataKeys.size === 0) return null;",
    );
    expect(featureStripeSource).toContain("stripeProductId: { in: productIds }");
    expect(featureStripeSource).toContain("reference.featureKey");
  });
});

describe("product truth — marketplace safety states", () => {
  it("preserves stable entry keys, slugs, kinds, and categories", () => {
    expect(
      MARKETPLACE_ENTRIES.map(({ key, slug, kind, category }) => ({
        key,
        slug,
        kind,
        category,
      })),
    ).toEqual([
      { key: "modulePixel", slug: "visitor-pixel", kind: "toggle", category: "Acquisition" },
      { key: "moduleLeadCapture", slug: "lead-capture", kind: "included", category: "Acquisition" },
      { key: "moduleChatbot", slug: "ai-chatbot", kind: "toggle", category: "Engagement" },
      { key: "modulePopups", slug: "embeddable-popups", kind: "toggle", category: "Engagement" },
      { key: "moduleSEO", slug: "seo-aeo", kind: "concierge", category: "Discovery" },
      { key: "moduleWebsite", slug: "marketing-site", kind: "concierge", category: "Discovery" },
      { key: "reputation-monitoring", slug: "reputation", kind: "included", category: "Operations" },
      { key: "moduleReferrals", slug: "referrals", kind: "toggle", category: "Operations" },
      { key: "ls_addon_reputation_pro", slug: "reputation-pro", kind: "addon", category: "Pro Add-ons" },
      { key: "ls_addon_white_label", slug: "white-label", kind: "concierge", category: "Pro Add-ons" },
      { key: "moduleEmail", slug: "email-nurture", kind: "coming", category: "Engagement" },
      { key: "moduleOutboundEmail", slug: "outbound-email", kind: "coming", category: "Acquisition" },
    ]);
  });

  it("withholds not-ready and coming entries from the visible groups", () => {
    const visibleSlugs = groupModulesByCategory().flatMap(({ modules }) =>
      modules.map(({ slug }) => slug),
    );

    expect(
      MARKETPLACE_ENTRIES.filter(({ ready }) => ready === false).map(
        ({ slug }) => slug,
      ),
    ).toEqual(["visitor-pixel", "embeddable-popups"]);
    expect(visibleSlugs).not.toContain("visitor-pixel");
    expect(visibleSlugs).not.toContain("embeddable-popups");
    expect(
      MARKETPLACE_ENTRIES.filter(({ kind }) => kind === "coming").map(
        ({ slug }) => slug,
      ),
    ).toEqual(["email-nurture", "outbound-email"]);
  });
});

describe("product truth — proposal activity", () => {
  it("preserves stable proposal slugs and current active states", () => {
    expect(
      PROPOSAL_CATALOG.map(({ slug, kind, active }) => ({
        slug,
        kind,
        active,
      })),
    ).toEqual([
      { slug: "tier-foundation", kind: "TIER", active: true },
      { slug: "tier-growth", kind: "TIER", active: true },
      { slug: "tier-scale", kind: "TIER", active: true },
      { slug: "tier-enterprise", kind: "TIER", active: true },
      { slug: "addon-reputation-pro", kind: "ADDON", active: true },
      { slug: "addon-keyword-trends", kind: "ADDON", active: true },
      { slug: "addon-aeo-boost", kind: "ADDON", active: true },
      { slug: "addon-audience-sync", kind: "ADDON", active: true },
      { slug: "addon-outbound-email-engine", kind: "ADDON", active: true },
      { slug: "addon-chatbot-pro", kind: "ADDON", active: true },
      { slug: "addon-cursive-pixel-pro", kind: "ADDON", active: true },
      { slug: "addon-insights-pro", kind: "ADDON", active: true },
      { slug: "addon-integrations-pro", kind: "ADDON", active: true },
      { slug: "addon-custom-domain", kind: "ADDON", active: true },
      { slug: "addon-white-label", kind: "ADDON", active: true },
      { slug: "addon-website-build", kind: "ADDON", active: true },
      { slug: "setup-kickoff-workshop", kind: "ADDON", active: true },
      { slug: "setup-aeo-status-report", kind: "ADDON", active: true },
      { slug: "sprint-30-day-implementation", kind: "ADDON", active: true },
      { slug: "addon-white-glove-coordination", kind: "ADDON", active: true },
      { slug: "addon-commercial-retainer", kind: "ADDON", active: true },
      { slug: "addon-portfolio-success", kind: "ADDON", active: true },
      { slug: "addon-pixel-overage", kind: "ADDON", active: true },
      { slug: "addon-email-overage", kind: "ADDON", active: true },
    ]);
  });

  it("records which active proposal rows lack a stable Stripe mapping", () => {
    expect(
      PROPOSAL_CATALOG.filter(
        ({ active, stripePriceIdMonthly, stripePriceIdAnnual }) =>
          active && !stripePriceIdMonthly && !stripePriceIdAnnual,
      ).map(({ slug }) => slug),
    ).toEqual([
      "tier-enterprise",
      "addon-keyword-trends",
      "addon-aeo-boost",
      "addon-audience-sync",
      "addon-outbound-email-engine",
      "addon-chatbot-pro",
      "addon-cursive-pixel-pro",
      "addon-insights-pro",
      "addon-integrations-pro",
      "addon-custom-domain",
      "addon-website-build",
      "setup-kickoff-workshop",
      "setup-aeo-status-report",
      "sprint-30-day-implementation",
      "addon-white-glove-coordination",
      "addon-commercial-retainer",
      "addon-portfolio-success",
    ]);
  });
});

describe("product truth — normalized contract gate", () => {
  it("requires the approved canonical registry before any consumer alignment", () => {
    const registryPath = path.resolve(process.cwd(), "lib/products/registry.ts");

    expect(
      fs.existsSync(registryPath),
      "S1 must add lib/products/registry.ts before catalog consumers can be aligned",
    ).toBe(true);
  });
});
