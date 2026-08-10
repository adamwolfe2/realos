import { describe, expect, it } from "vitest";
import {
  deriveLeadProof,
  sourceProvenance,
} from "@/lib/attribution/proof-model";

describe("deriveLeadProof", () => {
  it("calls a signed outcome verified only when a durable PMS link has lease evidence", () => {
    expect(
      deriveLeadProof({
        leadStatus: "SIGNED",
        externalSystem: null,
        applicationStatuses: [],
        hasLinkedResident: true,
        hasLeaseEvidence: true,
        latestDecisionStatus: "MATCHED",
      }),
    ).toMatchObject({ stage: "Signed", verification: "verified" });

    expect(
      deriveLeadProof({
        leadStatus: "SIGNED",
        externalSystem: null,
        applicationStatuses: [],
        hasLinkedResident: false,
        hasLeaseEvidence: false,
        latestDecisionStatus: null,
      }),
    ).toMatchObject({ stage: "Signed", verification: "leasestack_only" });
  });

  it("uses AppFolio application evidence instead of relying only on Lead.status", () => {
    expect(
      deriveLeadProof({
        leadStatus: "NEW",
        externalSystem: null,
        applicationStatuses: ["APPROVED"],
        hasLinkedResident: false,
        hasLeaseEvidence: false,
        latestDecisionStatus: null,
      }),
    ).toMatchObject({ stage: "Approved" });
  });

  it("marks uncertain match decisions for review without promoting the stage", () => {
    expect(
      deriveLeadProof({
        leadStatus: "CONTACTED",
        externalSystem: null,
        applicationStatuses: [],
        hasLinkedResident: false,
        hasLeaseEvidence: false,
        latestDecisionStatus: "REVIEW_REQUIRED",
      }),
    ).toEqual({ stage: "Contacted", verification: "review_needed" });
  });

  it("keeps PMS-originated history visibly imported", () => {
    expect(
      deriveLeadProof({
        leadStatus: "APPLIED",
        externalSystem: "appfolio",
        applicationStatuses: ["SUBMITTED"],
        hasLinkedResident: false,
        hasLeaseEvidence: false,
        latestDecisionStatus: null,
      }),
    ).toEqual({ stage: "Applied", verification: "imported" });
  });
});

describe("sourceProvenance", () => {
  it("names the concrete capture system", () => {
    expect(sourceProvenance("CHATBOT", null)).toBe(
      "Captured by LeaseStack chatbot",
    );
    expect(sourceProvenance("PIXEL_OUTREACH", null)).toBe(
      "Resolved by Cursive visitor pixel",
    );
    expect(sourceProvenance("OTHER", "appfolio")).toBe(
      "Imported from AppFolio",
    );
  });
});
