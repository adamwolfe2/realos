import { beforeEach, describe, expect, it, vi } from "vitest";

// F-091: the public /audit/[token] page meta-refreshes every 5s while the
// audit is pending. Only READY renders may bump viewCount, otherwise one
// waiting prospect logs a dozen views per minute and the @updatedAt bump
// keeps resetting the self-heal stall clock.

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(async () => ({})),
  heal: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db", () => ({
  prisma: { prospectAudit: { findUnique: h.findUnique, update: h.update } },
}));
vi.mock("@/lib/audit/self-heal", () => ({ healStalledProspectAudit: h.heal }));
vi.mock("@/lib/audit/token", () => ({ isValidShareToken: () => true }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));

import AuditViewerPage from "@/app/(platform)/audit/[token]/page";

function row(status: string) {
  const now = new Date();
  return {
    id: "a1",
    shareToken: "tok",
    domain: "example.com",
    brandName: null,
    status,
    overallScore: 50,
    sectionScores: null,
    claudeSummary: null,
    findings: null,
    email: null,
    emailCapturedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("audit viewer view counter", () => {
  it("does not count pending (meta-refresh) renders", async () => {
    for (const status of ["QUEUED", "RUNNING", "FAILED"]) {
      h.findUnique.mockResolvedValueOnce(row(status));
      await AuditViewerPage({ params: Promise.resolve({ token: "tok" }) });
    }
    expect(h.update).not.toHaveBeenCalled();
  });

  it("counts a READY view", async () => {
    h.findUnique.mockResolvedValueOnce(row("READY"));
    await AuditViewerPage({ params: Promise.resolve({ token: "tok" }) });
    expect(h.update).toHaveBeenCalledTimes(1);
    expect(h.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { viewCount: { increment: 1 }, lastViewedAt: expect.any(Date) },
    });
  });
});
