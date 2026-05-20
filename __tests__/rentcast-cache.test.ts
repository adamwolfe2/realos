import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// RentCast cache + budget — mocked DB tests.
//
// We mock the entire `@/lib/db` and `@/lib/rentcast/client` modules so the
// cache + budget layers can be exercised without an actual Neon connection
// or live RentCast hits. The fetcher mock is a spy so we can assert it
// was/wasn't called depending on cache state.
// ---------------------------------------------------------------------------

type SnapshotRow = {
  id: string;
  orgId: string;
  propertyId: string | null;
  endpoint: string;
  cacheKey: string;
  payload: unknown;
  fetchedAt: Date;
  expiresAt: Date;
  requestCost: number;
};

type UsageRow = {
  id: string;
  orgId: string;
  monthKey: string;
  requestsThisMonth: number;
  monthlyBudget: number;
  hardCapMultiplier: number;
  lastResetAt: Date;
  updatedAt: Date;
};

const snapshotStore = new Map<string, SnapshotRow>();
const usageStore = new Map<string, UsageRow>();

const mockPrisma = {
  rentCastSnapshot: {
    findUnique: vi.fn(async ({ where }: { where: { orgId_cacheKey: { orgId: string; cacheKey: string } } }) => {
      return snapshotStore.get(snapKey(where.orgId_cacheKey.orgId, where.orgId_cacheKey.cacheKey)) ?? null;
    }),
    upsert: vi.fn(async ({ where, create, update }: any) => {
      const k = snapKey(where.orgId_cacheKey.orgId, where.orgId_cacheKey.cacheKey);
      const existing = snapshotStore.get(k);
      if (existing) {
        const next: SnapshotRow = { ...existing, ...update };
        snapshotStore.set(k, next);
        return next;
      }
      const id = `snap_${snapshotStore.size + 1}`;
      const row: SnapshotRow = {
        id,
        orgId: create.orgId,
        propertyId: create.propertyId ?? null,
        endpoint: create.endpoint,
        cacheKey: create.cacheKey,
        payload: create.payload,
        fetchedAt: create.fetchedAt,
        expiresAt: create.expiresAt,
        requestCost: create.requestCost ?? 1,
      };
      snapshotStore.set(k, row);
      return row;
    }),
  },
  orgRentCastUsage: {
    upsert: vi.fn(async ({ where, create, update }: any) => {
      const k = where.orgId;
      const existing = usageStore.get(k);
      if (existing) {
        const next: UsageRow = {
          ...existing,
          ...(update.requestsThisMonth?.increment !== undefined
            ? { requestsThisMonth: existing.requestsThisMonth + update.requestsThisMonth.increment }
            : update.requestsThisMonth !== undefined
              ? { requestsThisMonth: update.requestsThisMonth }
              : {}),
          ...(update.monthKey !== undefined ? { monthKey: update.monthKey } : {}),
          ...(update.monthlyBudget !== undefined ? { monthlyBudget: update.monthlyBudget } : {}),
          ...(update.lastResetAt !== undefined ? { lastResetAt: update.lastResetAt } : {}),
          updatedAt: new Date(),
        };
        usageStore.set(k, next);
        return next;
      }
      const row: UsageRow = {
        id: `usage_${usageStore.size + 1}`,
        orgId: create.orgId,
        monthKey: create.monthKey,
        requestsThisMonth: create.requestsThisMonth ?? 0,
        monthlyBudget: create.monthlyBudget ?? 50,
        hardCapMultiplier: create.hardCapMultiplier ?? 1.5,
        lastResetAt: new Date(),
        updatedAt: new Date(),
      };
      usageStore.set(k, row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const existing = usageStore.get(where.orgId);
      if (!existing) throw new Error("not found");
      const next: UsageRow = {
        ...existing,
        ...(data.monthKey !== undefined ? { monthKey: data.monthKey } : {}),
        ...(data.requestsThisMonth !== undefined ? { requestsThisMonth: data.requestsThisMonth } : {}),
        ...(data.lastResetAt !== undefined ? { lastResetAt: data.lastResetAt } : {}),
        updatedAt: new Date(),
      };
      usageStore.set(where.orgId, next);
      return next;
    }),
  },
};

function snapKey(orgId: string, cacheKey: string) {
  return `${orgId}|${cacheKey}`;
}

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

// Mock the actual upstream fetcher — we never want to hit RentCast in
// these unit tests. The cache layer calls into client.getRentAvm /
// getMarketStats which we override here.
const mockGetRentAvm = vi.fn();
const mockGetMarketStats = vi.fn();
vi.mock("../lib/rentcast/client", async () => {
  const actual = await vi.importActual<typeof import("../lib/rentcast/client")>(
    "../lib/rentcast/client",
  );
  return {
    ...actual,
    getRentAvm: (...args: unknown[]) => mockGetRentAvm(...args),
    getMarketStats: (...args: unknown[]) => mockGetMarketStats(...args),
  };
});

// Import AFTER the mocks are wired so the cache picks up our fakes.
const cacheMod = await import("../lib/rentcast/cache");
const budgetMod = await import("../lib/rentcast/budget");

const ORG = "org-1";
const ADDRESS = "2410 Telegraph Ave, Berkeley, CA 94704";
const RENT_PAYLOAD = {
  rent: 3190,
  rentRangeLow: 2750,
  rentRangeHigh: 3640,
  comparables: [
    {
      formattedAddress: "2400 Telegraph Ave",
      bedrooms: 2,
      bathrooms: 1,
      squareFootage: 800,
      price: 3100,
      distance: 0.02,
      daysOld: 1,
      daysOnMarket: 1,
      latitude: 37.86,
      longitude: -122.26,
    },
  ],
};

describe("rentcast cache layer", () => {
  beforeEach(() => {
    snapshotStore.clear();
    usageStore.clear();
    mockGetRentAvm.mockReset();
    mockGetMarketStats.mockReset();
    mockGetRentAvm.mockResolvedValue(RENT_PAYLOAD);
  });

  it("fetches and persists on cache miss", async () => {
    const res = await cacheMod.getRentAvm({
      orgId: ORG,
      address: ADDRESS,
      bedrooms: 2,
      bathrooms: 1,
      propertyType: "Apartment",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("unreachable");
    expect(res.mode).toBe("fresh");
    expect(mockGetRentAvm).toHaveBeenCalledTimes(1);
    expect(snapshotStore.size).toBe(1);
    const usage = usageStore.get(ORG)!;
    expect(usage.requestsThisMonth).toBe(1);
  });

  it("returns the cached snapshot without firing the fetcher on a hit", async () => {
    // Warm cache
    await cacheMod.getRentAvm({
      orgId: ORG,
      address: ADDRESS,
      bedrooms: 2,
      bathrooms: 1,
      propertyType: "Apartment",
    });
    mockGetRentAvm.mockClear();

    const res = await cacheMod.getRentAvm({
      orgId: ORG,
      address: ADDRESS,
      bedrooms: 2,
      bathrooms: 1,
      propertyType: "Apartment",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("unreachable");
    expect(res.mode).toBe("cached");
    expect(mockGetRentAvm).toHaveBeenCalledTimes(0);
    const usage = usageStore.get(ORG)!;
    expect(usage.requestsThisMonth).toBe(1); // still 1 — no extra credit spent
  });

  it("re-fetches when the existing snapshot has expired", async () => {
    // Seed an expired snapshot directly.
    const expired: SnapshotRow = {
      id: "snap-expired",
      orgId: ORG,
      propertyId: null,
      endpoint: "RENT_LONG_TERM",
      cacheKey: "rent:2410-telegraph-ave-berkeley-ca-94704:2br:1ba:Apartment",
      payload: { rent: 1, rentRangeLow: 1, rentRangeHigh: 1, comparables: [] },
      fetchedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      requestCost: 1,
    };
    snapshotStore.set(snapKey(ORG, expired.cacheKey), expired);

    const res = await cacheMod.getRentAvm({
      orgId: ORG,
      address: ADDRESS,
      bedrooms: 2,
      bathrooms: 1,
      propertyType: "Apartment",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("unreachable");
    expect(res.mode).toBe("fresh");
    expect(mockGetRentAvm).toHaveBeenCalledTimes(1);
    const persisted = snapshotStore.get(snapKey(ORG, expired.cacheKey))!;
    expect((persisted.payload as { rent: number }).rent).toBe(3190);
  });

  it("blocks new fetches when the org is over the hard cap and falls back to stale", async () => {
    // Cache an old snapshot.
    const seed: SnapshotRow = {
      id: "snap-1",
      orgId: ORG,
      propertyId: null,
      endpoint: "RENT_LONG_TERM",
      cacheKey: "rent:2410-telegraph-ave-berkeley-ca-94704:2br:1ba:Apartment",
      payload: { rent: 1234, rentRangeLow: 1000, rentRangeHigh: 1500, comparables: [] },
      fetchedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      requestCost: 1,
    };
    snapshotStore.set(snapKey(ORG, seed.cacheKey), seed);

    // Push org over hard cap (50 * 1.5 = 75).
    usageStore.set(ORG, {
      id: "u-1",
      orgId: ORG,
      monthKey: budgetMod.currentMonthKey(),
      requestsThisMonth: 80,
      monthlyBudget: 50,
      hardCapMultiplier: 1.5,
      lastResetAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await cacheMod.getRentAvm({
      orgId: ORG,
      address: ADDRESS,
      bedrooms: 2,
      bathrooms: 1,
      propertyType: "Apartment",
    });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.reason).toBe("OVER_HARD_CAP");
    expect(res.stale).toBeDefined();
    expect((res.stale!.data as { rent: number }).rent).toBe(1234);
    expect(mockGetRentAvm).toHaveBeenCalledTimes(0);
  });

  it("collapses address variants to the same cache key (force re-fetch via second variant is a hit)", async () => {
    await cacheMod.getRentAvm({
      orgId: ORG,
      address: "2410 Telegraph Ave",
      bedrooms: 2,
      bathrooms: 1,
      propertyType: "Apartment",
    });
    mockGetRentAvm.mockClear();

    const res = await cacheMod.getRentAvm({
      orgId: ORG,
      address: "  2410 telegraph ave,  ",
      bedrooms: 2,
      bathrooms: 1,
      propertyType: "Apartment",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("unreachable");
    expect(res.mode).toBe("cached");
    expect(mockGetRentAvm).toHaveBeenCalledTimes(0);
  });
});

describe("rentcast budget rollover", () => {
  beforeEach(() => {
    usageStore.clear();
  });

  it("rolls the usage counter when monthKey changes", async () => {
    // Seed a usage row under a stale monthKey.
    usageStore.set(ORG, {
      id: "u-1",
      orgId: ORG,
      monthKey: "1999-01",
      requestsThisMonth: 42,
      monthlyBudget: 50,
      hardCapMultiplier: 1.5,
      lastResetAt: new Date("1999-01-01"),
      updatedAt: new Date("1999-01-01"),
    });

    const state = await budgetMod.canSpendCredit(ORG);
    expect(state.allowed).toBe(true);
    expect(state.used).toBe(0);
    expect(state.monthKey).toBe(budgetMod.currentMonthKey());
  });
});
