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

  it("reads the real rental_applications shape (nested applicant + group_id)", () => {
    // Mirrors AppFolio's v2 `rental_applications` report: the person is
    // nested under `applicant`, the row id is the application id, and
    // co-applicants share `group_id`.
    const mapped = mapApplicationPayload({
      id: "ra-9001",
      group_id: "grp-77",
      unit_id: "u-512",
      status: "Submitted",
      submitted_at: "2026-06-05T18:00:00Z",
      desired_move_in_date: "2026-08-01",
      applicant: {
        first_name: "Dana",
        last_name: "Whitfield",
        email: "dana.whitfield@example.com",
      },
    });
    expect(mapped).not.toBeNull();
    expect(mapped!.externalId).toBe("ra-9001");
    expect(mapped!.applicationGroupId).toBe("grp-77");
    expect(mapped!.unitExternalId).toBe("u-512");
    expect(mapped!.status).toBe("SUBMITTED");
    expect(mapped!.email).toBe("dana.whitfield@example.com");
    expect(mapped!.firstName).toBe("Dana");
    expect(mapped!.lastName).toBe("Whitfield");
    expect(mapped!.receivedAt?.toISOString()).toBe("2026-06-05T18:00:00.000Z");
    expect(mapped!.desiredMoveIn?.toISOString().slice(0, 10)).toBe("2026-08-01");
  });

  it("supports multi-property applications", () => {
    const mapped = mapApplicationPayload({
      applicant_id: "m",
      property_id: "p1",
      property_ids: ["p2", "p3"],
    });
    expect(mapped!.propertyIds).toEqual(["p1", "p2", "p3"]);
  });

  // REGRESSION (2026-06-19): the live AppFolio `rental_applications` v2 report
  // uses NONE of the previously-assumed keys. It keys the row on
  // `rental_application_id` (a number), gives the applicant as a single flat
  // `applicants` string, dates as `received` / `decision_made_at`, the group as
  // `rental_application_group_id`, and a real numeric `property_id`. The old
  // mapper looked for applicant_id/applicant_uuid/etc., found none, and
  // returned null for EVERY row — silently dropping 288/288 real applications
  // for the live customer. This fixture is a real captured row (sanitized) and
  // must always map. Do not delete: it is the only test bound to reality.
  it("maps the REAL live rental_applications v2 row shape", () => {
    const mapped = mapApplicationPayload({
      applicants: "Eiran C. Arriaza",
      received: "2026-06-17T01:02:39Z",
      desired_move_in: "2026-06-30",
      lead_source: "Zillow Rental Network",
      status: "Decision Pending",
      application_status: "Decision Pending",
      unit_name: "01",
      property_name: "399 Schafer Rd.",
      approved_at: null,
      denied_at: null,
      decision_made_at: null,
      rental_application_id: 25610,
      rental_application_group_id: null,
      email: "eiran.arriaza2017@gmail.com",
      phone_number: "(510) 674-7764",
      unit_id: 1617,
      property_id: 170,
    });
    expect(mapped).not.toBeNull();
    expect(mapped!.externalId).toBe("25610"); // numeric id coerced to string
    expect(mapped!.propertyIds).toEqual(["170"]); // resolvable, not empty
    expect(mapped!.email).toBe("eiran.arriaza2017@gmail.com");
    expect(mapped!.phone).toBe("(510) 674-7764");
    expect(mapped!.firstName).toBe("Eiran");
    expect(mapped!.lastName).toBe("C. Arriaza"); // remainder kept intact
    expect(mapped!.status).toBe("UNDER_REVIEW"); // "Decision Pending"
    expect(mapped!.unitName).toBe("01");
    expect(mapped!.unitExternalId).toBe("1617");
    expect(mapped!.appliedAt?.toISOString()).toBe("2026-06-17T01:02:39.000Z");
    expect(mapped!.applicationGroupId).toBe("25610"); // singleton (group id null)
  });

  it("maps decided dates from decision_made_at / canceled_at (v2 keys)", () => {
    const approved = mapApplicationPayload({
      rental_application_id: 1,
      application_status: "Approved",
      decision_made_at: "2026-06-10T12:00:00Z",
    });
    expect(approved!.status).toBe("APPROVED");
    expect(approved!.decidedAt?.toISOString()).toBe("2026-06-10T12:00:00.000Z");

    const canceled = mapApplicationPayload({
      rental_application_id: 2,
      application_status: "Canceled",
      canceled_at: "2026-06-11T12:00:00Z",
    });
    expect(canceled!.status).toBe("WITHDRAWN");
    expect(canceled!.decidedAt?.toISOString()).toBe("2026-06-11T12:00:00.000Z");
  });

  it("splits a single-token applicant name without crashing", () => {
    const mapped = mapApplicationPayload({
      rental_application_id: 3,
      applicants: "Cher",
    });
    expect(mapped!.firstName).toBe("Cher");
    expect(mapped!.lastName).toBeNull();
  });
});
