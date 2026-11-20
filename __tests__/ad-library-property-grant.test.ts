import { beforeEach, describe, expect, it, vi } from "vitest";

// A leasing agent limited to The Lair could track competitors under
// Southgate and rescan or delete Southgate's tracked competitors: the
// actions only checked the org.

const h = vi.hoisted(() => ({
  requireWritableWorkspace: vi.fn(),
  scan: vi.fn(),
  db: {
    property: { findFirst: vi.fn() },
    adLibraryAdvertiser: { upsert: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenancy/scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenancy/scope")>("@/lib/tenancy/scope");
  return { ...actual, requireWritableWorkspace: () => h.requireWritableWorkspace() };
});
vi.mock("@/lib/integrations/ad-library", () => ({
  parseAdvertiserInput: (raw: string) => ({ searchKind: "KEYWORD", searchValue: raw, displayName: raw }),
  scanAdvertiser: (...a: unknown[]) => h.scan(...a),
}));

const { trackAdvertiserAction, rescanAdvertiserAction, untrackAdvertiserAction } = await import(
  "@/lib/actions/ad-library"
);

beforeEach(() => {
  vi.clearAllMocks();
  h.requireWritableWorkspace.mockResolvedValue({ orgId: "org-1", allowedPropertyIds: ["p-lair"] });
  h.db.property.findFirst.mockResolvedValue({ id: "p-southgate" });
  h.db.adLibraryAdvertiser.findFirst.mockResolvedValue({ id: "adv-1", propertyId: "p-southgate" });
  h.db.adLibraryAdvertiser.findUnique.mockResolvedValue(null);
  h.db.adLibraryAdvertiser.upsert.mockResolvedValue({ id: "adv-new" });
  h.scan.mockResolvedValue({ ok: true, found: 0, newCount: 0, inactiveCount: 0 });
});

describe("ad library actions respect the property grant", () => {
  it("cannot track a competitor under another building", async () => {
    const res = await trackAdvertiserAction({ raw: "Rival Apartments", propertyId: "p-southgate" });
    expect(res.ok).toBe(false);
    expect(h.db.adLibraryAdvertiser.upsert).not.toHaveBeenCalled();
  });

  it("cannot rescan or delete another building's competitor", async () => {
    expect((await rescanAdvertiserAction("adv-1")).ok).toBe(false);
    expect((await untrackAdvertiserAction("adv-1")).ok).toBe(false);
    expect(h.scan).not.toHaveBeenCalled();
    expect(h.db.adLibraryAdvertiser.delete).not.toHaveBeenCalled();
  });

  it("still works on the user's own building", async () => {
    h.db.adLibraryAdvertiser.findFirst.mockResolvedValue({ id: "adv-2", propertyId: "p-lair" });
    expect((await untrackAdvertiserAction("adv-2")).ok).toBe(true);
  });

  it("cannot create an org-wide row or tag an unknown property", async () => {
    expect((await trackAdvertiserAction({ raw: "Rival Apartments" })).ok).toBe(false);
    h.requireWritableWorkspace.mockResolvedValue({ orgId: "org-1", allowedPropertyIds: null });
    h.db.property.findFirst.mockResolvedValue(null);
    expect((await trackAdvertiserAction({ raw: "Rival Apartments", propertyId: "p-other-org" })).ok).toBe(false);
    expect(h.db.adLibraryAdvertiser.upsert).not.toHaveBeenCalled();
  });

  it("cannot re-track another building's competitor onto their own", async () => {
    h.db.property.findFirst.mockResolvedValue({ id: "p-lair" });
    h.db.adLibraryAdvertiser.findUnique.mockResolvedValue({ propertyId: "p-southgate" });
    const res = await trackAdvertiserAction({ raw: "Rival Apartments", propertyId: "p-lair" });
    expect(res.ok).toBe(false);
    expect(h.db.adLibraryAdvertiser.upsert).not.toHaveBeenCalled();
  });

  it("cannot delete an org-wide competitor", async () => {
    h.db.adLibraryAdvertiser.findFirst.mockResolvedValue({ id: "adv-org", propertyId: null });
    expect((await untrackAdvertiserAction("adv-org")).ok).toBe(false);
    expect(h.db.adLibraryAdvertiser.delete).not.toHaveBeenCalled();
  });

  it("tracks a new competitor on their own building", async () => {
    h.db.property.findFirst.mockResolvedValue({ id: "p-lair" });
    expect((await trackAdvertiserAction({ raw: "Rival Apartments", propertyId: "p-lair" })).ok).toBe(true);
    expect(h.db.adLibraryAdvertiser.upsert.mock.calls[0][0].create.propertyId).toBe("p-lair");
  });
});
