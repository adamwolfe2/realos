import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MappedResident } from "@/lib/integrations/appfolio";

// ---------------------------------------------------------------------------
// Resident.leadId is the customer-visible lead→lease proof chain
// (2026-08-02). Two invariants on the sync path:
//
//   1. STICKY LINK: a leadId that already exists on the Resident row —
//      auto-matched earlier or set by an operator through the manual
//      "Mark as signed" UI — must survive every re-sync. The pre-fix code
//      recomputed leadId from email each run and wrote it unconditionally,
//      so a manual link was silently nulled on the next cron tick.
//   2. Matching runs the shared unambiguous email → phone → name ladder
//      (lib/leads/lead-lease-link.ts), not exact-email-only.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  db: {
    resident: {
      findUnique: vi.fn(),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "r1",
        ...args.data,
      })),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "r-new",
        ...args.data,
      })),
    },
    lead: {
      updateMany: vi.fn(
        async (_args: {
          where: { id: string; status: { in: string[] } };
          data: Record<string, unknown>;
        }) => ({ count: 1 }),
      ),
    },
    leadMatchDecision: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "decision_1",
        ...args.data,
      })),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(h.db),
    ),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("server-only", () => ({}));

const { upsertResident } = await import("@/lib/integrations/appfolio-sync");
const { buildLeadMatchIndex } = await import("@/lib/leads/lead-lease-link");

