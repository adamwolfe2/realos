import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Manual lead↔resident link (2026-08-02 proof chain). Tier-1 surface:
// customer-visible SIGNED state transition driven by an operator action.
// Invariants under test:
//   - lead and resident must BOTH be in the caller's org + property scope
//   - a resident already linked to a DIFFERENT lead is never silently stolen
//   - promotion is monotonic: below-SIGNED → SIGNED; LOST stays LOST
//   - convertedAt anchors to the lease start (fallback moveInDate, then now)
//   - unlink only detaches THIS lead's resident and never touches status
//   - every mutation writes an audit event
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  db: {
    lead: {
      findFirst: vi.fn(),
      updateMany: vi.fn(
        async (_args: {
          where: { id: string; status: { in: string[] } };
          data: Record<string, unknown>;
        }) => ({ count: 1 }),
      ),
    },
    resident: {
      findFirst: vi.fn(),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "r1",
        ...args.data,
      })),
      updateMany: vi.fn(
        async (_args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => ({ count: 1 }),
      ),
    },
    auditEvent: { create: vi.fn(async () => ({ id: "audit1" })) },
    leadMatchDecision: {
      create: vi.fn(async () => ({ id: "decision1" })),
    },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: unknown) => Promise<unknown>)(h.db);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));

const mockScope = vi.fn();
vi.mock("@/lib/tenancy/scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenancy/scope")>(
    "@/lib/tenancy/scope",
  );
  return {
    ...actual,
    requireWritableWorkspace: () => mockScope(),
  };
});

const { POST, DELETE } = await import(
  "@/app/api/tenant/leads/[id]/link-resident/route"
);

const SCOPE = {
  orgId: "org1",
  userId: "u1",
  role: "CLIENT_ADMIN",
  allowedPropertyIds: null,
};

function post(leadId: string, body: unknown) {
  return POST(
    new Request(`http://x/api/tenant/leads/${leadId}/link-resident`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }) as never,
    { params: Promise.resolve({ id: leadId }) },
  );
}

function del(leadId: string, body: unknown) {
  return DELETE(
    new Request(`http://x/api/tenant/leads/${leadId}/link-resident`, {
      method: "DELETE",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }) as never,
    { params: Promise.resolve({ id: leadId }) },
  );
}

const RESIDENT = {
  id: "r1",
  leadId: null as string | null,
  moveInDate: new Date("2026-06-01T00:00:00Z"),
  currentLease: { startDate: new Date("2026-06-15T00:00:00Z") },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockScope.mockResolvedValue(SCOPE);
  h.db.lead.findFirst.mockResolvedValue({ id: "l1", status: "TOURED" });
  h.db.resident.findFirst.mockResolvedValue({ ...RESIDENT });
  h.db.lead.updateMany.mockResolvedValue({ count: 1 });
  h.db.resident.updateMany.mockResolvedValue({ count: 1 });
});

