import { describe, it, expect } from "vitest";
import { mapResidentPayload } from "@/lib/integrations/appfolio";

// ---------------------------------------------------------------------------
// Regression net for the resident contact-data gap. All 3,125 Resident rows
// for the live tenant had email = null and phone = null, which broke the
// Lead -> Resident -> Lease bridge and made signed-lease attribution
// impossible. The mapper had no test, so an earlier fix that guessed at key
// names ("Bug #17") shipped without anyone noticing it still matched nothing.
//
// The fixture below uses the REAL tenant_directory key names, confirmed
// against 400 stored raw payloads in production: contact data arrives under
// the PLURAL keys `emails` and `phone_numbers`, comma-separated when a tenant
// has more than one on file.
// ---------------------------------------------------------------------------

const realPayload = {
  occupancy_id: "occ-1001",
  tenant_id: "ten-2002",
  first_name: "Priya",
  last_name: "Raman",
  emails: "priya.raman@berkeley.edu",
  phone_numbers: "510-462-5442",
  unit_id: "unit-77",
  property_id: "prop-9",
  unit_name: "203 - A",
  status: "Current",
};

describe("mapResidentPayload — contact fields", () => {
  it("reads email from the plural `emails` key the live feed actually sends", () => {
    expect(mapResidentPayload(realPayload)?.email).toBe("priya.raman@berkeley.edu");
  });

  it("reads phone from the plural `phone_numbers` key", () => {
    expect(mapResidentPayload(realPayload)?.phone).toBe("510-462-5442");
  });

  it("takes the first address when a tenant has several on file", () => {
    const r = mapResidentPayload({
      ...realPayload,
      emails: "first@example.com, second@example.com",
      phone_numbers: "510-555-0001, 510-555-0002",
    });
    expect(r?.email).toBe("first@example.com");
    expect(r?.phone).toBe("510-555-0001");
  });

  it("lowercases the email so it joins against Lead.email", () => {
    // The whole point of this data is matching a resident back to the lead
    // that produced them, and that join is case-sensitive.
    const r = mapResidentPayload({ ...realPayload, emails: "Priya.Raman@Berkeley.EDU" });
    expect(r?.email).toBe("priya.raman@berkeley.edu");
  });

  it("does NOT lowercase or mangle the phone number", () => {
    const r = mapResidentPayload({ ...realPayload, phone_numbers: "(510) 462-5442 x12" });
    expect(r?.phone).toBe("(510) 462-5442 x12");
  });

  it("still honours the singular fallback keys for other plan tiers", () => {
    const r = mapResidentPayload({
      occupancy_id: "occ-2",
      email_address: "legacy@example.com",
      phone_number: "415-555-0100",
    });
    expect(r?.email).toBe("legacy@example.com");
    expect(r?.phone).toBe("415-555-0100");
  });

  it("prefers the plural key when both shapes are present", () => {
    const r = mapResidentPayload({
      occupancy_id: "occ-3",
      emails: "plural@example.com",
      email_address: "singular@example.com",
    });
    expect(r?.email).toBe("plural@example.com");
  });

  it("returns null contact fields rather than empty strings when absent", () => {
    const r = mapResidentPayload({ occupancy_id: "occ-4", emails: "", phone_numbers: "" });
    expect(r?.email).toBeNull();
    expect(r?.phone).toBeNull();
  });

  it("still returns null for a row with no usable external id", () => {
    expect(mapResidentPayload({ emails: "orphan@example.com" })).toBeNull();
  });

  it("carries the identity fields the lease bridge needs", () => {
    const r = mapResidentPayload(realPayload);
    expect(r?.externalId).toBe("ten-2002");
    expect(r?.firstName).toBe("Priya");
    expect(r?.lastName).toBe("Raman");
  });
});
