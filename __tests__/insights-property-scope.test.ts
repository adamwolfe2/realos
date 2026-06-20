import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression for P1-2: getOpenInsights must scope to the gated property list
// when `propertyIds` is passed, mirroring getInsightCounts — so a
// property-restricted user can never reach the unfiltered org-wide branch.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({ findMany: vi.fn(async () => []) }));
vi.mock("@/lib/db", () => ({ prisma: { insight: { findMany: h.findMany } } }));

import { getOpenInsights } from "@/lib/insights/queries";

// vi.fn() types .mock.calls as empty tuples; read the latest where as `any`.
const whereOf = (): any => (h.findMany.mock.calls.at(-1) as any[])[0].where;

beforeEach(() => h.findMany.mockClear());

describe("getOpenInsights property scoping (P1-2)", () => {
  it("scopes to an explicit multi-property gated list", async () => {
    await getOpenInsights("org_1", { propertyIds: ["a", "b"] });
    expect(whereOf().propertyId).toEqual({ in: ["a", "b"] });
    expect(whereOf().orgId).toBe("org_1");
  });

  it("scopes to a single gated property", async () => {
    await getOpenInsights("org_1", { propertyIds: ["a"] });
    expect(whereOf().propertyId).toBe("a");
  });

  it("a non-matching sentinel id (access-denied scope) matches nothing", async () => {
    await getOpenInsights("org_1", { propertyIds: ["__access_denied__"] });
    expect(whereOf().propertyId).toBe("__access_denied__");
  });

  it("an EXPLICIT empty gated list is fail-closed (match nothing, NOT org-wide)", async () => {
    // Restricted user whose entire selection is out of bounds → effectiveIds=[].
    // Must never fall through to the unfiltered org-wide query.
    await getOpenInsights("org_1", { propertyIds: [] });
    expect(whereOf().propertyId).toEqual({ in: [] });
  });

  it("still supports the single propertyId path for already-scoped callers", async () => {
    await getOpenInsights("org_1", { propertyId: "single" });
    expect(whereOf().propertyId).toBe("single");
  });

  it("unrestricted (no propertyIds / propertyId) stays org-wide", async () => {
    await getOpenInsights("org_1", { limit: 3 });
    expect(whereOf().propertyId).toBeUndefined();
  });

  it("explicit null propertyIds (unrestricted user) is org-wide", async () => {
    await getOpenInsights("org_1", { propertyIds: null });
    expect(whereOf().propertyId).toBeUndefined();
  });
});
