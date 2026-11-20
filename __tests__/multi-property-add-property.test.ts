import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

// ---------------------------------------------------------------------------
// Multi-property: an org that already runs property A adds property B after
// onboarding. Before: createProperty skipped the per-property scaffolding the
// onboarding wizard runs, so B had no PropertyChatbotConfig and its launch
// checklist showed "AI chatbot set up" as undone while A's was done. Running
// the onboarding scaffold as-is would also have force-enabled the org bot and
// B's bot even if the operator had switched the bot off. After: B gets its
// own row (persona = B's name) that inherits the org toggle.
// ---------------------------------------------------------------------------

let mockPrisma: MockPrisma & {
  tenantSiteConfig: { upsert: ReturnType<typeof vi.fn> };
};

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/billing/sync-subscription-quantity", () => ({
  syncSubscriptionQuantity: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/onboarding/step-detectors", () => ({
  syncOnboardingProgressInBackground: vi.fn(),
}));
vi.mock("@/lib/integrations/appfolio-backfill", () => ({
  requestAppfolioBackfill: vi.fn(),
}));

class ForbiddenErrorStub extends Error {}
const scope = {
  userId: "u1",
  clerkUserId: "clerk_u1",
  orgId: "org-1",
  actualOrgId: "org-1",
  orgType: "CLIENT",
  actualOrgType: "CLIENT",
  role: "CLIENT_OWNER",
  email: "owner@client.test",
  isAgency: false,
  isImpersonating: false,
  allowedPropertyIds: null,
};
vi.mock("@/lib/tenancy/scope", () => ({
  requireAgency: vi.fn(),
  requireWritableWorkspace: async () => scope,
  requireWorkspaceAdmin: async () => scope,
  ForbiddenError: ForbiddenErrorStub,
  auditPayload: (s: object, rest: object) => ({ ...s, ...rest }),
  propertyInScope: () => true,
}));

const { createProperty } = await import("@/lib/actions/properties");
const { scaffoldPropertyIntegrations } = await import("@/lib/onboarding/scaffold");

beforeEach(() => {
  mockPrisma = {
    ...createMockPrisma(),
    tenantSiteConfig: { upsert: vi.fn().mockResolvedValue({}) },
  } as typeof mockPrisma;
  mockPrisma.auditEvent.create.mockResolvedValue({});
  mockPrisma.propertyChatbotConfig.upsert.mockResolvedValue({});
  mockPrisma.property.findFirst.mockResolvedValue(null);
  mockPrisma.property.create.mockResolvedValue({
    id: "prop-b",
    name: "Building B",
    websiteUrl: null,
  });
});

describe("createProperty scaffolds property N+1 like onboarding did", () => {
  it("creates B's own chatbot row inheriting the org toggle, leaving the org config alone", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ moduleChatbot: true });

    const res = await createProperty({ name: "Building B", slug: "building-b" });

    expect(res).toEqual({ ok: true, propertyId: "prop-b" });
    expect(mockPrisma.propertyChatbotConfig.upsert).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.propertyChatbotConfig.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ propertyId: "prop-b" });
    expect(arg.update).toEqual({});
    expect(arg.create).toMatchObject({
      orgId: "org-1",
      propertyId: "prop-b",
      chatbotEnabled: null,
      chatbotPersonaName: "Building B",
    });
    expect(mockPrisma.tenantSiteConfig.upsert).not.toHaveBeenCalled();
  });

  it("scaffolds nothing when the org has no chatbot module", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ moduleChatbot: false });
    const res = await createProperty({ name: "Building B", slug: "building-b" });
    expect(res.ok).toBe(true);
    expect(mockPrisma.propertyChatbotConfig.upsert).not.toHaveBeenCalled();
  });

  it("still returns ok when scaffolding fails", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ moduleChatbot: true });
    mockPrisma.propertyChatbotConfig.upsert.mockRejectedValue(new Error("db down"));
    const res = await createProperty({ name: "Building B", slug: "building-b" });
    expect(res).toEqual({ ok: true, propertyId: "prop-b" });
  });
});

describe("scaffoldPropertyIntegrations onboarding default is unchanged", () => {
  it("onboarding still turns the org bot on and enables each property", async () => {
    await scaffoldPropertyIntegrations(
      "org-1",
      [{ id: "prop-a", name: "A", websiteUrl: null }],
      { chatbot: true },
    );
    expect(mockPrisma.tenantSiteConfig.upsert).toHaveBeenCalledTimes(1);
    expect(
      mockPrisma.propertyChatbotConfig.upsert.mock.calls[0][0].create.chatbotEnabled,
    ).toBe(true);
  });
});
