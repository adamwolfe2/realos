import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

// F-015 manual "Add lead": tenant + grant gate, email dedupe, exactly one
// notify per created lead and none on a duplicate.

let mockPrisma: MockPrisma;
const mockRequireScope = vi.fn();
const mockFindByEmail = vi.fn();
const mockNotify = vi.fn();
const mockRateLimit = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

class ForbiddenErrorStub extends Error {}

vi.mock("@/lib/tenancy/scope", () => ({
  requireWritableWorkspace: () => mockRequireScope(),
  ForbiddenError: ForbiddenErrorStub,
  propertyInScope: (s: { allowedPropertyIds: string[] | null }, id: string | null) =>
    !id || !s.allowedPropertyIds || s.allowedPropertyIds.includes(id),
  auditPayload: (s: { orgId: string }, rest: Record<string, unknown>) => ({ orgId: s.orgId, ...rest }),
}));
vi.mock("@/lib/rate-limit", () => ({
  clientWriteLimiter: {},
  checkRateLimit: (...a: unknown[]) => mockRateLimit(...a),
}));
vi.mock("@/lib/leads/find-by-email", () => ({
  normalizeLeadEmail: (e: string) => e.trim().toLowerCase(),
  findOldestLeadByEmail: (...a: unknown[]) => mockFindByEmail(...a),
}));
vi.mock("@/lib/notifications/lead-notify", () => ({
  notifyLeadCaptured: (...a: unknown[]) => mockNotify(...a),
}));
vi.mock("@/lib/after", () => ({
  runAfter: async (_label: string, fn: () => Promise<void>) => fn(),
}));

const { createManualLead } = await import("@/lib/actions/manual-leads");

function scope(allowedPropertyIds: string[] | null = null) {
  return { userId: "u1", orgId: "org-1", role: "LEASING_AGENT", allowedPropertyIds };
}

const valid = {
  propertyId: "prop-a",
  firstName: "Dana",
  lastName: "Lee",
  email: "  Dana.Lee@Example.com ",
  phone: "",
  source: "MANUAL",
  sourceDetail: "Walked in Saturday",
  notes: "",
};

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockRequireScope.mockReset().mockResolvedValue(scope());
  mockFindByEmail.mockReset().mockResolvedValue(null);
  mockNotify.mockReset().mockResolvedValue(undefined);
  mockRateLimit.mockReset().mockResolvedValue({ allowed: true });
  mockPrisma.property.findFirst.mockResolvedValue({ id: "prop-a" });
  mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });
  mockPrisma.auditEvent.create.mockResolvedValue({});
});

describe("createManualLead", () => {
  it("creates an org-scoped MANUAL lead with a normalized email, audits it and notifies once", async () => {
    const res = await createManualLead(valid);

    expect(res).toEqual({ ok: true, id: "lead-1" });
    const data = mockPrisma.lead.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      orgId: "org-1",
      propertyId: "prop-a",
      email: "dana.lee@example.com",
      phone: null,
      source: "MANUAL",
      sourceDetail: "Walked in Saturday",
    });
    expect(data.status).toBeUndefined();
    expect(mockFindByEmail).toHaveBeenCalledWith("org-1", "dana.lee@example.com", expect.any(Object));
    expect(mockPrisma.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify.mock.calls[0][0]).toMatchObject({
      orgId: "org-1",
      leadId: "lead-1",
      propertyId: "prop-a",
      channel: "MANUAL",
    });
  });

  it("returns the role/trial error and writes nothing when the workspace is not writable", async () => {
    mockRequireScope.mockRejectedValue(new ForbiddenErrorStub("Your role is read-only in this workspace."));
    const res = await createManualLead(valid);
    expect(res).toEqual({ ok: false, error: "Your role is read-only in this workspace." });
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("rethrows unexpected auth failures instead of swallowing them", async () => {
    mockRequireScope.mockRejectedValue(new Error("db down"));
    await expect(createManualLead(valid)).rejects.toThrow("db down");
  });

  it("rate limits per user", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false });
    const res = await createManualLead(valid);
    expect(res.ok).toBe(false);
    expect(mockRateLimit.mock.calls[0][1]).toBe("manual-lead:u1");
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
  });

  it("rejects a property outside the user's grant without querying it", async () => {
    mockRequireScope.mockResolvedValue(scope(["prop-b"]));
    const res = await createManualLead(valid);
    expect(res).toEqual({ ok: false, error: "Property not found." });
    expect(mockPrisma.property.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
  });

  it("rejects a property from another org or not marketable", async () => {
    mockPrisma.property.findFirst.mockResolvedValue(null);
    const res = await createManualLead(valid);
    expect(res).toEqual({ ok: false, error: "Property not found." });
    expect(mockPrisma.property.findFirst.mock.calls[0][0].where).toMatchObject({ id: "prop-a", orgId: "org-1" });
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
  });

  it.each([
    ["no email or phone", { email: "", phone: "" }],
    ["an invalid email", { email: "not-an-email" }],
    ["a source operators may not set", { source: "CHATBOT" }],
    ["a missing property", { propertyId: "" }],
    ["a missing first name", { firstName: " " }],
  ])("rejects %s", async (_label, patch) => {
    const res = await createManualLead({ ...valid, ...patch });
    expect(res.ok).toBe(false);
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
  });

  it("accepts a phone-only walk-in without an email lookup", async () => {
    const res = await createManualLead({ ...valid, email: "", phone: "555-0100" });
    expect(res.ok).toBe(true);
    expect(mockFindByEmail).not.toHaveBeenCalled();
    expect(mockPrisma.lead.create.mock.calls[0][0].data).toMatchObject({ email: null, phone: "555-0100" });
  });

  it("blocks a duplicate email: no create, no audit, no notify, links the existing lead in scope", async () => {
    mockFindByEmail.mockResolvedValue({ id: "lead-old", propertyId: "prop-a" });
    const res = await createManualLead(valid);
    expect(res).toEqual({
      ok: false,
      duplicate: true,
      error: "A lead with this email already exists.",
      leadId: "lead-old",
    });
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    expect(mockPrisma.auditEvent.create).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("omits the existing lead's id when it belongs to a property outside the grant", async () => {
    mockRequireScope.mockResolvedValue(scope(["prop-a"]));
    mockFindByEmail.mockResolvedValue({ id: "lead-old", propertyId: "prop-z" });
    const res = await createManualLead(valid);
    expect(res).toEqual({ ok: false, duplicate: true, error: "A lead with this email already exists." });
  });

  it("omits an org-level (no property) existing lead's id for a restricted user", async () => {
    mockRequireScope.mockResolvedValue(scope(["prop-a"]));
    mockFindByEmail.mockResolvedValue({ id: "lead-old", propertyId: null });
    const res = await createManualLead(valid);
    expect(res).not.toHaveProperty("leadId");
  });

  it("still succeeds when the audit write fails, and logs it", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.auditEvent.create.mockRejectedValue(new Error("audit down"));
    const res = await createManualLead(valid);
    expect(res.ok).toBe(true);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("dedupes only through findOldestLeadByEmail, never an inline insensitive match", () => {
    const src = readFileSync("lib/actions/manual-leads.ts", "utf8");
    expect(src).not.toMatch(/mode:\s*["']insensitive["']/);
    expect(src.match(/notifyLeadCaptured\(/g)).toHaveLength(1);
  });
});
