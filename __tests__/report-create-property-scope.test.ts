import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

// ---------------------------------------------------------------------------
// P1 regression (2026-07-29 review): createReport validated the requested
// propertyId against the org only, NOT against scope.allowedPropertyIds.
// A property-restricted user could POST any in-org propertyId (hidden form
// field on /portal/reports) and generate a full Marketing & Performance
// snapshot of a building they're gated out of — and the shareToken makes
// that snapshot world-readable.
//
// The action must mirror /portal/properties/[id]/snapshot (per-property
// gate) and POST /api/portal/reports (org-wide gate for restricted users).
// ---------------------------------------------------------------------------

let mockPrisma: MockPrisma;
const mockRequireWritableWorkspace = vi.fn();
const mockGenerateSnapshot = vi.fn();
const mockCheckAiBillingGate = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockSendReportEmail = vi.fn();

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

vi.mock("@/lib/tenancy/scope", () => ({
  requireWritableWorkspace: () => mockRequireWritableWorkspace(),
  requireScope: () => mockRequireWritableWorkspace(),
}));

vi.mock("@/lib/billing/gate", () => ({
  checkAiBillingGate: (...args: unknown[]) => mockCheckAiBillingGate(...args),
  aiBillingDeniedResponseBody: () => ({ error: "billing gate denied" }),
}));

vi.mock("@/lib/rate-limit", () => ({
  aiCallLimiter: "ai-limiter",
  notifyLimiter: "notify-limiter",
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock("@/lib/reports/generate", () => ({
  generateReportSnapshot: (...args: unknown[]) => mockGenerateSnapshot(...args),
}));

vi.mock("@/lib/reports/token", () => ({
  generateShareToken: () => "tok_test",
}));

vi.mock("@/lib/email/send-report", () => ({
  sendReportEmail: (...args: unknown[]) => mockSendReportEmail(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { createReport, updateReport, archiveReport, sendReportToRecipients } =
  await import("@/lib/actions/reports");

function scope(allowedPropertyIds: string[] | null) {
  return {
    userId: "u1",
    clerkUserId: "clerk_u1",
    orgId: "org-1",
    actualOrgId: "org-1",
    role: "LEASING_AGENT",
    email: "agent@client.test",
    allowedPropertyIds,
  };
}

const SNAPSHOT = {
  periodStart: "2026-07-01T00:00:00.000Z",
  periodEnd: "2026-07-29T00:00:00.000Z",
};

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockRequireWritableWorkspace.mockReset();
  mockGenerateSnapshot.mockReset();
  mockGenerateSnapshot.mockResolvedValue(SNAPSHOT);
  mockPrisma.clientReport.create.mockResolvedValue({ id: "rep-1" });
  mockCheckAiBillingGate.mockReset();
  mockCheckAiBillingGate.mockResolvedValue({ allowed: true });
  mockCheckRateLimit.mockReset();
  mockCheckRateLimit.mockResolvedValue({ allowed: true, reset: 0 });
  mockSendReportEmail.mockReset();
  mockSendReportEmail.mockResolvedValue({ ok: true, messageId: "m1" });
});

describe("createReport — property RBAC gate", () => {
  it("restricted [A] + in-org but out-of-scope propertyId B → rejected, nothing generated", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(scope(["prop-A"]));
    // Property B exists in the org — the old code let this through.
    mockPrisma.property.findFirst.mockResolvedValue({ id: "prop-B" });

    await expect(
      createReport("monthly", { propertyId: "prop-B" }),
    ).rejects.toThrow("Property not found in this workspace");

    expect(mockGenerateSnapshot).not.toHaveBeenCalled();
    expect(mockPrisma.clientReport.create).not.toHaveBeenCalled();
  });

  it("uses the SAME error for out-of-scope as for off-org, so the response doesn't leak which check fired", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(scope(["prop-A"]));
    mockPrisma.property.findFirst.mockResolvedValue(null); // off-org / nonexistent

    let offOrgMessage = "";
    await createReport("monthly", { propertyId: "prop-other-org" }).catch(
      (e: Error) => (offOrgMessage = e.message),
    );

    mockPrisma.property.findFirst.mockResolvedValue({ id: "prop-B" }); // in-org, out of scope
    let outOfScopeMessage = "";
    await createReport("monthly", { propertyId: "prop-B" }).catch(
      (e: Error) => (outOfScopeMessage = e.message),
    );

    expect(offOrgMessage).toBe("Property not found in this workspace");
    expect(outOfScopeMessage).toBe(offOrgMessage);
    expect(mockGenerateSnapshot).not.toHaveBeenCalled();
    expect(mockPrisma.clientReport.create).not.toHaveBeenCalled();
  });

  it("restricted [A] + no propertyId (org-wide rollup) → rejected, mirrors POST /api/portal/reports", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(scope(["prop-A"]));

    await expect(createReport("monthly", {})).rejects.toThrow(
      /portfolio-wide access/,
    );
    expect(mockGenerateSnapshot).not.toHaveBeenCalled();
    expect(mockPrisma.clientReport.create).not.toHaveBeenCalled();
  });

  it("restricted [A] + in-scope propertyId A → succeeds", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(scope(["prop-A"]));
    mockPrisma.property.findFirst.mockResolvedValue({ id: "prop-A" });

    const res = await createReport("monthly", { propertyId: "prop-A" });

    expect(res).toEqual({ id: "rep-1" });
    expect(mockGenerateSnapshot).toHaveBeenCalledWith("org-1", "monthly", {
      propertyId: "prop-A",
    });
    expect(mockPrisma.clientReport.create.mock.calls[0][0].data.propertyId).toBe(
      "prop-A",
    );
  });

  it("unrestricted scope + any in-org propertyId → succeeds (no regression)", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(scope(null));
    mockPrisma.property.findFirst.mockResolvedValue({ id: "prop-B" });

    const res = await createReport("weekly", { propertyId: "prop-B" });
    expect(res).toEqual({ id: "rep-1" });
  });

  it("unrestricted scope + no propertyId → org-wide snapshot still allowed", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(scope(null));

    const res = await createReport("weekly", {});
    expect(res).toEqual({ id: "rep-1" });
    expect(mockGenerateSnapshot).toHaveBeenCalledWith("org-1", "weekly", {
      propertyId: null,
    });
  });
});

