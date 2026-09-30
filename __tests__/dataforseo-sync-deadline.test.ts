import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Regression (2026-09-29): every dataforseo-sync run in the week before was
// killed at maxDuration (300s) and left a CronRun stuck at "running". Each
// property is ~100s of sequential DataForSEO calls, and 4 of the 5 LIVE
// properties were demo fixtures on .example domains (paid, always failing).
// ---------------------------------------------------------------------------

const findMany = vi.hoisted(() => vi.fn());
const sync = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: { property: { findMany } } }));
vi.mock("@/lib/cron/auth", () => ({ verifyCronAuth: () => null }));
vi.mock("@/lib/health/cron-run", () => ({
  recordCronRun: async (_n: string, fn: () => Promise<{ result: unknown }>) =>
    (await fn()).result,
}));
vi.mock("@/lib/seo/dataforseo", () => ({ isDataforSeoConfigured: () => true }));
vi.mock("@/lib/seo/sync-orchestrator", () => ({
  syncPropertyFromDataforSeo: sync,
}));

const { GET } = await import("@/app/api/cron/dataforseo-sync/route");
const { notDemoOrg } = await import("@/lib/tenancy/demo-org");

const STATS = {
  serpQueriesScanned: 1,
  lighthouseAudits: 0,
  backlinkSummaries: 0,
  competitorRows: 0,
  costEstimateUsd: 0,
  errors: [],
};

beforeEach(() => {
  vi.useFakeTimers();
  findMany.mockReset();
  sync.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("GET /api/cron/dataforseo-sync", () => {
  it("excludes demo orgs from candidates", async () => {
    findMany.mockResolvedValue([]);
    await GET(new NextRequest("http://localhost/api/cron/dataforseo-sync"));
    expect(findMany.mock.calls[0][0].where.org).toEqual(notDemoOrg);
  });

  it("stops starting new properties before maxDuration", async () => {
    findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, orgId: "o", name: "n", websiteUrl: null })),
    );
    sync.mockImplementation(async () => {
      vi.advanceTimersByTime(100_000); // one property ≈ 100s
      return STATS;
    });

    const res = await GET(new NextRequest("http://localhost/api/cron/dataforseo-sync"));
    const body = await (res as Response).json();

    // p0 (0-100s), p1 (100-200s), then past the 180s deadline → stop.
    expect(sync).toHaveBeenCalledTimes(2);
    expect(body.propertiesScanned).toBe(2);
  });
});
