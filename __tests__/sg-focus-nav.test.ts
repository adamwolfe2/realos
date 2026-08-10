import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  NAV_GROUPS,
  visibleNavItems,
  type PortalNavOrg,
} from "@/components/portal/portal-nav";

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
  canManageBilling: true,
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
  // Visibility-only: drops the Insights ROW while the SKU above stays ON,
  // so /portal/reports (same SKU, same requireModule gate) keeps working.
  navHiddenItems: ["/portal/insights"],
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
    visibleNavItems(g, org).map((i) => i.label),
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
    //   - Dashboard/Properties/Content/Integrations/Marketplace/Billing/
    //     Settings have no module flag at all.
    // Insights is gone via navHiddenItems, NOT via its module flag — see
    // the entitlement-decoupling tests below.
    expect(labels).toEqual([
      "Dashboard",
      "Properties",
      "Leads",
      "Conversations",
      "Chatbot",
      "Content",
      "Attribution",
      "Reports",
      "Integrations",
      "Marketplace",
      "Billing",
      "Settings",
    ]);
  });
});

// ---------------------------------------------------------------------------
// navHiddenItems: sidebar VISIBILITY, decoupled from ENTITLEMENT.
//
// The whole reason this field exists: moduleInsights owns two nav rows
// (/portal/insights and /portal/reports) and is simultaneously the billed
// "Insights & Reports" SKU that requireModule checks. Hiding the Insights row
// by flipping the flag would 403 the monthly report SG actually pays for.
// These lock in that visibility and entitlement stay separate.
// ---------------------------------------------------------------------------
describe("navHiddenItems", () => {
  const insightsGroup = NAV_GROUPS.find((g) =>
    g.items.some((i) => i.href === "/portal/insights"),
  )!;

  it("hides ONLY the listed row, not its module's other rows", () => {
    const labels = visibleLabels(SG);
    expect(labels).not.toContain("Insights");
    expect(labels).toContain("Reports"); // same moduleInsights SKU
  });

  it("leaves the billed entitlement flag untouched", () => {
    // The hidden row's own predicate still passes — we hid a row, we did
    // not revoke a feature. If this ever fails, someone "fixed" visibility
    // by turning off the SKU, which 403s /portal/reports.
    expect(SG.moduleInsights).toBe(true);
    const insights = insightsGroup.items.find(
      (i) => i.href === "/portal/insights",
    )!;
    expect(insights.show(SG)).toBe(true);
  });

  it("changes nothing for an org that has not set it", () => {
    const { navHiddenItems: _omitted, ...noPref } = SG;
    // undefined (field absent) and [] (explicit empty) must behave alike.
    expect(visibleLabels(noPref as PortalNavOrg)).toContain("Insights");
    expect(
      visibleLabels({ ...SG, navHiddenItems: [] } as PortalNavOrg),
    ).toContain("Insights");
  });

  it("is actually used by BOTH nav surfaces", () => {
    // Structural guard: every assertion above calls visibleNavItems directly,
    // so reverting either render site to `group.items.filter(i => i.show(org))`
    // would keep the whole suite green while re-exposing the hidden row on
    // that one surface. Desktop and mobile must not drift.
    const read = (p: string) =>
      fs.readFileSync(path.resolve(__dirname, p), "utf-8");
    for (const file of [
      "../components/portal/portal-nav.tsx",
      "../components/portal/mobile-nav-drawer.tsx",
    ]) {
      const src = read(file);
      expect(src).toContain("visibleNavItems(group, org)");
      // The raw filter it replaced must not come back.
      expect(src).not.toMatch(/group\.items\.filter\(\(item\) => item\.show\(org\)\)/);
    }
  });

  it("ignores hrefs that do not match a nav item", () => {
    const before = visibleLabels({ ...SG, navHiddenItems: [] } as PortalNavOrg);
    const after = visibleLabels({
      ...SG,
      navHiddenItems: ["/portal/does-not-exist", "insights"],
    } as PortalNavOrg);
    // Exact href match only — no prefix/substring matching that could
    // silently take out neighbouring rows.
    expect(after).toEqual(before);
  });
});