describe("POST link-resident", () => {
  it("404s when the lead is outside the caller's scope", async () => {
    h.db.lead.findFirst.mockResolvedValue(null);
    const res = await post("l1", { residentId: "r1" });
    expect(res.status).toBe(404);
    expect(h.db.resident.update).not.toHaveBeenCalled();
  });

  it("404s when the resident is outside the caller's scope (wrong org/property)", async () => {
    h.db.resident.findFirst.mockResolvedValue(null);
    const res = await post("l1", { residentId: "r-other-org" });
    expect(res.status).toBe(404);
    expect(h.db.resident.updateMany).not.toHaveBeenCalled();
    expect(h.db.lead.updateMany).not.toHaveBeenCalled();
  });

  it("409s when the resident is already linked to a different lead (never steal)", async () => {
    h.db.resident.findFirst.mockResolvedValue({
      ...RESIDENT,
      leadId: "someone-else",
    });
    const res = await post("l1", { residentId: "r1" });
    expect(res.status).toBe(409);
    expect(h.db.resident.updateMany).not.toHaveBeenCalled();
    expect(h.db.lead.updateMany).not.toHaveBeenCalled();
  });

  it("no-ops cleanly when the resident is already linked to THIS lead", async () => {
    h.db.resident.findFirst.mockResolvedValue({ ...RESIDENT, leadId: "l1" });
    const res = await post("l1", { residentId: "r1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, noChange: true });
    expect(h.db.resident.updateMany).not.toHaveBeenCalled();
  });

  it("403s a read-only CLIENT_VIEWER seat — a proof claim is a write", async () => {
    mockScope.mockResolvedValue({ ...SCOPE, role: "CLIENT_VIEWER" });
    const res = await post("l1", { residentId: "r1" });
    expect(res.status).toBe(403);
    expect(h.db.resident.updateMany).not.toHaveBeenCalled();
    expect(h.db.lead.updateMany).not.toHaveBeenCalled();
  });

  it("claims the resident CONDITIONALLY (leadId null) so two concurrent links can't both win", async () => {
    await post("l1", { residentId: "r1" });
    const [claimArgs] = h.db.resident.updateMany.mock.calls[0];
    // The steal guard must live in the WRITE predicate, not only the read.
    expect(claimArgs.where).toMatchObject({ id: "r1", leadId: null });
    expect(claimArgs.data).toMatchObject({ leadId: "l1" });
  });

  it("409s and does NOT promote when it loses the claim race", async () => {
    h.db.resident.updateMany.mockResolvedValue({ count: 0 });
    const res = await post("l1", { residentId: "r1" });
    expect(res.status).toBe(409);
    expect(h.db.lead.updateMany).not.toHaveBeenCalled();
    expect(h.db.auditEvent.create).not.toHaveBeenCalled();
  });

  it("links, promotes monotonically to SIGNED, anchors convertedAt to the lease start, audits", async () => {
    const res = await post("l1", { residentId: "r1" });
    expect(res.status).toBe(200);

    expect(h.db.resident.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1", leadId: null },
        data: expect.objectContaining({ leadId: "l1" }),
      }),
    );
    const [promoteArgs] = h.db.lead.updateMany.mock.calls[0];
    // Monotonic: only below-SIGNED statuses may transition.
    expect(promoteArgs.where).toMatchObject({ id: "l1" });
    expect(promoteArgs.where.status.in).not.toContain("SIGNED");
    expect(promoteArgs.where.status.in).not.toContain("LOST");
    expect(promoteArgs.data.status).toBe("SIGNED");
    // convertedAt anchors to the real signing date, not "now".
    expect(promoteArgs.data.convertedAt).toEqual(
      new Date("2026-06-15T00:00:00Z"),
    );
    expect(h.db.auditEvent.create).toHaveBeenCalled();
    expect(h.db.leadMatchDecision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org1",
        residentId: "r1",
        leadId: "l1",
        status: "MANUAL_MATCH",
        method: "MANUAL",
        confidence: 100,
        reviewedByUserId: "u1",
      }),
    });
  });

  it("falls back to moveInDate for convertedAt when no lease row exists", async () => {
    h.db.resident.findFirst.mockResolvedValue({
      ...RESIDENT,
      currentLease: null,
    });
    await post("l1", { residentId: "r1" });
    const [promoteArgs] = h.db.lead.updateMany.mock.calls[0];
    expect(promoteArgs.data.convertedAt).toEqual(
      new Date("2026-06-01T00:00:00Z"),
    );
  });

  it("400s on a missing residentId", async () => {
    const res = await post("l1", {});
    expect(res.status).toBe(400);
  });
});

describe("DELETE link-resident (unlink)", () => {
  it("unlinks a resident linked to THIS lead, marks operator intent, never touches lead status", async () => {
    h.db.resident.findFirst.mockResolvedValue({ ...RESIDENT, leadId: "l1" });
    const res = await del("l1", { residentId: "r1" });
    expect(res.status).toBe(200);
    expect(h.db.resident.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1", leadId: "l1" },
        // leadLinkManual stays TRUE so the AppFolio sync can't auto-relink
        // the same wrong lead on the next tick.
        data: { leadId: null, leadLinkManual: true },
      }),
    );
    expect(h.db.lead.updateMany).not.toHaveBeenCalled();
    expect(h.db.auditEvent.create).toHaveBeenCalled();
    expect(h.db.leadMatchDecision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org1",
        residentId: "r1",
        leadId: "l1",
        status: "MANUAL_UNLINK",
        method: "MANUAL",
        confidence: 100,
        reviewedByUserId: "u1",
      }),
    });
  });

  it("403s a read-only seat on unlink too", async () => {
    mockScope.mockResolvedValue({ ...SCOPE, role: "CLIENT_VIEWER" });
    const res = await del("l1", { residentId: "r1" });
    expect(res.status).toBe(403);
    expect(h.db.resident.updateMany).not.toHaveBeenCalled();
  });

  it("404s when the resident is not linked to this lead", async () => {
    h.db.resident.findFirst.mockResolvedValue(null);
    const res = await del("l1", { residentId: "r1" });
    expect(res.status).toBe(404);
    expect(h.db.resident.updateMany).not.toHaveBeenCalled();
  });
});
