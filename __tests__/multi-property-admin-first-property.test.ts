import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Scaffolding parity: the agency's "create client" path provisions a first
// property. Before: it landed with the schema default lifecycle (IMPORTED),
// so it was missing from /portal/setup, the property switcher and every
// marketable count, and it got no chatbot row (onboarding and createProperty
// both scaffold one). After: ACTIVE/OPERATOR and the same idempotent scaffold
// createProperty runs (inherit the org chatbot toggle).
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  tx: {
    organization: { create: vi.fn(async () => ({ id: "org-new", name: "Acme", slug: "acme" })) },
    project: { create: vi.fn(async () => ({})) },
    property: { create: vi.fn(async () => ({ id: "prop-1", name: "Building One", websiteUrl: null })) },
    auditEvent: { create: vi.fn(async () => ({})) },
  },
  scaffold: vi.fn(async () => undefined),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => {
    throw new Error("clerk unavailable in test");
  },
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) },
    clientNote: { create: vi.fn(async () => ({})) },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(h.tx),
  },
}));
vi.mock("@/lib/onboarding/scaffold", () => ({
  scaffoldPropertyIntegrations: h.scaffold,
}));
vi.mock("@/lib/tenancy/scope", () => ({
  ForbiddenError: class extends Error {},
  requireAgency: async () => ({ userId: "u1", orgId: "agency", clerkUserId: "c1" }),
  auditPayload: (_s: unknown, d: object) => d,
}));
vi.mock("@/lib/email/onboarding-emails", () => ({
  sendClientPortalReadyEmail: vi.fn(),
  sendTeammateInviteEmail: vi.fn(),
}));
vi.mock("@/lib/actions/client-provisioning", () => ({
  pickUniqueSlug: async () => "acme",
  deriveSlug: () => "building-one",
  deriveModuleFlags: (keys: string[]) => ({ moduleChatbot: keys.includes("chatbot") }),
}));

const { createClientDirect } = await import("@/lib/actions/create-client");

const input = {
  companyName: "Acme Living",
  propertyType: "RESIDENTIAL",
  primaryContactName: "Pat Owner",
  primaryContactEmail: "pat@acme.test",
  modules: ["chatbot"],
  firstPropertyName: "Building One",
  sendInvite: false,
};

beforeEach(() => {
  h.tx.property.create.mockClear();
  h.scaffold.mockClear();
});

describe("createClientDirect first property", () => {
  it("lands ACTIVE and gets the same chatbot scaffold as property N+1", async () => {
    await createClientDirect(input);
    const data = (h.tx.property.create.mock.calls[0] as any[])[0].data;
    expect(data.lifecycle).toBe("ACTIVE");
    expect(data.lifecycleSetBy).toBe("OPERATOR");
    expect(h.scaffold).toHaveBeenCalledWith(
      "org-new",
      [{ id: "prop-1", name: "Building One", websiteUrl: null }],
      { chatbot: true },
      { inheritOrgChatbotToggle: true },
    );
  });

  it("does not scaffold when no first property was named", async () => {
    await createClientDirect({ ...input, firstPropertyName: "" });
    expect(h.tx.property.create).not.toHaveBeenCalled();
    expect(h.scaffold).not.toHaveBeenCalled();
  });
});
