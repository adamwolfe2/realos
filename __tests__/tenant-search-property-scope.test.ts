import { beforeEach, describe, expect, it, vi } from "vitest";

// Cmd+K search must not return leads / conversations from buildings a
// property-restricted user can't access (review 2026-09-26).
const h = vi.hoisted(() => ({
  scope: { orgId: "org_1", allowedPropertyIds: ["prop_a"] as string[] | null },
  lead: vi.fn(async (_a: { where: Record<string, unknown> }) => []),
  visitor: vi.fn(async (_a: { where: Record<string, unknown> }) => []),
  property: vi.fn(async (_a: { where: Record<string, unknown> }) => []),
  conversation: vi.fn(async (_a: { where: Record<string, unknown> }) => []),
}));

vi.mock("@/lib/tenancy/scope", () => ({
  requireScope: async () => h.scope,
  tenantWhere: (s: { orgId: string }) => ({ orgId: s.orgId }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findMany: h.lead },
    visitor: { findMany: h.visitor },
    property: { findMany: h.property },
    chatbotConversation: { findMany: h.conversation },
  },
}));

const { GET } = await import("@/app/api/tenant/search/route");
const search = () =>
  GET(new Request("https://x/api/tenant/search?q=gmail") as never);

describe("tenant search property scoping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("restricted user: every entity query is limited to allowed buildings", async () => {
    h.scope.allowedPropertyIds = ["prop_a"];
    await search();
    expect(h.lead.mock.calls[0][0].where.AND).toEqual([{ propertyId: "prop_a" }]);
    expect(h.property.mock.calls[0][0].where.AND).toEqual([{ id: "prop_a" }]);
    expect(h.conversation.mock.calls[0][0].where.AND).toEqual([
      { OR: [{ propertyId: "prop_a" }, { propertyId: null }] },
    ]);
    // The text-match OR survives alongside the scope.
    expect(h.conversation.mock.calls[0][0].where.OR).toBeDefined();
  });

  it("unrestricted user: no property narrowing", async () => {
    h.scope.allowedPropertyIds = null;
    await search();
    expect(h.lead.mock.calls[0][0].where.AND).toEqual([{}]);
  });
});
