import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma BEFORE importing score-snapshot — score-snapshot reads from it.
vi.mock("@/lib/db", () => {
  const make = () => ({
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  });
  return {
    prisma: {
      onPageInstantAudit: make(),
      onPageAudit: make(),
      seoTargetQuery: make(),
      serpRanking: make(),
      backlinkSummary: make(),
      aeoCitationCheck: make(),
      seoQuery: make(),
      seoScoreHistory: make(),
    },
  };
});

import { computeScoreSnapshot } from "@/lib/seo/score-snapshot";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Unit tests for computeScoreSnapshot — verifies the composite formula
// (0.35 technical + 0.35 content + 0.30 authority) and each sub-score
// fallback chain. Heavy use of Prisma mocks because the function reads
// from 6 tables to produce one snapshot.
// ---------------------------------------------------------------------------

type AnyMock = ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("computeScoreSnapshot — weekOf anchor", () => {
  it("anchors weekOf to Monday 00:00 UTC", async () => {
    // Saturday 2026-05-23 19:00 UTC → previous Monday 2026-05-18 00:00 UTC.
    const sat = new Date("2026-05-23T19:00:00Z");
    setAllEmpty();
    const snap = await computeScoreSnapshot({
      orgId: "o1",
      propertyId: "p1",
      weekOf: sat,
    });
    expect(snap.weekOf.toISOString()).toBe("2026-05-18T00:00:00.000Z");
  });

  it("anchors to itself when input is already Monday 00:00 UTC", async () => {
    const mon = new Date("2026-05-18T00:00:00Z");
    setAllEmpty();
    const snap = await computeScoreSnapshot({
      orgId: "o1",
      propertyId: "p1",
      weekOf: mon,
    });
    expect(snap.weekOf.toISOString()).toBe("2026-05-18T00:00:00.000Z");
  });
});

