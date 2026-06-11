import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Building Evaluator server action — mocked tests.
//
// We mock every cross-cutting concern (scope resolution, prisma, the
// RentCast cache layer, next/cache, rate limit) so we can drive the
// action's branching logic deterministically without standing up real
// auth, DB, or upstream HTTP.
// ---------------------------------------------------------------------------

// Capture the latest scope so tests can override per-case (e.g. simulate
// a different org).
const scopeRef = { current: { userId: "user-1", orgId: "org-1" } };

vi.mock("@/lib/tenancy/scope", () => {
  const scope = async () => ({
    userId: scopeRef.current.userId,
    orgId: scopeRef.current.orgId,
    clerkUserId: "clerk_1",
    actualOrgId: scopeRef.current.orgId,
  });
  return {
    requireScope: vi.fn(scope),
    // evaluateAddress now gates on requireWritableWorkspace (it spends on the
    // RentCast API + writes). Mock it to the same scope so the test exercises
    // the action logic, not the trial gate.
    requireWritableWorkspace: vi.fn(scope),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Default: allow. Each test can flip this.
const rateLimitState = { allowed: true };
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: rateLimitState.allowed,
    limit: 5,
    remaining: rateLimitState.allowed ? 4 : 0,
    reset: Date.now() + 60_000,
  })),
}));

// Stub @upstash/* so importing the action doesn't bring real network
// clients into the process. The action constructs these at module load.
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }
    constructor() {
      /* noop */
    }
  },
}));
vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor() {
      /* noop */
    }
  },
}));

// Cache layer mocks. Each test overrides .mockResolvedValueOnce per call.
const getValueAvm = vi.fn();
const getRentAvm = vi.fn();
const getMarketStats = vi.fn();
vi.mock("@/lib/rentcast/cache", () => ({
  getValueAvm: (...args: unknown[]) => getValueAvm(...args),
  getRentAvm: (...args: unknown[]) => getRentAvm(...args),
  getMarketStats: (...args: unknown[]) => getMarketStats(...args),
}));

// Prisma create stub — captures the row that would have been written so
// tests can assert the shape (address normalization, asking price
// cents, raw payload bag) without a DB.
const createdRows: Array<Record<string, unknown>> = [];
vi.mock("@/lib/db", () => ({
  prisma: {
    propertyEvaluation: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `eval_${createdRows.length + 1}`, ...data };
        createdRows.push(row);
        return { id: row.id };
      }),
      update: vi.fn(async () => ({})),
      findFirst: vi.fn(async () => null),
    },
  },
}));

// Import AFTER all mocks are wired.
const action = await import("../lib/actions/value-tool");

const FRESH_VALUE = {
  ok: true as const,
  mode: "fresh" as const,
  data: {
    price: 500_000,
    priceRangeLow: 470_000,
    priceRangeHigh: 530_000,
    latitude: 37.86,
    longitude: -122.26,
    comparables: [
      {
        formattedAddress: "2400 Telegraph Ave",
        bedrooms: 2,
        bathrooms: 1,
        squareFootage: 900,
        price: 510_000,
        distance: 0.05,
        daysOld: 12,
        daysOnMarket: 14,
        latitude: 37.86,
        longitude: -122.26,
      },
    ],
  },
  fetchedAt: new Date("2026-05-22T12:00:00Z"),
  expiresAt: new Date("2026-07-21T12:00:00Z"),
  snapshotId: "snap-v-1",
};

const FRESH_RENT = {
  ok: true as const,
  mode: "fresh" as const,
  data: {
    rent: 3190,
    rentRangeLow: 2750,
    rentRangeHigh: 3640,
    comparables: [
      {
        formattedAddress: "2400 Telegraph Ave",
        bedrooms: 2,
        bathrooms: 1,
        squareFootage: 900,
        price: 3100,
        distance: 0.05,
        daysOld: 1,
        daysOnMarket: 1,
        latitude: 37.86,
        longitude: -122.26,
      },
    ],
  },
  fetchedAt: new Date("2026-05-22T12:00:00Z"),
  expiresAt: new Date("2026-06-21T12:00:00Z"),
  snapshotId: "snap-r-1",
};

const FRESH_MARKET = {
  ok: true as const,
  mode: "fresh" as const,
  data: {
    rentalData: {
      medianRent: 3050,
      averageRent: 3100,
      medianDaysOnMarket: 7,
      totalListings: 32,
      lastUpdatedDate: "2026-05-15",
    },
  },
  fetchedAt: new Date("2026-05-22T12:00:00Z"),
  expiresAt: new Date("2026-06-05T12:00:00Z"),
  snapshotId: "snap-m-1",
};

