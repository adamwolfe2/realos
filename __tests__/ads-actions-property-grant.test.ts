import { beforeEach, describe, expect, it, vi } from "vitest";

// Southgate and The Lair; a CLIENT_ADMIN limited to The Lair. They could
// dismiss Southgate's ad suggestions and change the org-wide ad data
// retention (which deletes Southgate's history too).

const h = vi.hoisted(() => ({
  requireWritableWorkspace: vi.fn(),
  db: {
    insight: { findFirst: vi.fn(), update: vi.fn() },
    organization: { findUnique: vi.fn(), update: vi.fn() },
    adCampaign: { findFirst: vi.fn(), update: vi.fn() },
    property: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenancy/scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenancy/scope")>("@/lib/tenancy/scope");
  return {
    ...actual,
    requireScope: () => h.requireWritableWorkspace(),
    requireWritableWorkspace: () => h.requireWritableWorkspace(),
  };
});

const { dismissInsight, acknowledgeInsight } = await import("@/app/portal/insights/actions");
const { setAdRetentionOverride } = await import("@/app/portal/ads/retention-actions");
const { setCampaignProperty } = await import("@/app/portal/ads/campaign-property-actions");

const lairAdmin = { orgId: "org-1", userId: "u", role: "CLIENT_ADMIN", allowedPropertyIds: ["p-lair"] };

beforeEach(() => {
  vi.clearAllMocks();
  h.requireWritableWorkspace.mockResolvedValue(lairAdmin);
  h.db.organization.findUnique.mockResolvedValue({ subscriptionTier: "SCALE", adDataRetentionMonths: null });
});

describe("ads suggestion actions", () => {
  it("rejects acting on another building's suggestion", async () => {
    h.db.insight.findFirst.mockResolvedValue({ id: "i1", propertyId: "p-southgate" });
    expect(await dismissInsight("i1")).toHaveProperty("error");
    expect(await acknowledgeInsight("i1")).toHaveProperty("error");
    expect(h.db.insight.update).not.toHaveBeenCalled();
  });

  it("allows the user's own building", async () => {
    h.db.insight.findFirst.mockResolvedValue({ id: "i2", propertyId: "p-lair" });
    expect(await acknowledgeInsight("i2")).toEqual({ success: true });
  });
});

describe("ad retention override", () => {
  it("a property-restricted admin can't change org-wide retention", async () => {
    expect(await setAdRetentionOverride(3)).toHaveProperty("error");
    expect(h.db.organization.update).not.toHaveBeenCalled();
  });

  it("a full-portfolio admin still can", async () => {
    h.requireWritableWorkspace.mockResolvedValue({ ...lairAdmin, allowedPropertyIds: null });
    expect(await setAdRetentionOverride(3)).toEqual({ success: true, months: 3 });
  });
});

describe("campaign property picker", () => {
  it("a property-restricted admin can't reassign campaigns", async () => {
    expect(await setCampaignProperty("c1", "p-lair")).toHaveProperty("error");
    expect(h.db.adCampaign.update).not.toHaveBeenCalled();
  });

  it("rejects a property outside the org for a full-portfolio admin", async () => {
    h.requireWritableWorkspace.mockResolvedValue({ ...lairAdmin, allowedPropertyIds: null });
    h.db.adCampaign.findFirst.mockResolvedValue({ id: "c1" });
    h.db.property.findFirst.mockResolvedValue(null);
    expect(await setCampaignProperty("c1", "p-other-org")).toHaveProperty("error");
    expect(h.db.adCampaign.update).not.toHaveBeenCalled();
  });
});
