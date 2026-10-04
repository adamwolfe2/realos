import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";
import type { MappedTenant } from "@/lib/integrations/appfolio";

let mockPrisma: MockPrisma;
vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

import { countTenantLeadMatches } from "@/lib/integrations/appfolio-sync";

// F-049: tenant-match phase issues one lead query total, no per-lead findFirst.
describe("countTenantLeadMatches", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  it("counts matched leads with a single findMany and no findFirst", async () => {
    const tenants = new Map<string, MappedTenant>([
      ["a@x.com", {} as MappedTenant],
      ["b@x.com", {} as MappedTenant],
    ]);
    mockPrisma.lead.findMany.mockResolvedValue([
      { email: "a@x.com" },
      { email: "b@x.com" },
      { email: "a@x.com" },
      { email: null },
    ]);
    const n = await countTenantLeadMatches("org-1", new Set(tenants.keys()), tenants);
    expect(n).toBe(3);
    expect(mockPrisma.lead.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();
  });

  it("skips the query with no tenant emails", async () => {
    expect(await countTenantLeadMatches("org-1", new Set(), new Map())).toBe(0);
    expect(mockPrisma.lead.findMany).not.toHaveBeenCalled();
  });
});
