import { describe, it, expect, vi } from "vitest";

// The GA4/GSC picker must send a trial-expired admin to billing, not back to
// Connect (TrialExpiredError extends ForbiddenError).

const h = vi.hoisted(() => {
  class ForbiddenError extends Error {}
  class TrialExpiredError extends ForbiddenError {}
  return {
    ForbiddenError,
    TrialExpiredError,
    requireWorkspaceAdmin: vi.fn(),
    redirect: vi.fn((to: string) => {
      throw new Error(`REDIRECT:${to}`);
    }),
  };
});

vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("@/lib/tenancy/scope", () => ({
  ForbiddenError: h.ForbiddenError,
  TrialExpiredError: h.TrialExpiredError,
  requireWorkspaceAdmin: h.requireWorkspaceAdmin,
}));
vi.mock("@/lib/integrations/google-properties", () => ({
  loadPendingSeoOptions: vi.fn(),
}));
vi.mock("@/components/admin/page-header", () => ({ PageHeader: () => null }));
vi.mock("@/components/portal/connect/account-picker-list", () => ({
  ConnectStepper: () => null,
}));
vi.mock("@/components/portal/connect/seo-property-picker", () => ({
  SeoPropertyPicker: () => null,
}));

const { SeoSelectPage } = await import(
  "@/components/portal/connect/seo-select-page"
);

describe("SeoSelectPage access", () => {
  it("sends a trial-expired admin to billing", async () => {
    h.requireWorkspaceAdmin.mockRejectedValueOnce(new h.TrialExpiredError());
    await expect(
      SeoSelectPage({ provider: "GA4", propertyId: null }),
    ).rejects.toThrow("REDIRECT:/portal/billing");
  });

  it("sends a non-admin seat back to Connect", async () => {
    h.requireWorkspaceAdmin.mockRejectedValueOnce(new h.ForbiddenError());
    await expect(
      SeoSelectPage({ provider: "GSC", propertyId: null }),
    ).rejects.toThrow("REDIRECT:/portal/connect");
  });
});