describe("computeScoreSnapshot — composite formula", () => {
  it("returns all zeros when no data is available (except defaults)", async () => {
    setAllEmpty();
    const snap = await computeScoreSnapshot({ orgId: "o", propertyId: "p" });
    // Technical fallback is 50 when neither audit table has data.
    expect(snap.technicalScore).toBe(50);
    // Content with no active queries → 0.
    expect(snap.contentScore).toBe(0);
    // Authority with no backlinks → 0.
    expect(snap.authorityScore).toBe(0);
    expect(snap.compositeScore).toBe(
      Math.round(0.35 * 50 + 0.35 * 0 + 0.3 * 0),
    );
  });

  it("computes 100 across the board when everything is healthy", async () => {
    (prisma.onPageInstantAudit.findFirst as AnyMock).mockResolvedValue({
      issuesCritical: 0,
      issuesWarning: 0,
      issuesNotice: 0,
    });
    (prisma.seoTargetQuery.count as AnyMock).mockResolvedValue(5);
    (prisma.serpRanking.findMany as AnyMock).mockResolvedValue(
      Array(5).fill({ query: "q" }).map((_, i) => ({ query: `q${i}` })),
    );
    (prisma.backlinkSummary.findFirst as AnyMock).mockResolvedValue({
      domainRank: 1000,
    });
    (prisma.aeoCitationCheck.count as AnyMock).mockResolvedValue(10);
    (prisma.seoQuery.aggregate as AnyMock).mockResolvedValue({
      _sum: { clicks: 1000 },
    });

    const snap = await computeScoreSnapshot({ orgId: "o", propertyId: "p" });
    expect(snap.technicalScore).toBe(100);
    expect(snap.contentScore).toBe(100);
    expect(snap.authorityScore).toBe(100);
    expect(snap.compositeScore).toBe(100);
  });

  it("clamps technical penalties so the score never goes negative", async () => {
    (prisma.onPageInstantAudit.findFirst as AnyMock).mockResolvedValue({
      issuesCritical: 50, // 50 * 5 = 250 penalty
      issuesWarning: 20,
      issuesNotice: 5,
    });
    (prisma.seoTargetQuery.count as AnyMock).mockResolvedValue(0);
    (prisma.backlinkSummary.findFirst as AnyMock).mockResolvedValue(null);
    (prisma.aeoCitationCheck.count as AnyMock).mockResolvedValue(0);
    (prisma.seoQuery.aggregate as AnyMock).mockResolvedValue({
      _sum: { clicks: 0 },
    });

    const snap = await computeScoreSnapshot({ orgId: "o", propertyId: "p" });
    expect(snap.technicalScore).toBe(0);
  });

  it("uses Lighthouse SEO score when no instant audit exists", async () => {
    (prisma.onPageInstantAudit.findFirst as AnyMock).mockResolvedValue(null);
    (prisma.onPageAudit.findFirst as AnyMock).mockResolvedValue({ seo: 0.82 });
    (prisma.seoTargetQuery.count as AnyMock).mockResolvedValue(0);
    (prisma.backlinkSummary.findFirst as AnyMock).mockResolvedValue(null);
    (prisma.aeoCitationCheck.count as AnyMock).mockResolvedValue(0);
    (prisma.seoQuery.aggregate as AnyMock).mockResolvedValue({
      _sum: { clicks: null },
    });

    const snap = await computeScoreSnapshot({ orgId: "o", propertyId: "p" });
    // 0.82 * 100 = 82
    expect(snap.technicalScore).toBe(82);
  });

  it("clamps composite to [0, 100]", async () => {
    // Force everything > 100 — should still cap.
    (prisma.onPageInstantAudit.findFirst as AnyMock).mockResolvedValue({
      issuesCritical: 0,
      issuesWarning: 0,
      issuesNotice: 0,
    });
    (prisma.seoTargetQuery.count as AnyMock).mockResolvedValue(2);
    (prisma.serpRanking.findMany as AnyMock).mockResolvedValue(
      Array(10).fill({ query: "q" }).map((_, i) => ({ query: `q${i}` })),
    );
    (prisma.backlinkSummary.findFirst as AnyMock).mockResolvedValue({
      domainRank: 9999,
    });
    (prisma.aeoCitationCheck.count as AnyMock).mockResolvedValue(0);
    (prisma.seoQuery.aggregate as AnyMock).mockResolvedValue({
      _sum: { clicks: 0 },
    });

    const snap = await computeScoreSnapshot({ orgId: "o", propertyId: "p" });
    expect(snap.compositeScore).toBeLessThanOrEqual(100);
    expect(snap.compositeScore).toBeGreaterThanOrEqual(0);
    expect(snap.contentScore).toBeLessThanOrEqual(100);
    expect(snap.authorityScore).toBeLessThanOrEqual(100);
  });
});

describe("computeScoreSnapshot — content score formula", () => {
  it("returns (ranked top-10 / active) * 100", async () => {
    setAllEmpty();
    (prisma.seoTargetQuery.count as AnyMock).mockResolvedValue(10);
    (prisma.serpRanking.findMany as AnyMock).mockResolvedValue([
      { query: "q1" },
      { query: "q2" },
      { query: "q3" },
    ]);

    const snap = await computeScoreSnapshot({ orgId: "o", propertyId: "p" });
    expect(snap.contentScore).toBe(30);
  });
});

function setAllEmpty() {
  (prisma.onPageInstantAudit.findFirst as AnyMock).mockResolvedValue(null);
  (prisma.onPageAudit.findFirst as AnyMock).mockResolvedValue(null);
  (prisma.seoTargetQuery.count as AnyMock).mockResolvedValue(0);
  (prisma.serpRanking.findMany as AnyMock).mockResolvedValue([]);
  (prisma.backlinkSummary.findFirst as AnyMock).mockResolvedValue(null);
  (prisma.aeoCitationCheck.count as AnyMock).mockResolvedValue(0);
  (prisma.seoQuery.aggregate as AnyMock).mockResolvedValue({
    _sum: { clicks: null },
  });
}
