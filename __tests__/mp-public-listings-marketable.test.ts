import { describe, it, expect, vi } from "vitest";

// Regression (multi-property): the public tenant-site listings endpoint
// returned every Property row in the org, including EXCLUDED / IMPORTED
// address-only rows from an AppFolio sync, not just the enabled buildings.

const h = vi.hoisted(() => ({ findMany: vi.fn(async (_a?: any): Promise<any> => []) }));
vi.mock("@/lib/db", () => ({ prisma: { property: { findMany: h.findMany } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/tenancy/resolve", () => ({ readTenantHeaders: () => ({ orgId: "org-1" }) }));

import { GET } from "@/app/api/tenant/listings/route";

describe("GET /api/tenant/listings", () => {
  it("only returns marketable (ACTIVE) properties", async () => {
    const res = await GET(new Request("http://x/api/tenant/listings"));
    expect(res.status).toBe(200);
    const where = h.findMany.mock.calls[0][0].where;
    expect(where.orgId).toBe("org-1");
    expect(where.lifecycle).toEqual({ in: ["ACTIVE"] });
  });
});
