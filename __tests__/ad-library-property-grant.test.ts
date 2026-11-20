import { beforeEach, describe, expect, it, vi } from "vitest";

// A leasing agent limited to The Lair could track competitors under
// Southgate and rescan or delete Southgate's tracked competitors: the
// actions only checked the org.

const h = vi.hoisted(() => ({
  requireWritableWorkspace: vi.fn(),
  scan: vi.fn(),
  db: {
    property: { findFirst: vi.fn() },
    adLibraryAdvertiser: { upsert: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
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
});