describe("createReport — AI spend controls (parity with POST /api/portal/reports)", () => {
  it("billing gate denied → throws before generating a snapshot", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(scope(null));
    mockCheckAiBillingGate.mockResolvedValue({ allowed: false, reason: "past_due" });

    await expect(createReport("monthly", {})).rejects.toThrow("billing gate denied");
    expect(mockGenerateSnapshot).not.toHaveBeenCalled();
  });

  it("AI rate limit exceeded → throws before generating a snapshot", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(scope(null));
    mockCheckRateLimit.mockResolvedValue({ allowed: false, reset: Date.now() });

    await expect(createReport("monthly", {})).rejects.toThrow(/rate limit/i);
    expect(mockGenerateSnapshot).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Sibling paths: the same gate must hold AFTER creation. A restricted user
// holding an org-wide report id must not be able to view, share, archive,
// or email it (sharing/emailing activates the world-readable /r/<token>).
// ---------------------------------------------------------------------------

const ORG_WIDE = { id: "rep-1", status: "draft", shareToken: "tok", sharedAt: null, propertyId: null };
const SCOPED_A = { id: "rep-2", status: "draft", shareToken: "tok", sharedAt: null, propertyId: "prop-A" };

describe("post-create actions — property RBAC gate", () => {
  it("updateReport: restricted user cannot share an org-wide report", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(scope(["prop-A"]));
    mockPrisma.clientReport.findFirst.mockResolvedValue(ORG_WIDE);

    await expect(
      updateReport("rep-1", { status: "shared" }),
    ).rejects.toThrow("Report not found");
    expect(mockPrisma.clientReport.update).not.toHaveBeenCalled();
  });

  it("updateReport: restricted user CAN update an in-scope property report", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(scope(["prop-A"]));
    mockPrisma.clientReport.findFirst.mockResolvedValue(SCOPED_A);
    mockPrisma.clientReport.update.mockResolvedValue({});

    await updateReport("rep-2", { headline: "H" });
    expect(mockPrisma.clientReport.update).toHaveBeenCalled();
  });

  it("archiveReport: restricted user cannot archive an org-wide report", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(scope(["prop-A"]));
    mockPrisma.clientReport.findFirst.mockResolvedValue({ propertyId: null });

    await expect(archiveReport("rep-1")).rejects.toThrow("Report not found");
    expect(mockPrisma.clientReport.updateMany).not.toHaveBeenCalled();
  });

  it("archiveReport: missing id stays a silent no-op (prior behavior)", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(scope(null));
    mockPrisma.clientReport.findFirst.mockResolvedValue(null);

    await archiveReport("nope");
    expect(mockPrisma.clientReport.updateMany).not.toHaveBeenCalled();
  });

  it("sendReportToRecipients: restricted user cannot email an org-wide report", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(scope(["prop-A"]));
    mockPrisma.clientReport.findFirst.mockResolvedValue({
      ...ORG_WIDE,
      kind: "monthly",
      snapshot: SNAPSHOT,
      headline: null,
      notes: null,
      org: { id: "org-1", name: "Org", logoUrl: null },
    });

    await expect(
      sendReportToRecipients("rep-1", { to: ["client@example.com"] }),
    ).rejects.toThrow("Report not found");
    expect(mockSendReportEmail).not.toHaveBeenCalled();
  });

  it("sendReportToRecipients: caps recipients at 10 and drops junk addresses", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(scope(null));
    mockPrisma.clientReport.findFirst.mockResolvedValue({
      ...ORG_WIDE,
      kind: "monthly",
      snapshot: SNAPSHOT,
      headline: null,
      notes: null,
      org: { id: "org-1", name: "Org", logoUrl: null },
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      firstName: "A", lastName: "W", email: "a@w.test",
    });
    mockPrisma.clientReport.update.mockResolvedValue({});

    const to = [
      "not-an-email",
      "@nope",
      ...Array.from({ length: 15 }, (_, i) => `r${i}@example.com`),
    ];
    await sendReportToRecipients("rep-1", { to });

    const sent = mockSendReportEmail.mock.calls[0][0].to;
    expect(sent).toHaveLength(10);
    expect(sent.every((r: string) => /@.*\./.test(r))).toBe(true);
  });
});
