import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression (2026-09-29): pre-chat form + mid-chat email capture ran on
// different sessionIds, so each chatbot prospect became TWO Lead rows
// (SG: 104 chatbot leads, 81 distinct emails). The chat routes must reuse
// the org's existing lead for that email.
// ---------------------------------------------------------------------------

const lead = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { lead } }));

const { findOrCreateChatbotLead } = await import(
  "@/lib/chatbot/find-or-create-lead"
);

const ARGS = {
  orgId: "org_1",
  propertyId: "prop_1",
  email: "  Jane@Example.com ",
  firstName: "Jane",
  lastName: null,
  phone: "5105550100",
  pageUrl: "https://site.test/availability",
};

beforeEach(() => {
  lead.findFirst.mockReset();
  lead.update.mockReset();
  lead.create.mockReset();
});

describe("findOrCreateChatbotLead", () => {
  it("reuses the pre-chat lead for the same org + email instead of creating a duplicate", async () => {
    lead.findFirst.mockResolvedValue({
      id: "lead_prechat",
      phone: null,
      firstName: "Jane",
      lastName: "Doe",
    });

    const res = await findOrCreateChatbotLead(ARGS);

    expect(res).toEqual({ id: "lead_prechat", created: false });
    expect(lead.create).not.toHaveBeenCalled();
    expect(lead.findFirst.mock.calls[0][0].where).toEqual({
      orgId: "org_1",
      email: { equals: "jane@example.com", mode: "insensitive" },
    });
    // Fills the missing phone, never overwrites a name we already had.
    const data = lead.update.mock.calls[0][0].data;
    expect(data.phone).toBe("5105550100");
    expect(data.firstName).toBe("Jane");
    expect(data.lastName).toBe("Doe");
  });

  it("creates a CHATBOT lead with a normalized email when none exists", async () => {
    lead.findFirst.mockResolvedValue(null);
    lead.create.mockResolvedValue({ id: "lead_new" });

    const res = await findOrCreateChatbotLead(ARGS);

    expect(res).toEqual({ id: "lead_new", created: true });
    const data = lead.create.mock.calls[0][0].data;
    expect(data.email).toBe("jane@example.com");
    expect(data.source).toBe("CHATBOT");
    expect(data.orgId).toBe("org_1");
  });
});
