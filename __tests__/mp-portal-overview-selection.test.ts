import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression (multi-property): the /portal overview read only the user's
// grant and ignored the sidebar switcher, so with properties A and B live
// and B selected, every KPI, chart and the property list still pooled A+B.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => {
  const calls: Array<{ model: string; method: string; args: unknown }> = [];
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_t, method: string) => async (args: unknown) => {
          calls.push({ model: name, method, args });
          if (method === "findMany" || method === "groupBy") return [];
          // Cookie validation: the cookie's property is marketable in org-1.
          if (name === "property" && method === "findFirst") {
            return { id: (args as { where: { id: string } }).where.id };
          }
          return null;
        },
      },
    );
  return {
    calls,
    prisma: new Proxy({}, { get: (_t, name: string) => model(name) }),
    scope: vi.fn(),
    cookie: vi.fn(async () => null as string | null),
  };
});

vi.mock("@/lib/db", () => ({ prisma: h.prisma }));
vi.mock("@/lib/portal/active-property", () => ({
  getActivePropertyId: () => h.cookie(),
  setActivePropertyId: vi.fn(async () => {}),
}));
vi.mock("@/lib/portal/first-run", () => ({
  getFirstRunSignal: async () => ({ isFirstRun: false }),
}));
vi.mock("@/lib/integrations/status", () => ({
  resolveIntegrationStatuses: async () => [],
}));
vi.mock("@/lib/leasing/summary", () => ({ getLeasingSummary: async () => null }));
vi.mock("@/lib/tenancy/scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenancy/scope")>(
    "@/lib/tenancy/scope",
  );
  return { ...actual, requireScope: () => h.scope() };
});

const { default: PortalOverview } = await import("@/app/portal/page");

function whereOf(model: string, method = "findMany") {
  const c = h.calls.find((x) => x.model === model && x.method === method);
  return (c?.args as { where: Record<string, unknown> }).where;
}

beforeEach(() => {
  h.calls.length = 0;
  h.cookie.mockResolvedValue(null);
});

describe("/portal overview honours the active property", () => {
  it("scopes properties, chats and leads to the switcher's property B", async () => {
    h.scope.mockResolvedValue({ orgId: "org-1", allowedPropertyIds: null });
    h.cookie.mockResolvedValue("prop-b");
    await PortalOverview({ searchParams: Promise.resolve({ dashboard: "1" }) });
    expect(whereOf("property")).toMatchObject({ id: { in: ["prop-b"] } });
    expect(whereOf("chatbotConversation")).toMatchObject({
      AND: [{ propertyId: { in: ["prop-b"] } }],
    });
    expect(whereOf("lead", "groupBy")).toMatchObject({
      AND: [{ propertyId: { in: ["prop-b"] } }],
    });
  });

  it("no selection, unrestricted: portfolio view stays unfiltered by id", async () => {
    h.scope.mockResolvedValue({ orgId: "org-1", allowedPropertyIds: null });
    await PortalOverview({ searchParams: Promise.resolve({ dashboard: "1" }) });
    expect(whereOf("property")).not.toHaveProperty("id");
  });

  it("restricted user selecting a property outside the grant sees nothing", async () => {
    h.scope.mockResolvedValue({ orgId: "org-1", allowedPropertyIds: ["prop-a"] });
    await PortalOverview({ searchParams: Promise.resolve({ dashboard: "1", property: "prop-b" }) });
    expect(whereOf("property")).toMatchObject({ id: { in: [] } });
  });
});
