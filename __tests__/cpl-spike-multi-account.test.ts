import { beforeEach, describe, expect, it, vi } from "vitest";

// An org with one Google Ads account per building (Southgate, Lair). Leads
// only know their platform, so CPL has to be computed per platform across
// both accounts. Per-account math divided each account's spend by every
// Google lead and keyed both results on the same dedupeKey.

const h = vi.hoisted(() => ({
  db: {
    adAccount: { findMany: vi.fn() },
    adMetricDaily: { aggregate: vi.fn() },
    lead: { count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: h.db }));

const { cplSpikeDetector } = await import("@/lib/insights/detectors/cpl-spike");

// Spend in cents per account: [this week, prior week].
const SPEND: Record<string, [number, number]> = {
  "acct-southgate": [100_000, 50_000],
  "acct-lair": [50_000, 100_000],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.db.adAccount.findMany.mockResolvedValue([
    { id: "acct-southgate", platform: "GOOGLE_ADS" },
    { id: "acct-lair", platform: "GOOGLE_ADS" },
  ]);
  h.db.adMetricDaily.aggregate.mockImplementation(
    async (args: { where: { adAccountId: string | { in: string[] }; date: { lt?: Date } } }) => {
      const ids = typeof args.where.adAccountId === "string" ? [args.where.adAccountId] : args.where.adAccountId.in;
      const prior = args.where.date.lt !== undefined;
      const spendCents = ids.reduce((t, id) => t + (SPEND[id]?.[prior ? 1 : 0] ?? 0), 0);
      return { _sum: { spendCents } };
    },
  );
  // 10 Google leads each week across both buildings.
  h.db.lead.count.mockResolvedValue(10);
});

describe("cpl-spike with two ad accounts on one platform", () => {
  it("does not report a spike when the platform's CPL is flat", async () => {
    // Platform total is $1,500 / 10 leads in both weeks. Per-account math
    // read Southgate as $100 -> $50 per lead, a false +100% critical spike.
    const out = await cplSpikeDetector.run("org-1", ["p-southgate", "p-lair"]);
    expect(out).toEqual([]);
  });

  it("emits at most one insight per platform when CPL does spike", async () => {
    h.db.lead.count.mockImplementation(async (args: { where: { createdAt: { lt?: Date } } }) =>
      args.where.createdAt.lt ? 20 : 10,
    );
    const out = await cplSpikeDetector.run("org-1", ["p-southgate", "p-lair"]);
    expect(out).toHaveLength(1);
    expect(out[0].dedupeKey).toMatch(/^cpl_spike:GOOGLE_ADS:week:/);
    expect(out[0].context).toMatchObject({ currentSpendUsd: 1500, previousSpendUsd: 1500, deltaPct: 100 });
  });
});
