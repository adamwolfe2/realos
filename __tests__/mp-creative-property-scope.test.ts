import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression (multi-property): /portal/creative and /portal/creative/[id]
// filtered by org only, so a user restricted to prop-a listed and opened
// prop-b's creative requests (the API routes already gate with
// propertyInScope).
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  db: {
    creativeRequest: {
      findMany: vi.fn(async (_a?: any): Promise<any> => []),
      groupBy: vi.fn(async (_a?: any): Promise<any> => []),
      findFirst: vi.fn(async (_a?: any): Promise<any> => null),
    },
  },
  scope: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/tenancy/scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenancy/scope")>(
    "@/lib/tenancy/scope",
  );
  return { ...actual, requireScope: () => h.scope() };
});

const { default: CreativePage } = await import("@/app/portal/creative/page");
const { default: CreativeDetail } = await import("@/app/portal/creative/[id]/page");

const restrictedToA = { orgId: "org-1", allowedPropertyIds: ["prop-a"] };

beforeEach(() => vi.clearAllMocks());

describe("creative studio — restricted user on prop-a", () => {
  it("list and counts are limited to prop-a plus org-level requests", async () => {
    h.scope.mockResolvedValue(restrictedToA);
    await CreativePage();
    const expected = {
      orgId: "org-1",
      OR: [{ propertyId: "prop-a" }, { propertyId: null }],
    };
    expect(h.db.creativeRequest.findMany.mock.calls[0][0].where).toEqual(expected);
    expect(h.db.creativeRequest.groupBy.mock.calls[0][0].where).toEqual(expected);
  });

  it("unrestricted user keeps the org-wide list", async () => {
    h.scope.mockResolvedValue({ orgId: "org-1", allowedPropertyIds: null });
    await CreativePage();
    expect(h.db.creativeRequest.findMany.mock.calls[0][0].where).toEqual({ orgId: "org-1" });
  });

  it("detail 404s for a prop-b request", async () => {
    h.scope.mockResolvedValue(restrictedToA);
    h.db.creativeRequest.findFirst.mockResolvedValue({ id: "cr-b", propertyId: "prop-b" });
    await expect(
      CreativeDetail({ params: Promise.resolve({ id: "cr-b" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
