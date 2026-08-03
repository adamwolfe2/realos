import { describe, it, expect } from "vitest";
import { NAV_GROUPS, type PortalNavOrg } from "@/components/portal/portal-nav";

// ---------------------------------------------------------------------------
// SG Real Estate portal slimming (2026-08-02 SG focus).
//
// The sellable unit is chatbot + lead inbox + source attribution + monthly
// proof report; everything else stays hidden until it earns its place.
// Module flags are what drive the nav, so this locks in WHICH items SG's
// team actually sees — a future flag default or nav edit that silently
// re-surfaces Visitors/SEO/Popups/Reputation fails here.
//
// Mirrors the live prod flags applied via
// `scripts/set-org-modules.ts --org telegraph-commons --preset sg-focus`.
// ---------------------------------------------------------------------------

const SG: PortalNavOrg = {
  name: "SG Real Estate",
  moduleWebsite: true,
  modulePixel: false, // slimmed: pixel is proof, not a product surface
  moduleChatbot: true,
  moduleGoogleAds: false,
  moduleMetaAds: false,
  moduleCreativeStudio: false,
  moduleSEO: false, // slimmed
  moduleReferrals: false,
  modulePopups: false, // slimmed
  moduleVault: false,
  moduleReputation: false, // slimmed
  moduleInsights: true, // billed SKU that also gates the reports pages
  moduleAttribution: true,
  moduleResidents: false,
  moduleTours: false,
  moduleConversations: true,
  bringYourOwnSite: true,
  onboardingDismissed: true,
  setupComplete: true,
  appFolioConnected: true,
  hasInsights: true,
  hasReports: true,
  hasTours: false,
} as PortalNavOrg;

function visibleLabels(org: PortalNavOrg): string[] {
  return NAV_GROUPS.flatMap((g) =>
    g.items.filter((i) => i.show(org)).map((i) => i.label),
  );
}

describe("SG focus nav", () => {
  const labels = visibleLabels(SG);

  it("hides every surface the slimming turned off", () => {
    for (const gone of ["Visitors", "SEO", "Popups", "Reputation"]) {
      expect(labels).not.toContain(gone);
    }
  });

  it("keeps the sellable unit visible", () => {
    for (const kept of ["Leads", "Chatbot", "Attribution", "Reports"]) {
      expect(labels).toContain(kept);
    }
  });

  it("still hides the surfaces that were already off (residents/tours/ads/creative/referrals/vault)", () => {
    for (const gone of [
      "Tours",
      "Applications",
      "Residents",
      "Renewals",
      "Work orders",
      "Ads",
      "Creative",
      "Referrals",
      "Vault",
      "Site Engine", // bringYourOwnSite: their site isn't ours to manage
    ]) {
      expect(labels).not.toContain(gone);
    }
  });

  it("documents the exact nav SG's team sees", () => {
    // Anything beyond the four-item sellable unit here is either
    // ALWAYS-gated (no flag exists) or entitlement-coupled:
    //   - Insights rides moduleInsights, the SAME billed SKU that gates the
    //     reports PAGES (requireModule). Turning it off 403s the report.
    //   - Reverse Attribution rides moduleAttribution alongside Attribution.
    //   - Dashboard/Properties/Content/Integrations/Marketplace/Billing/
    //     Settings have no module flag at all.
    expect(labels).toEqual([
      "Dashboard",
      "Properties",
      "Leads",
      "Conversations",
      "Chatbot",
      "Content",
      "Attribution",
      "Reverse Attribution",
      "Insights",
      "Reports",
      "Integrations",
      "Marketplace",
      "Billing",
      "Settings",
    ]);
  });
});
