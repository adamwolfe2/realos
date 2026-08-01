import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression test for PORTAL-REPORTS-D001: the monthly-report cron used to
// write status: "sent" immediately when an org had auto-send configured,
// without checking whether sendReportEmail() actually succeeded. "sent" is
// not a real status anywhere else in the app — /r/[token] 404s (it only
// renders status === "shared") and the operator's portal page never gets a
// share link (also gated on "shared"). This mirrors weekly-report's
// draft-first-then-flip-on-success sequencing.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  sendReportEmail: vi.fn(),
  db: {
    organization: { findMany: vi.fn() },
    clientReport: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/cron/auth", () => ({ verifyCronAuth: () => null }));
vi.mock("@/lib/health/cron-run", () => ({
  recordCronRun: async (
    _name: string,
    job: () => Promise<{ result: unknown }>,
  ) => (await job()).result,
}));
vi.mock("@/lib/reports/generate", () => ({
  generateReportSnapshot: async () => ({
    periodStart: "2026-06-01T00:00:00.000Z",
    periodEnd: "2026-06-30T00:00:00.000Z",
  }),
  // Real resolvePeriod is a pure function of `now`; the route only uses it
  // to batch-fetch the dedup lookup, so a fixed stub period is enough here.
  resolvePeriod: () => ({
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    periodEnd: new Date("2026-06-30T00:00:00.000Z"),
    priorStart: new Date("2026-05-01T00:00:00.000Z"),
    priorEnd: new Date("2026-06-01T00:00:00.000Z"),
  }),
}));
vi.mock("@/lib/reports/token", () => ({
  generateShareToken: () => "test-share-token",
}));
vi.mock("@/lib/email/send-report", () => ({
  sendReportEmail: h.sendReportEmail,
}));
vi.mock("@/lib/notifications/create", () => ({
  notifyReportDraftReady: async () => {},
}));

import { GET } from "@/app/api/cron/monthly-report/route";

const AUTO_SEND_ORG = {
  id: "org_1",
  name: "Telegraph Commons",
  logoUrl: null,
  primaryContactEmail: null,
  primaryContactName: null,
  reportCadence: "monthly",
  reportRecipients: ["ops@example.com"],
  reportAutoSend: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.db.organization.findMany.mockResolvedValue([AUTO_SEND_ORG]);
  h.db.clientReport.findMany.mockResolvedValue([]);
  h.db.clientReport.create.mockResolvedValue({
    id: "report_1",
    shareToken: "test-share-token",
  });
});

describe("monthly-report cron — status sequencing", () => {
  it("creates the report as draft first (never writes status: 'sent')", async () => {
    h.sendReportEmail.mockResolvedValue({ ok: true, messageId: "msg_1" });

    await GET(new Request("https://x/api/cron/monthly-report") as never);

    expect(h.db.clientReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "draft" }),
      }),
    );
  });

  it("flips status to 'shared' + sets sharedAt only when the send succeeds", async () => {
    h.sendReportEmail.mockResolvedValue({ ok: true, messageId: "msg_1" });

    await GET(new Request("https://x/api/cron/monthly-report") as never);

    expect(h.db.clientReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "report_1" },
        data: expect.objectContaining({
          status: "shared",
          sharedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("leaves the report as 'draft' (never 'shared') when the send fails", async () => {
    h.sendReportEmail.mockResolvedValue({
      ok: false,
      error: "resend rejected",
    });

    const res = await GET(
      new Request("https://x/api/cron/monthly-report") as never,
    );
    const json = await (res as Response).json();

    // Report row was created as draft and never flipped to shared/sent.
    expect(h.db.clientReport.update).not.toHaveBeenCalled();
    expect(h.db.clientReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "draft" }),
      }),
    );
    // Failure is surfaced on the run, not swallowed as a bare success.
    expect(json.errors).toEqual([
      expect.objectContaining({ orgId: "org_1", error: "resend rejected" }),
    ]);
  });
});