describe("evaluateAddress — happy path", () => {
  beforeEach(() => {
    scopeRef.current = { userId: "user-1", orgId: "org-1" };
    rateLimitState.allowed = true;
    createdRows.length = 0;
    getValueAvm.mockReset();
    getRentAvm.mockReset();
    getMarketStats.mockReset();
    getValueAvm.mockResolvedValue(FRESH_VALUE);
    getRentAvm.mockResolvedValue(FRESH_RENT);
    getMarketStats.mockResolvedValue(FRESH_MARKET);
  });

  it("merges value + rent + market into a single shape and runs cap-rate math", async () => {
    const res = await action.evaluateAddress({
      address: "2410 Telegraph Ave, Berkeley, CA 94704",
      bedrooms: 2,
      bathrooms: 1,
      squareFootage: 900,
      askingPrice: 475_000,
      propertyType: "Apartment",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("unreachable");

    expect(res.data.value?.price).toBe(500_000);
    expect(res.data.rent?.rent).toBe(3190);
    expect(res.data.market?.rentalData.medianDaysOnMarket).toBe(7);

    // Cap rate: 3190*12 / 475_000 ≈ 0.0806
    expect(res.data.calculations.capRate).toBeCloseTo(0.0806, 3);
    expect(res.data.calculations.priceToRent).toBeCloseTo(12.4, 0);
    // Three down tiers persisted
    expect(res.data.calculations.downPayments.map((d) => d.downPct)).toEqual([0.2, 0.25, 0.3]);

    // Persisted row carries the asking price in cents + normalized address.
    expect(createdRows).toHaveLength(1);
    expect(createdRows[0].askingPriceCents).toBe(47_500_000);
    expect(createdRows[0].address).toBe("2410-telegraph-ave-berkeley-ca-94704");
    expect(createdRows[0].orgId).toBe("org-1");
  });

  it("falls back to AVM mid-point when no asking price is supplied", async () => {
    const res = await action.evaluateAddress({
      address: "2410 Telegraph Ave, Berkeley, CA 94704",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("unreachable");
    // Cap rate uses AVM mid (500k) as listPrice: 3190*12 / 500_000 = 0.07656
    expect(res.data.calculations.capRate).toBeCloseTo(0.07656, 3);
    expect(res.data.askingPriceCents).toBeNull();
  });
});

describe("evaluateAddress — failure modes", () => {
  beforeEach(() => {
    scopeRef.current = { userId: "user-1", orgId: "org-1" };
    rateLimitState.allowed = true;
    createdRows.length = 0;
    getValueAvm.mockReset();
    getRentAvm.mockReset();
    getMarketStats.mockReset();
  });

  it("returns RATE_LIMIT when the per-org limiter rejects", async () => {
    rateLimitState.allowed = false;
    getValueAvm.mockResolvedValue(FRESH_VALUE);
    getRentAvm.mockResolvedValue(FRESH_RENT);
    getMarketStats.mockResolvedValue(FRESH_MARKET);

    const res = await action.evaluateAddress({
      address: "2410 Telegraph Ave, Berkeley, CA 94704",
    });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.code).toBe("RATE_LIMIT");
    // The cache layer must NOT have been called at all.
    expect(getValueAvm).not.toHaveBeenCalled();
    expect(createdRows).toHaveLength(0);
  });

  it("returns OVER_HARD_CAP when both value + rent come back over budget", async () => {
    const overCap = {
      ok: false as const,
      reason: "OVER_HARD_CAP" as const,
      message: "Over budget",
    };
    getValueAvm.mockResolvedValue(overCap);
    getRentAvm.mockResolvedValue(overCap);
    getMarketStats.mockResolvedValue(overCap);

    const res = await action.evaluateAddress({
      address: "2410 Telegraph Ave, Berkeley, CA 94704",
    });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.code).toBe("OVER_HARD_CAP");
    expect(createdRows).toHaveLength(0);
  });

  it("returns VALIDATION on a sub-minimum address", async () => {
    const res = await action.evaluateAddress({ address: "  " });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.code).toBe("VALIDATION");
  });

  it("returns NO_DATA when both value + rent fail with no stale fallback", async () => {
    getValueAvm.mockResolvedValue({ ok: false, reason: "NO_DATA", message: "no comps" });
    getRentAvm.mockResolvedValue({ ok: false, reason: "NO_DATA", message: "no comps" });
    getMarketStats.mockResolvedValue(FRESH_MARKET);

    const res = await action.evaluateAddress({
      address: "1234 Nowhere Rd, Middle of Nowhere, MT 59000",
    });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("unreachable");
    expect(res.code).toBe("NO_DATA");
  });
});

describe("evaluateAddress — address normalization", () => {
  beforeEach(() => {
    scopeRef.current = { userId: "user-1", orgId: "org-1" };
    rateLimitState.allowed = true;
    createdRows.length = 0;
    getValueAvm.mockReset();
    getRentAvm.mockReset();
    getMarketStats.mockReset();
    getValueAvm.mockResolvedValue(FRESH_VALUE);
    getRentAvm.mockResolvedValue(FRESH_RENT);
    getMarketStats.mockResolvedValue(FRESH_MARKET);
  });

  it("normalizes casing + whitespace + punctuation into the persisted address", async () => {
    const variants = [
      "2410 Telegraph Ave, Berkeley, CA 94704",
      "  2410 TELEGRAPH AVE, BERKELEY, CA 94704  ",
      "2410 telegraph ave., berkeley, ca 94704",
    ];
    for (const v of variants) {
      const res = await action.evaluateAddress({ address: v });
      expect(res.ok).toBe(true);
    }
    // Every persisted row hashes to the same normalized form.
    const normalized = createdRows.map((r) => r.address);
    expect(new Set(normalized).size).toBe(1);
    expect(normalized[0]).toBe("2410-telegraph-ave-berkeley-ca-94704");
  });

  it("degrades gracefully when no ZIP can be extracted from the address", async () => {
    // No ZIP means the market call is skipped entirely; value + rent
    // still come back so the report renders.
    const res = await action.evaluateAddress({ address: "Main Street, Some Town" });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("unreachable");
    expect(res.data.market).toBeNull();
    expect(res.data.value?.price).toBe(500_000);
    expect(getMarketStats).not.toHaveBeenCalled();
  });
});
