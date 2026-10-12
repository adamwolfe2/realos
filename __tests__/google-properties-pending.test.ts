import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ScopedContext } from "@/lib/tenancy/scope";

// The picker/bind propertyId comes from the URL or form. A property-restricted
// admin must not reach another property's pending GA4/GSC row with it.

const h = vi.hoisted(() => ({
  findFirst: vi.fn(),
  listGa4: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { seoIntegration: { findFirst: h.findFirst } } }));
vi.mock("@/lib/integrations/ga4", () => ({ authFromStoredCredentials: vi.fn(() => ({})) }));
vi.mock("@/lib/integrations/gsc", () => ({ authFromStoredCredentials: vi.fn(() => ({})) }));
vi.mock("@/lib/integrations/seo-sync", () => ({ PENDING_OAUTH_BIND: "PENDING_OAUTH_BIND" }));
vi.mock("googleapis", () => ({
  google: {
    analyticsadmin: () => ({ accountSummaries: { list: h.listGa4 } }),
  },
}));

const { loadPendingSeoOptions } = await import("@/lib/integrations/google-properties");

const restricted = { orgId: "org1", allowedPropertyIds: ["prop-1"] } as ScopedContext;

describe("loadPendingSeoOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.findFirst.mockResolvedValue({
      id: "row1",
      serviceAccountJsonEncrypted: "enc",
      property: { name: "Tower A" },
    });
    h.listGa4.mockResolvedValue({ data: { accountSummaries: [] } });
  });

  it("refuses a property outside the admin's grants without querying", async () => {
    const r = await loadPendingSeoOptions(restricted, "GA4", "prop-2");
    expect(r).toEqual({ row: null });
    expect(h.findFirst).not.toHaveBeenCalled();
  });

  it("loads the pending row scoped to the granted property", async () => {
    const r = await loadPendingSeoOptions(restricted, "GA4", "prop-1");
    expect(r.row).toEqual({ id: "row1", propertyName: "Tower A" });
    expect(h.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId: "org1",
          provider: "GA4",
          propertyId: "prop-1",
          propertyIdentifier: "PENDING_OAUTH_BIND",
        },
      }),
    );
  });
});