function mapped(over: Partial<MappedResident> = {}): MappedResident {
  return {
    externalId: "af-tenant-1",
    firstName: "Ada",
    lastName: "Lovelace",
    email: null,
    phone: null,
    unitExternalId: null,
    propertyExternalId: "af-prop-1",
    unitNumber: "4B",
    status: "ACTIVE",
    moveInDate: null,
    moveOutDate: null,
    noticeGivenDate: null,
    monthlyRentCents: null,
    raw: {},
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("upsertResident — operator intent beats auto-match", () => {
  it("NEVER re-links a resident the operator unlinked (leadLinkManual + leadId null)", async () => {
    // The unlink route sets leadId=null, leadLinkManual=true. Before this
    // flag existed, leadId presence was the only signal — so the very next
    // sync tick re-created the exact wrong link the operator just removed.
    h.db.resident.findUnique.mockResolvedValue({
      id: "r1",
      leadId: null,
      leadLinkManual: true,
    });
    const index = buildLeadMatchIndex([
      {
        id: "lead-auto",
        email: "ada@example.com",
        phone: null,
        firstName: null,
        lastName: null,
        propertyId: "prop1",
      },
    ]);

    await upsertResident(
      "org1",
      "prop1",
      null,
      mapped({ email: "ada@example.com" }),
      index,
    );

    expect(h.db.resident.update.mock.calls[0][0].data.leadId).toBeNull();
    expect(h.db.lead.updateMany).not.toHaveBeenCalled();
  });

  it("promotes a freshly auto-linked lead to SIGNED monotonically, anchored to move-in", async () => {
    // Without this the phone/name tiers were half-wired: the link existed
    // but convertedAt stayed null, so tracedSignedLeads never counted it.
    h.db.resident.findUnique.mockResolvedValue(null);
    const index = buildLeadMatchIndex([
      {
        id: "lead-phone",
        email: null,
        phone: "4055550100",
        firstName: null,
        lastName: null,
        propertyId: "prop1",
      },
    ]);

    await upsertResident(
      "org1",
      "prop1",
      null,
      mapped({
        phone: "405.555.0100",
        moveInDate: new Date("2026-05-01T00:00:00Z"),
      }),
      index,
    );

    const [args] = h.db.lead.updateMany.mock.calls[0];
    expect(args.where.status.in).not.toContain("LOST");
    expect(args.where.status.in).not.toContain("SIGNED");
    expect(args.data.convertedAt).toEqual(new Date("2026-05-01T00:00:00Z"));
  });

  it("preserves an existing link even when this run's matching finds nothing", async () => {
    h.db.resident.findUnique.mockResolvedValue({
      id: "r1",
      leadId: "lead-manual",
      leadLinkManual: false,
    });
    const index = buildLeadMatchIndex([]); // no candidates → match = null

    await upsertResident("org1", "prop1", null, mapped(), index);

    expect(h.db.resident.update).toHaveBeenCalledTimes(1);
    expect(h.db.resident.update.mock.calls[0][0].data.leadId).toBe(
      "lead-manual",
    );
  });

  it("keeps the existing link even when matching names a DIFFERENT lead", async () => {
    h.db.resident.findUnique.mockResolvedValue({
      id: "r1",
      leadId: "lead-manual",
      leadLinkManual: false,
    });
    const index = buildLeadMatchIndex([
      {
        id: "lead-auto",
        email: "ada@example.com",
        phone: null,
        firstName: null,
        lastName: null,
        propertyId: "prop1",
      },
    ]);

    await upsertResident(
      "org1",
      "prop1",
      null,
      mapped({ email: "ada@example.com" }),
      index,
    );

    expect(h.db.resident.update.mock.calls[0][0].data.leadId).toBe(
      "lead-manual",
    );
  });

  it("re-attempts promotion on later runs (idempotent), so a failed promotion isn't stranded forever", async () => {
    // Keying promotion off the link TRANSITION would mean a transient DB
    // error left the link with convertedAt null and no retry — invisible
    // to tracedSignedLeads permanently. The status gate makes repeating it
    // free.
    h.db.resident.findUnique.mockResolvedValue({
      id: "r1",
      leadId: "lead-existing",
      leadLinkManual: false,
    });

    await upsertResident("org1", "prop1", null, mapped(), buildLeadMatchIndex([]));

    expect(h.db.lead.updateMany).toHaveBeenCalledTimes(1);
    const [args] = h.db.lead.updateMany.mock.calls[0];
    expect(args.where.id).toBe("lead-existing");
    expect(args.where.status.in).not.toContain("SIGNED");
  });

  it("backfills an unlinked resident from the match ladder (phone tier)", async () => {
    h.db.resident.findUnique.mockResolvedValue({ id: "r1", leadId: null, leadLinkManual: false });
    const index = buildLeadMatchIndex([
      {
        id: "lead-phone",
        email: null,
        phone: "+1 (405) 555-0100",
        firstName: null,
        lastName: null,
        propertyId: "prop1",
      },
    ]);

    await upsertResident(
      "org1",
      "prop1",
      null,
      mapped({ phone: "405.555.0100" }),
      index,
    );

    expect(h.db.resident.update.mock.calls[0][0].data.leadId).toBe(
      "lead-phone",
    );
    expect(h.db.leadMatchDecision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org1",
        propertyId: "prop1",
        residentId: "r1",
        leadId: "lead-phone",
        status: "MATCHED",
        method: "NORMALIZED_PHONE",
        confidence: 92,
      }),
    });
  });

  it("keeps a name-only candidate in review instead of minting signed proof", async () => {
    h.db.resident.findUnique.mockResolvedValue(null);
    const index = buildLeadMatchIndex([
      {
        id: "lead-name",
        email: null,
        phone: null,
        firstName: "Ada",
        lastName: "Lovelace",
        propertyId: "prop1",
      },
    ]);

    await upsertResident("org1", "prop1", null, mapped(), index);

    expect(h.db.resident.create).toHaveBeenCalledTimes(1);
    expect(h.db.resident.create.mock.calls[0][0].data.leadId).toBeNull();
    expect(h.db.lead.updateMany).not.toHaveBeenCalled();
    expect(h.db.leadMatchDecision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        residentId: "r-new",
        leadId: "lead-name",
        status: "REVIEW_REQUIRED",
        method: "NAME_ONLY",
        confidence: 70,
      }),
    });
  });

  it("records unmatched decisions so operators can see missing proof", async () => {
    h.db.resident.findUnique.mockResolvedValue(null);

    await upsertResident("org1", "prop1", null, mapped(), buildLeadMatchIndex([]));

    expect(h.db.leadMatchDecision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        residentId: "r-new",
        leadId: null,
        status: "UNMATCHED",
        method: "NONE",
        confidence: 0,
      }),
    });
  });
});
