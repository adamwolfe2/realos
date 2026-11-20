import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Multi-property regressions for runAppfolioSync, driven end to end with an
 * in-memory Property table and stubbed AppFolio reports.
 *
 * Org has two ACTIVE buildings:
 *   A "Alpha House" (already linked, AppFolio id af-A)
 *   B "Oak Commons" (operator-created, no AppFolio id yet, 200 Oak St)
 * AppFolio's property_directory lists B's parking sub-record FIRST, at the
 * same street address as B, then B itself.
 */

type Prop = {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  addressLine1: string | null;
  backendPlatform: string;
  backendPropertyId: string | null;
  backendPropertyGroup: string | null;
  lifecycle: string;
  lifecycleSetBy: string;
};

const state = vi.hoisted(() => ({
  props: [] as Prop[],
  reports: {} as Record<string, Record<string, unknown>[]>,
  fetchCalls: [] as Array<{ report: string; fromDate?: Date }>,
  leaseCreates: [] as Array<Record<string, unknown>>,
  leadCreates: [] as Array<Record<string, unknown>>,
  groupFilter: null as string | null,
  failReports: new Set<string>(),
  backfillRequestedAt: null as Date | null,
  lastSyncStats: null as unknown,
  integrationUpdates: [] as Array<Record<string, unknown>>,
  listingCreates: [] as Array<Record<string, unknown>>,
}));

function eqI(a: string | null, b: string) {
  return a != null && a.toLowerCase() === b.toLowerCase();
}

function matchProp(p: Prop, where: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (k === "OR") {
      if (!(v as Record<string, unknown>[]).some((w) => matchProp(p, w))) return false;
    } else if (k === "name" || k === "addressLine1") {
      if (!eqI(p[k], (v as { equals: string }).equals)) return false;
    } else if (k === "id" && v && typeof v === "object") {
      if (!(v as { in: string[] }).in.includes(p.id)) return false;
    } else if ((p as unknown as Record<string, unknown>)[k] !== v) {
      return false;
    }
  }
  return true;
}

function autoModel(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return new Proxy(overrides, {
      get(target, method: string) {
        if (method in target) return target[method];
        return vi.fn(async (args?: { data?: Record<string, unknown> }) => {
          if (method === "findMany" || method === "groupBy") return [];
          if (method === "findFirst" || method === "findUnique") return null;
          if (method === "count") return 0;
          if (method === "updateMany" || method === "deleteMany") return { count: 0 };
          return { id: `auto-${method}`, ...(args?.data ?? {}) };
        });
      },
    });
}

const prismaMock = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("@/lib/integrations/appfolio", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integrations/appfolio")>(
    "@/lib/integrations/appfolio",
  );
  return {
    ...actual,
    appfolioRestClient: () => ({ subdomain: "x", fetchReport: vi.fn() }),
    fetchAppfolioV1Showings: async () => [],
    fetchAllPages: async (
      _client: unknown,
      report: string,
      opts?: { fromDate?: Date },
    ) => {
      state.fetchCalls.push({ report, fromDate: opts?.fromDate });
      if (state.failReports.has(report)) throw new Error(`${report} 503`);
      return state.reports[report] ?? [];
    },
  };
});

import { runAppfolioSync } from "@/lib/integrations/appfolio-sync";

const NOW_MINUS_1H = new Date(Date.now() - 60 * 60 * 1000);

