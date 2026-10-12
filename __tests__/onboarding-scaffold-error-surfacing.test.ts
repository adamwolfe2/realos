import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression for AUTH-ONBOARDING-D003: scaffoldPropertyIntegrations used to
// swallow every per-property prisma failure with `.catch(() => undefined)`,
// so its returned promise NEVER rejected. The caller
// (app/api/onboarding/wizard/properties/route.ts) wraps the call in
// `.catch((err) => Sentry.captureException(err))` specifically so a broken
// scaffold step is visible — but that .catch was dead code, because the
// inner promise always resolved regardless of what actually happened.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  tenantSiteConfig: { upsert: vi.fn(async () => ({})) },
  propertyChatbotConfig: { upsert: vi.fn(async () => ({})) },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    tenantSiteConfig: h.tenantSiteConfig,
    propertyChatbotConfig: h.propertyChatbotConfig,
  },
}));

const { scaffoldPropertyIntegrations } = await import(
  "@/lib/onboarding/scaffold"
);

beforeEach(() => {
  h.tenantSiteConfig.upsert.mockReset().mockResolvedValue({});
  h.propertyChatbotConfig.upsert.mockReset().mockResolvedValue({});
});

const properties = [
  { id: "prop_1", name: "Building One", websiteUrl: null },
  { id: "prop_2", name: "Building Two", websiteUrl: null },
];

describe("scaffoldPropertyIntegrations error surfacing (AUTH-ONBOARDING-D003)", () => {
  it("rejects when a per-property chatbot upsert fails, instead of resolving silently", async () => {
    h.propertyChatbotConfig.upsert.mockRejectedValueOnce(
      new Error("db unreachable"),
    );
    await expect(
      scaffoldPropertyIntegrations("org_1", properties, {
        chatbot: true,
      }),
    ).rejects.toThrow(/db unreachable/);
  });

  it("still attempts every remaining property/step after one failure", async () => {
    h.propertyChatbotConfig.upsert.mockRejectedValueOnce(
      new Error("prop_1 failed"),
    );
    await expect(
      scaffoldPropertyIntegrations("org_1", properties, {
        chatbot: true,
      }),
    ).rejects.toThrow();
    // prop_2's chatbot upsert must still have been attempted.
    expect(h.propertyChatbotConfig.upsert).toHaveBeenCalledTimes(2);
  });

  it("rejects when the org tenant site config upsert fails", async () => {
    h.tenantSiteConfig.upsert.mockRejectedValueOnce(
      new Error("site config failed"),
    );
    await expect(
      scaffoldPropertyIntegrations("org_1", properties, { chatbot: true }),
    ).rejects.toThrow(/site config failed/);
  });

  it("resolves cleanly when nothing fails", async () => {
    await expect(
      scaffoldPropertyIntegrations("org_1", properties, {
        chatbot: true,
      }),
    ).resolves.toBeUndefined();
  });
});
