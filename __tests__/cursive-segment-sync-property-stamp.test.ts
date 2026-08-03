import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Segment-sync property stamping (2026-08-02 SG focus).
//
// AL segment items carry no page URL, so per-event property attribution is
// impossible on this path. Rule under test (lib/properties/sole-active.ts):
// when the org has EXACTLY ONE ACTIVE property, stamp created visitors —
// and backfill existing null-propertyId visitors — with that property.
// Two or more ACTIVE properties -> never guess, propertyId stays null.
// A visitor already filed under a building is NEVER re-filed.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  cursiveIntegration: {
    findFirst: vi.fn(async () => ({
      cursiveSegmentId: "seg_1",
      installedOnDomain: "telegraphcommons.com",
    })),
    updateMany: vi.fn(async () => ({ count: 1 })),
  },
  visitor: {
    findFirst: vi.fn(async () => null as unknown),
    create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: "v_new",
      ...args.data,
    })),
    update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: "v_old",
      ...args.data,
    })),
  },
  property: {
    findMany: vi.fn(
      async (_args: { where: Record<string, unknown> }) =>
        [] as Array<{ id: string; name: string }>,
    ),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    cursiveIntegration: h.cursiveIntegration,
    visitor: h.visitor,
    property: h.property,
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenancy/scope", () => ({
  requireAgency: vi.fn(async () => ({ orgId: "agency", role: "AGENCY_OWNER" })),
  ForbiddenError: class ForbiddenError extends Error {},
  auditPayload: vi.fn(() => ({})),
}));
vi.mock("@/lib/email/pixel-emails", () => ({
  sendPixelReadyCustomerEmail: vi.fn(),
}));

const { runCursiveSegmentSync } = await import("@/lib/actions/admin-cursive");

const SEGMENT_ITEM = {
  profile_id: "prof_1",
  FIRST_NAME: "Ada",
  LAST_NAME: "Lovelace",
  PERSONAL_EMAIL: "ada@example.com",
};

function stubSegmentFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [SEGMENT_ITEM] }),
      text: async () => "",
    })),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CURSIVE_API_KEY", "test-key");
  stubSegmentFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("runCursiveSegmentSync — sole-launched-property stamping", () => {
  it("stamps a newly created visitor when the org has exactly one launched property", async () => {
    h.property.findMany.mockResolvedValueOnce([{ id: "prop_tc", name: "TC" }]);

    const result = await runCursiveSegmentSync("org_1");

    expect(result.ok).toBe(true);
    expect(h.visitor.create).toHaveBeenCalledTimes(1);
    expect(h.visitor.create.mock.calls[0][0].data).toMatchObject({
      orgId: "org_1",
      propertyId: "prop_tc",
    });
  });

  it("requires launchStatus LIVE, not just lifecycle ACTIVE — an unlaunched building has no pixel-bearing site", async () => {
    h.property.findMany.mockResolvedValueOnce([{ id: "prop_tc", name: "TC" }]);

    await runCursiveSegmentSync("org_1");

    // The sole-property query itself must exclude ONBOARDING/DRAFT/PAUSED
    // rows; without this an org whose single ACTIVE building is still
    // ONBOARDING (real: team, cleivas) gets visitors filed onto a
    // building that has no site.
    const [args] = h.property.findMany.mock.calls[0];
    expect(args.where).toMatchObject({
      orgId: "org_1",
      launchStatus: "LIVE",
      lifecycle: { in: ["ACTIVE"] },
    });
  });

  it("leaves propertyId null when the org has 2+ launched properties (never guess)", async () => {
    h.property.findMany.mockResolvedValueOnce([
      { id: "prop_a", name: "A" },
      { id: "prop_b", name: "B" },
    ]);

    await runCursiveSegmentSync("org_1");

    expect(h.visitor.create).toHaveBeenCalledTimes(1);
    expect(h.visitor.create.mock.calls[0][0].data).toMatchObject({
      propertyId: null,
    });
  });

  it("backfills an existing null-propertyId visitor on update", async () => {
    h.property.findMany.mockResolvedValueOnce([{ id: "prop_tc", name: "TC" }]);
    h.visitor.findFirst.mockResolvedValueOnce({
      id: "v_old",
      propertyId: null,
      cursiveVisitorId: "prof_1",
      status: "ANONYMOUS",
      firstName: null,
      lastName: null,
      email: null,
      phone: null,
      hashedEmail: null,
      lastSeenAt: new Date(0),
    });

    await runCursiveSegmentSync("org_1");

    expect(h.visitor.update).toHaveBeenCalledTimes(1);
    expect(h.visitor.update.mock.calls[0][0].data).toMatchObject({
      propertyId: "prop_tc",
    });
  });

  it("never re-files a visitor that already has a building", async () => {
    h.property.findMany.mockResolvedValueOnce([{ id: "prop_tc", name: "TC" }]);
    h.visitor.findFirst.mockResolvedValueOnce({
      id: "v_old",
      propertyId: "prop_other",
      cursiveVisitorId: "prof_1",
      status: "ANONYMOUS",
      firstName: null,
      lastName: null,
      email: null,
      phone: null,
      hashedEmail: null,
      lastSeenAt: new Date(0),
    });

    await runCursiveSegmentSync("org_1");

    expect(h.visitor.update).toHaveBeenCalledTimes(1);
    // backfillPropertyId keeps the existing binding (first-write-wins):
    // the update writes the SAME value back, never the sole property.
    expect(h.visitor.update.mock.calls[0][0].data).toMatchObject({
      propertyId: "prop_other",
    });
  });
});
