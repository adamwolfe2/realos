import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression (multi-property IDOR): property write actions only checked the
// org, so a user restricted to prop-a could edit prop-b's attributes,
// images and listings in the same org by posting prop-b's id.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  db: {
    property: { findFirst: vi.fn(), update: vi.fn() },
    listing: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    auditEvent: { create: vi.fn() },
  },
  scope: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/property-images/refresh", () => ({
  refreshPropertyImagesFromWebsite: h.refresh,
}));
vi.mock("@/lib/tenancy/scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenancy/scope")>(
    "@/lib/tenancy/scope",
  );
  return { ...actual, requireWritableWorkspace: () => h.scope() };
});

import { savePropertyAttributes } from "@/lib/actions/property-attributes";
import {
  scrapePropertyImagesAction,
  setPropertyImagesAction,
} from "@/lib/actions/property-images";
import {
  createListing,
  deleteListing,
  toggleListingAvailable,
} from "@/lib/actions/listings";

const restrictedToA = {
  orgId: "org-1",
  userId: "u1",
  allowedPropertyIds: ["prop-a"],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.scope.mockResolvedValue(restrictedToA);
  // Both properties exist in the org — only the grant should stop the write.
  h.db.property.findFirst.mockImplementation(
    async ({ where }: { where: { id: string } }) => ({ id: where.id }),
  );
  h.db.listing.findFirst.mockResolvedValue({ id: "l-b", propertyId: "prop-b" });
});

describe("property write actions — restricted user on prop-a, target prop-b", () => {
  it("savePropertyAttributes refuses prop-b", async () => {
    const r = await savePropertyAttributes({ propertyId: "prop-b", profileTags: [] });
    expect(r.ok).toBe(false);
    expect(h.db.property.update).not.toHaveBeenCalled();
  });

  it("savePropertyAttributes still allows prop-a", async () => {
    const r = await savePropertyAttributes({ propertyId: "prop-a", profileTags: [] });
    expect(r.ok).toBe(true);
    expect(h.db.property.update).toHaveBeenCalled();
  });

  it("setPropertyImagesAction refuses prop-b", async () => {
    const r = await setPropertyImagesAction({ propertyId: "prop-b", logoUrl: null });
    expect(r.ok).toBe(false);
    expect(h.db.property.update).not.toHaveBeenCalled();
  });

  it("scrapePropertyImagesAction refuses prop-b", async () => {
    const r = await scrapePropertyImagesAction({ propertyId: "prop-b" });
    expect(r.ok).toBe(false);
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it("createListing refuses prop-b", async () => {
    const fd = new FormData();
    fd.set("propertyId", "prop-b");
    fd.set("unitType", "Studio");
    const r = await createListing(fd);
    expect(r.ok).toBe(false);
    expect(h.db.listing.create).not.toHaveBeenCalled();
  });

  it("deleteListing refuses a prop-b listing", async () => {
    const r = await deleteListing("l-b");
    expect(r.ok).toBe(false);
    expect(h.db.listing.delete).not.toHaveBeenCalled();
  });

  it("toggleListingAvailable refuses a prop-b listing", async () => {
    const r = await toggleListingAvailable("l-b", false);
    expect(r.ok).toBe(false);
    expect(h.db.listing.update).not.toHaveBeenCalled();
  });
});
