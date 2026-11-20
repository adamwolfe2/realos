import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Multi-property: the setup page's "Connect your data" step passes the
// selected property to getConnectStatusForOrg. Before: `connected` was
// property-aware but the account label / last sync came from the org's
// first GA4 row (property A's) and any errored row anywhere (A's) marked
// property B "Needs attention". After: only B's own rows plus org-wide
// (propertyId=null) rows describe B, B's own row first.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  appFolioIntegration: { findFirst: vi.fn() },
  seoIntegration: { findMany: vi.fn() },
  adAccount: { findMany: vi.fn() },
  domainBinding: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: h }));

const { getConnectStatusForOrg } = await import("@/lib/connect/status");

const recent = new Date();
const rowA = {
  provider: "GA4",
  lastSyncAt: recent,
  propertyIdentifier: "111",
  propertyId: "prop-a",
  status: "ERROR",
  lastSyncError: "token revoked",
};
const rowB = {
  provider: "GA4",
  lastSyncAt: recent,
  propertyIdentifier: "222",
  propertyId: "prop-b",
  status: "ACTIVE",
  lastSyncError: null,
};

beforeEach(() => {
  h.appFolioIntegration.findFirst.mockResolvedValue(null);
  h.adAccount.findMany.mockResolvedValue([]);
  h.domainBinding.findFirst.mockResolvedValue(null);
  h.seoIntegration.findMany.mockResolvedValue([rowA, rowB]);
});

const ga4 = async (active?: string | null) =>
  (await getConnectStatusForOrg("org-1", active)).find((s) => s.id === "ga4")!;

describe("connect status per selected property", () => {
  it("property B shows its own GA4 account and is not errored by A's broken row", async () => {
    const s = await ga4("prop-b");
    expect(s.connected).toBe(true);
    expect(s.accountLabel).toBe("Property 222");
    expect(s.hasError).toBe(false);
  });

  it("property A still shows its own error", async () => {
    const s = await ga4("prop-a");
    expect(s.accountLabel).toBe("Property 111");
    expect(s.hasError).toBe(true);
  });

  it("a third property with no row is not connected and not errored", async () => {
    const s = await ga4("prop-c");
    expect(s.connected).toBe(false);
    expect(s.accountLabel).toBeNull();
    expect(s.hasError).toBe(false);
  });

  it("an org-wide row still counts for a property without its own row", async () => {
    h.seoIntegration.findMany.mockResolvedValue([
      rowA,
      { ...rowB, propertyId: null, propertyIdentifier: "999" },
    ]);
    const s = await ga4("prop-c");
    expect(s.connected).toBe(true);
    expect(s.accountLabel).toBe("Property 999");
  });

  it("org-wide view keeps OR-ing errors across every row", async () => {
    const s = await ga4(null);
    expect(s.connected).toBe(true);
    expect(s.hasError).toBe(true);
    expect(s.scopedPropertyIds).toEqual(["prop-a", "prop-b"]);
  });
});
