import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression test for P0-1: marketplace lead PII (gender, income range,
// company, contact) must NEVER be returned to a non-owner. `getMaskedLead`
// is the only shape an unauthenticated visitor / non-buyer ever sees — it may
// expose existence booleans for teaser rows but never the raw values. The
// raw-PII `getFullLead` is fetched solely after purchase ownership is proven.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { marketplaceLead: { findUnique: h.findUnique } },
}));

import { getMaskedLead, getFullLead } from "@/lib/marketplace/repo";

const RAW_ROW = {
  id: "lead_123",
  firstName: "Marisol",
  lastName: "Reyes",
  age: 34,
  photoUrl: null,
  market: "Austin, TX",
  propertyType: "APARTMENT",
  intentScore: 88,
  budgetLabel: "$1.8k–2.2k",
  signal: "Toured 3 comps",
  timeline: "30 days",
  priceCents: 4900,
  status: "AVAILABLE",
  // Gated PII — must not leak via the masked view.
  email: "marisol.reyes@gmail.com",
  phone: "+15125551234",
  city: "Austin",
  state: "TX",
  postalCode: "78704",
  budgetMinCents: 180000,
  budgetMaxCents: 220000,
  intentPayload: {},
  gender: "Female",
  companyName: "Acme Robotics",
  companyState: "TX",
  businessEmail: "m.reyes@acme.com",
  mobilePhone: "+15125559999",
  linkedinUrl: "https://linkedin.com/in/marisolreyes",
  incomeRange: "$120k–150k",
};

describe("marketplace PII masking (P0-1)", () => {
  beforeEach(() => {
    h.findUnique.mockReset();
  });

  it("getMaskedLead returns existence flags but NO raw PII values", async () => {
    h.findUnique.mockResolvedValue(RAW_ROW);
    const masked = await getMaskedLead("lead_123");
    expect(masked).not.toBeNull();

    // Existence booleans drive teaser rows.
    expect(masked!.has).toEqual({
      businessEmail: true,
      mobilePhone: true,
      company: true,
      linkedin: true,
      income: true,
      gender: true,
    });

    // The masked object must not carry any raw PII value, anywhere.
    const serialized = JSON.stringify(masked);
    for (const secret of [
      "Female",
      "$120k–150k",
      "Acme Robotics",
      "marisol.reyes@gmail.com",
      "+15125551234",
      "m.reyes@acme.com",
      "+15125559999",
      "linkedin.com/in/marisolreyes",
      "78704",
    ]) {
      expect(serialized).not.toContain(secret);
    }

    // Browse-safe fields remain (display name is last-initial only).
    expect(masked!.displayName).toBe("Marisol R.");
    expect(masked!.market).toBe("Austin, TX");
    expect(masked!.status).toBe("AVAILABLE");
  });

  it("getMaskedLead reports false existence flags when fields are absent", async () => {
    h.findUnique.mockResolvedValue({
      ...RAW_ROW,
      gender: null,
      incomeRange: null,
      companyName: null,
      linkedinUrl: null,
      businessEmail: null,
      mobilePhone: null,
    });
    const masked = await getMaskedLead("lead_123");
    expect(masked!.has).toEqual({
      businessEmail: false,
      mobilePhone: false,
      company: false,
      linkedin: false,
      income: false,
      gender: false,
    });
  });

  it("getMaskedLead returns null for a missing lead", async () => {
    h.findUnique.mockResolvedValue(null);
    expect(await getMaskedLead("nope")).toBeNull();
  });

  it("getFullLead (owner-only path) DOES return the raw PII", async () => {
    h.findUnique.mockResolvedValue(RAW_ROW);
    const full = await getFullLead("lead_123");
    expect(full!.gender).toBe("Female");
    expect(full!.incomeRange).toBe("$120k–150k");
    expect(full!.companyName).toBe("Acme Robotics");
    expect(full!.email).toBe("marisol.reyes@gmail.com");
    expect(full!.fullName).toBe("Marisol Reyes");
  });
});
