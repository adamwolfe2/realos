import { describe, it, expect, vi } from "vitest";

// F-114: aging-lead buckets are computed by DB counts, not by fetching every
// open lead. The fake count evaluates the createdAt filter against a fixture
// and must match the old JS floor(days) bucketing, including boundaries.

const DAY = 86_400_000;
const NOW = new Date("2026-10-03T12:00:00Z").getTime();
const ages = [0, 6.99, 7, 7.01, 14.99, 15, 15.01, 40, -1];
const fixture = ages.map((d) => new Date(NOW - d * DAY));

const count = vi.fn(async ({ where }: { where: { createdAt: { gt?: Date; lte?: Date } } }) => {
  const { gt, lte } = where.createdAt;
  return fixture.filter(
    (c) => (!gt || c > gt) && (!lte || c <= lte),
  ).length;
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: { lead: { count } } }));

const { getAgingLeadsSummary } = await import("@/lib/briefing/queries");

function oldBucket() {
  let fresh = 0, aging = 0, stale = 0;
  for (const c of fixture) {
    const days = Math.floor((NOW - c.getTime()) / DAY);
    if (days < 7) fresh++;
    else if (days < 15) aging++;
    else stale++;
  }
  return { fresh, aging, stale };
}

describe("getAgingLeadsSummary", () => {
  it("matches the old JS bucketing and scopes by org", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const out = await getAgingLeadsSummary("org1");
    vi.useRealTimers();
    expect(out).toEqual(oldBucket());
    expect(count.mock.calls[0][0]).toMatchObject({ where: { orgId: "org1" } });
  });
});