function setupPrisma() {
  for (const k of Object.keys(prismaMock)) delete prismaMock[k];
  const property = {
    findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      state.props.filter((p) => matchProp(p, where)),
    ),
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      state.props.find((p) => matchProp(p, where)) ?? null,
    ),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const p = state.props.find((x) => x.id === where.id)!;
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) (p as unknown as Record<string, unknown>)[k] = v;
      }
      return p;
    }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const p = { id: `new-${data.backendPropertyId}`, ...data } as unknown as Prop;
      state.props.push(p);
      return p;
    }),
    updateMany: vi.fn(async () => ({ count: 0 })),
  };
  const listing = autoModel({
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      state.listingCreates.push(data);
      return { id: `listing-${data.backendListingId}`, ...data };
    }),
    findMany: vi.fn(async ({ where }: { where: { propertyId: { in: string[] } } }) =>
      state.listingCreates
        .filter((l) => where.propertyId.in.includes(l.propertyId as string))
        .map((l) => ({
          id: `listing-${l.backendListingId}`,
          propertyId: l.propertyId,
          backendListingId: l.backendListingId,
        })),
    ),
  });
  const lease = autoModel({
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      state.leaseCreates.push(data);
      return { id: `lease-${data.externalId}` };
    }),
  });
  Object.assign(prismaMock, {
    appFolioIntegration: autoModel({
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.integrationUpdates.push(data);
        return {};
      }),
      findUnique: vi.fn(async () => ({
        id: "int-1",
        orgId: "org-1",
        clientIdEncrypted: "cid",
        clientSecretEncrypted: "sec",
        apiKeyEncrypted: null,
        instanceSubdomain: "acme",
        lastSyncAt: NOW_MINUS_1H,
        backfillRequestedAt: state.backfillRequestedAt,
        syncStatus: "idle",
        syncStartedAt: null,
        lastSyncStats: state.lastSyncStats,
        propertyGroupFilter: state.groupFilter,
      })),
    }),
    property,
    listing,
    lease,
    lead: autoModel({
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.leadCreates.push(data);
        return { id: `lead-${data.externalId}` };
      }),
    }),
    adCampaign: autoModel(),
    resident: autoModel(),
    workOrder: autoModel(),
    application: autoModel(),
    tour: autoModel(),
    auditEvent: autoModel(),
    leadMatchDecision: autoModel(),
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prismaMock)),
  });
}

function baseProps(): Prop[] {
  return [
    {
      id: "A",
      orgId: "org-1",
      name: "Alpha House",
      slug: "alpha-house",
      addressLine1: "1 Alpha Way",
      backendPlatform: "APPFOLIO",
      backendPropertyId: "af-A",
      backendPropertyGroup: null,
      lifecycle: "ACTIVE",
      lifecycleSetBy: "OPERATOR",
    },
    {
      id: "B",
      orgId: "org-1",
      name: "Oak Commons",
      slug: "oak-commons",
      addressLine1: "200 Oak St",
      backendPlatform: "NONE",
      backendPropertyId: null,
      backendPropertyGroup: null,
      lifecycle: "ACTIVE",
      lifecycleSetBy: "OPERATOR",
    },
  ];
}

beforeEach(() => {
  state.props = baseProps();
  state.fetchCalls = [];
  state.leaseCreates = [];
  state.leadCreates = [];
  state.groupFilter = null;
  state.failReports = new Set();
  state.backfillRequestedAt = null;
  state.lastSyncStats = null;
  state.integrationUpdates = [];
  state.listingCreates = [];
  state.reports = {
    property_directory: [
      { property_id: "af-A", name: "Alpha House", address_line_1: "1 Alpha Way" },
      { property_id: "af-B-park", name: "Oak Commons Parking", address_line_1: "200 Oak St" },
      { property_id: "af-B", name: "Oak Commons", address_line_1: "200 Oak St" },
    ],
    unit_directory: [{ unit_id: "u-B1", property_id: "af-B", unit_name: "101" }],
    rent_roll: [
      { lease_id: "l-B1", unit_id: "u-B1", property_id: "af-B", status: "Current" },
    ],
  };
  setupPrisma();
});

