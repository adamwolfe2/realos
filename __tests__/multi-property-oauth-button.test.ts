import { describe, it, expect, vi } from "vitest";

// Round 2: on /portal/settings/integrations a multi-property org gets one
// Google sign-in per property still missing its own GA4/GSC row, and each
// one must start a connection scoped to THAT property (the start route
// validates the grant). Before, the only button started an org-wide one.

vi.mock("@/lib/integrations/oauth-config", () => ({
  isOAuthEnabled: () => true,
  isProviderConfigured: () => true,
  providerReadinessReason: () => null,
  providerToRouteSlug: () => "google-ga4",
}));

const { OAuthConnectButton } = await import(
  "@/app/portal/settings/integrations/oauth-button"
);

describe("OAuthConnectButton", () => {
  it("targets property B when given B", () => {
    const el = OAuthConnectButton({
      provider: "google_ga4",
      propertyId: "prop-b",
      propertyName: "Building B",
    }) as { props: { href: string } };
    expect(el.props.href).toBe("/api/oauth/google-ga4/start?propertyId=prop-b");
  });

  it("stays org-wide without a property (single-property orgs)", () => {
    const el = OAuthConnectButton({ provider: "google_ga4" }) as { props: { href: string } };
    expect(el.props.href).toBe("/api/oauth/google-ga4/start");
  });
});
