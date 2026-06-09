import { describe, it, expect } from "vitest";
import { mapApplicationPayload } from "@/lib/integrations/appfolio";

/**
 * Field-extraction + classification tests for the AppFolio applicant_directory
 * mapper. Covers the new unit / move-in / role / group / screening fields and
 * the cross-plan key fallbacks. Pure function — no DB.
 */
describe("mapApplicationPayload", () => {
  it("returns null when no canonical applicant id is present", () => {
    expect(mapApplicationPayload({ email: "a@b.com" })).toBeNull();
  });

  it("extracts the core identity + unit + intent fields", () => {
    const mapped = mapApplicationPayload({
      applicant_id: "appl-1",
      email: "  Yunji@Choi.com ",
      first_name: "Yunji",
      last_name: "Choi",
      application_status: "Submitted",
      unit_id: "u-203a",
      unit_name: "203 - A",
      desired_move_in: "2026-06-27",
      received_at: "2026-06-02T22:27:00Z",
      application_id: "grp-203a",
      screening_status: "None Requested",
    });
    expect(mapped).not.toBeNull();
    expect(mapped!.externalId).toBe("appl-1");
    expect(mapped!.email).toBe("Yunji@Choi.com"); // trimmed, case preserved
    expect(mapped!.status).toBe("SUBMITTED");
    expect(mapped!.unitExternalId).toBe("u-203a");
    expect(mapped!.unitName).toBe("203 - A");
    expect(mapped!.desiredMoveIn?.toISOString().slice(0, 10)).toBe("2026-06-27");
    expect(mapped!.receivedAt?.toISOString()).toBe("2026-06-02T22:27:00.000Z");
    expect(mapped!.applicationGroupId).toBe("grp-203a");
    expect(mapped!.applicantRole).toBe("PRIMARY");
    expect(mapped!.screeningStatus).toBe("None Requested");
  });

  it("classifies a co-signer via applicant_type", () => {
    const mapped = mapApplicationPayload({
      applicant_id: "appl-2",
      applicant_type: "Co-Signer",
      application_id: "grp-208",
    });
    expect(mapped!.applicantRole).toBe("CO_SIGNER");
    // co-signer shares the household application group with the primary
    expect(mapped!.applicationGroupId).toBe("grp-208");
  });

  it("classifies a co-signer via boolean flag", () => {
    const mapped = mapApplicationPayload({
      applicant_id: "appl-3",
      is_co_signer: true,
    });
    expect(mapped!.applicantRole).toBe("CO_SIGNER");
  });

  it("classifies guarantor / occupant / co-applicant", () => {
    expect(
      mapApplicationPayload({ applicant_id: "g", role: "Guarantor" })!
        .applicantRole,
    ).toBe("GUARANTOR");
    expect(
      mapApplicationPayload({ applicant_id: "o", relationship: "Occupant" })!
        .applicantRole,
    ).toBe("OCCUPANT");
    expect(
      mapApplicationPayload({ applicant_id: "c", applicant_type: "Co-Applicant" })!
        .applicantRole,
    ).toBe("CO_APPLICANT");
  });

  it("falls back to the per-person id for the group when no application id", () => {
    const mapped = mapApplicationPayload({ applicant_uuid: "solo-1" });
    expect(mapped!.externalId).toBe("solo-1");
    expect(mapped!.applicationGroupId).toBe("solo-1"); // singleton group
  });

  it("maps decision statuses and reads variant date keys", () => {
    const denied = mapApplicationPayload({
      id: "x",
      status: "Application Declined",
      decision_date: "2026-05-01",
      move_in_date: "2026-07-01",
    });
    expect(denied!.status).toBe("DENIED");
    expect(denied!.decidedAt?.toISOString().slice(0, 10)).toBe("2026-05-01");
    expect(denied!.desiredMoveIn?.toISOString().slice(0, 10)).toBe("2026-07-01");
  });

  it("supports multi-property applications", () => {
    const mapped = mapApplicationPayload({
      applicant_id: "m",
      property_id: "p1",
      property_ids: ["p2", "p3"],
    });
    expect(mapped!.propertyIds).toEqual(["p1", "p2", "p3"]);
  });
});