describe("runAppfolioSync — two ACTIVE properties", () => {
  it("a same-address parking sub-record never adopts the operator's ACTIVE building", async () => {
    await runAppfolioSync("org-1");
    const b = state.props.find((p) => p.id === "B")!;
    expect(b.backendPropertyId).toBe("af-B");
    const parking = state.props.find((p) => p.backendPropertyId === "af-B-park")!;
    expect(parking.id).not.toBe("B");
    expect(parking.lifecycle).toBe("EXCLUDED");
  });

  it("widens the guest_cards window when an ACTIVE building is adopted mid-sync", async () => {
    await runAppfolioSync("org-1");
    const guestCards = state.fetchCalls.find((c) => c.report === "guest_cards");
    expect(guestCards?.fromDate).toBeDefined();
    const days = (Date.now() - guestCards!.fromDate!.getTime()) / 86_400_000;
    // Wide window (DEFAULT_BACKFILL_DAYS), not "since lastSyncAt" (1h ago).
    expect(days).toBeGreaterThan(7);
  });

  it("keeps the incremental window when nothing was adopted", async () => {
    state.props = baseProps().map((p) =>
      p.id === "B" ? { ...p, backendPlatform: "APPFOLIO", backendPropertyId: "af-B" } : p,
    );
    await runAppfolioSync("org-1");
    const guestCards = state.fetchCalls.find((c) => c.report === "guest_cards");
    expect(guestCards?.fromDate?.getTime()).toBe(NOW_MINUS_1H.getTime());
  });

  it("links a lease to its unit when the building was adopted in the same run", async () => {
    // No parking row: isolates the unit-map bug from the adoption bug.
    state.reports.property_directory = state.reports.property_directory.filter(
      (r) => r.property_id !== "af-B-park",
    );
    await runAppfolioSync("org-1");
    expect(state.listingCreates.map((l) => l.propertyId)).toEqual(["B"]);
    const lease = state.leaseCreates.find((l) => l.externalId === "l-B1");
    expect(lease?.propertyId).toBe("B");
    expect(lease?.listingId).toBe("listing-u-B1");
  });

  it("skips guest cards for a building outside the property-group filter instead of filing them org-level", async () => {
    state.groupFilter = "Mine";
    state.reports.property_directory = [
      { property_id: "af-A", name: "Alpha House", address_line_1: "1 Alpha Way", property_group: "Mine" },
      { property_id: "af-B", name: "Oak Commons", address_line_1: "200 Oak St", property_group: "Mine" },
      { property_id: "af-Z", name: "Zed Tower", address_line_1: "9 Zed Rd", property_group: "Other" },
    ];
    state.reports.guest_cards = [
      { guest_card_id: "gc-z", name: "Zed, Zoe", email_address: "zoe@x.com", property_id: "af-Z" },
      { guest_card_id: "gc-a", name: "Ant, Ann", email_address: "ann@x.com", property_id: "af-A" },
      { guest_card_id: "gc-none", name: "None, Ned", email_address: "ned@x.com" },
    ];
    const result = await runAppfolioSync("org-1");
    const created = state.leadCreates.map((l) => [l.externalId, l.propertyId]);
    expect(created).toEqual([
      ["gc-a", "A"],
      // No property on the card at all: still an org-level lead (unchanged).
      ["gc-none", null],
    ]);
    expect(result.stats.warnings.some((w) => w.includes("outside the property group"))).toBe(true);
  });

  it("a work_order failure in the backfill run is remembered, so the next run re-pulls the wide window", async () => {
    state.props = baseProps().map((p) =>
      p.id === "B" ? { ...p, backendPlatform: "APPFOLIO", backendPropertyId: "af-B" } : p,
    );
    // Run 1: B was just activated (backfill armed) but work_order fails.
    state.backfillRequestedAt = new Date(Date.now() - 5 * 60 * 1000);
    state.failReports = new Set(["work_order"]);
    await runAppfolioSync("org-1");
    const final = state.integrationUpdates.find((u) => "lastSyncStats" in u)!;
    const stats = final.lastSyncStats as { phaseFailures: Record<string, { consecutiveFailures: number }> };
    expect(stats.phaseFailures.work_orders?.consecutiveFailures).toBe(1);

    // Run 2: backfill request already cleared, watermark advanced to ~now.
    state.backfillRequestedAt = null;
    state.failReports = new Set();
    state.lastSyncStats = stats;
    state.fetchCalls = [];
    state.integrationUpdates = [];
    await runAppfolioSync("org-1");
    const wo = state.fetchCalls.find((c) => c.report === "work_order");
    const days = (Date.now() - wo!.fromDate!.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(30);
    const after = state.integrationUpdates.find((u) => "lastSyncStats" in u)!;
    expect(
      (after.lastSyncStats as { phaseFailures: Record<string, unknown> }).phaseFailures.work_orders,
    ).toBeUndefined();
  });
});
