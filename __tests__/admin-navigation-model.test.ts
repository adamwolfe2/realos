import { describe, expect, it } from "vitest";
import {
  activeAdminNavHref,
  adminNav,
  adminNavSections,
  isAdminNavEntryActive,
  navEntryBadgeCount,
} from "@/app/admin/nav-config";

const LEGACY_ROUTES = [
  "/admin",
  "/admin/insights",
  "/admin/intakes",
  "/admin/pipeline",
  "/admin/site-engine",
  "/admin/leads",
  "/admin/marketplace",
  "/admin/proposals",
  "/admin/pricing",
  "/admin/clients",
  "/admin/creative-requests",
  "/admin/content-drafts",
  "/admin/campaigns",
  "/admin/pixel-requests",
  "/admin/pixel",
  "/admin/tenants",
  "/admin/site-intelligence",
  "/admin/integrations/appfolio",
  "/admin/system",
  "/admin/system/seo-agent",
  "/admin/costs",
  "/admin/audit-log",
  "/admin/chat",
  "/admin/bug-reports",
] as const;

describe("admin navigation model", () => {
  it("distills the default navigation to eight visible destinations", () => {
    expect(adminNavSections.map(({ label }) => label)).toEqual([
      "Dashboard",
      "Insights",
      "Pipeline",
      "Sites",
      "Marketplace",
      "Clients",
      "Client work",
      "System",
    ]);
  });

  it("preserves every existing admin route exactly once", () => {
    const routes = adminNav.map(({ href }) => href);

    expect(routes).toHaveLength(LEGACY_ROUTES.length);
    expect(new Set(routes).size).toBe(routes.length);
    expect([...routes].sort()).toEqual([...LEGACY_ROUTES].sort());
  });

  it("opens the section containing a nested active route", () => {
    const sites = adminNavSections.find(({ label }) => label === "Sites");
    const clients = adminNavSections.find(({ label }) => label === "Clients");

    expect(sites && isAdminNavEntryActive(sites, "/admin/site-intelligence/client-1")).toBe(true);
    expect(clients && isAdminNavEntryActive(clients, "/admin/clients/client-1/activation")).toBe(true);
  });

  it("does not make Dashboard active on every admin route", () => {
    const dashboard = adminNavSections[0];

    expect(isAdminNavEntryActive(dashboard, "/admin")).toBe(true);
    expect(isAdminNavEntryActive(dashboard, "/admin/clients")).toBe(false);
  });

  it("chooses the most specific route when admin paths overlap", () => {
    expect(activeAdminNavHref("/admin/system/seo-agent")).toBe(
      "/admin/system/seo-agent",
    );
  });

  it("rolls child badges into their collapsed parent", () => {
    const pipeline = adminNavSections.find(({ label }) => label === "Pipeline");
    const clientWork = adminNavSections.find(({ label }) => label === "Client work");

    const badges = {
      pendingIntakes: 2,
      activeBuilds: 3,
      openCreative: 4,
      pendingContentDrafts: 5,
      pendingPixelRequests: 6,
    };

    expect(pipeline && navEntryBadgeCount(pipeline, badges)).toBe(5);
    expect(clientWork && navEntryBadgeCount(clientWork, badges)).toBe(15);
  });
});
